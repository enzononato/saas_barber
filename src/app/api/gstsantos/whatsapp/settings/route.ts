import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { whatsappSettings, WHATSAPP_DEFAULTS } from "@/server/db/schema/whatsapp";
import { requireAuth } from "@/server/middleware/requireAuth";

const updateSchema = z.object({
  isEnabled: z.boolean().optional(),
  followUpDays: z.number().int().min(1).max(365).optional(),
  bookingTemplate: z.string().min(1).max(2000).optional(),
  followUpTemplate: z.string().min(1).max(2000).optional(),
  reminderEnabled: z.boolean().optional(),
  reminderHoursBefore: z.number().int().min(1).max(48).optional(),
  reminderTemplate: z.string().min(1).max(2000).optional(),
});

export async function GET() {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const [row] = await db
    .select()
    .from(whatsappSettings)
    .where(eq(whatsappSettings.organizationId, ctx.orgId))
    .limit(1);

  if (!row) {
    return NextResponse.json({
      isEnabled: false,
      instanceName: null,
      connectionStatus: "disconnected",
      connectedNumber: null,
      followUpDays: 30,
      bookingTemplate: WHATSAPP_DEFAULTS.bookingTemplate,
      followUpTemplate: WHATSAPP_DEFAULTS.followUpTemplate,
      reminderEnabled: true,
      reminderHoursBefore: 2,
      reminderTemplate: WHATSAPP_DEFAULTS.reminderTemplate,
    });
  }

  return NextResponse.json({
    isEnabled: row.isEnabled,
    instanceName: row.instanceName,
    connectionStatus: row.connectionStatus,
    connectedNumber: row.connectedNumber,
    followUpDays: row.followUpDays,
    bookingTemplate: row.bookingTemplate,
    followUpTemplate: row.followUpTemplate,
    reminderEnabled: row.reminderEnabled,
    reminderHoursBefore: row.reminderHoursBefore,
    reminderTemplate: row.reminderTemplate,
  });
}

export async function POST(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const data = parsed.data;

  await db
    .insert(whatsappSettings)
    .values({
      organizationId: ctx.orgId,
      isEnabled: data.isEnabled ?? false,
      followUpDays: data.followUpDays ?? 30,
      bookingTemplate: data.bookingTemplate ?? WHATSAPP_DEFAULTS.bookingTemplate,
      followUpTemplate: data.followUpTemplate ?? WHATSAPP_DEFAULTS.followUpTemplate,
    })
    .onConflictDoUpdate({
      target: whatsappSettings.organizationId,
      set: {
        ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
        ...(data.followUpDays !== undefined && { followUpDays: data.followUpDays }),
        ...(data.bookingTemplate !== undefined && { bookingTemplate: data.bookingTemplate }),
        ...(data.followUpTemplate !== undefined && { followUpTemplate: data.followUpTemplate }),
        ...(data.reminderEnabled !== undefined && { reminderEnabled: data.reminderEnabled }),
        ...(data.reminderHoursBefore !== undefined && { reminderHoursBefore: data.reminderHoursBefore }),
        ...(data.reminderTemplate !== undefined && { reminderTemplate: data.reminderTemplate }),
        updatedAt: sql`now()`,
      },
    });

  return NextResponse.json({ ok: true });
}
