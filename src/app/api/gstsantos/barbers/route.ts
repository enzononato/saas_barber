import { and, eq, exists } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { db } from "@/server/db";
import { member, user } from "@/server/db/schema/auth";
import { workingHours } from "@/server/db/schema/availability";
import { requireAuth } from "@/server/middleware/requireAuth";
import { getOrgBySlug } from "@/server/services/tenant";

export async function GET() {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      memberId: member.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      role: member.role,
      isBarber: member.isBarber,
      createdAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, ctx.orgId));

  // Enrich with hasWorkingHours flag
  const enriched = await Promise.all(
    rows.map(async (row) => {
      const [wh] = await db
        .select({ id: workingHours.id })
        .from(workingHours)
        .where(
          and(
            eq(workingHours.organizationId, ctx.orgId),
            eq(workingHours.professionalId, row.userId),
          ),
        )
        .limit(1);
      return { ...row, hasWorkingHours: Boolean(wh) };
    }),
  );

  return NextResponse.json(enriched);
}

export async function POST(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const canManageBarbers = ctx.role === "owner" || ctx.canCreateServices;
  if (!canManageBarbers) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    name,
    email,
    role = "member",
    isBarber = true,
  } = body as { name?: string; email?: string; role?: "owner" | "member"; isBarber?: boolean };

  if (!name || !email) {
    return NextResponse.json({ error: "name and email are required" }, { status: 400 });
  }

  // Only owner can create another owner
  if (role === "owner" && ctx.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const tempPassword = crypto.randomUUID();
  const signUpRes = await auth.api.signUpEmail({
    body: { name, email, password: tempPassword },
  });

  if (!signUpRes?.user) {
    return NextResponse.json({ error: "email_already_exists" }, { status: 409 });
  }

  const newUserId = signUpRes.user.id;
  const org = await getOrgBySlug("santos-studios");
  if (!org) return NextResponse.json({ error: "org_not_found" }, { status: 500 });

  const memberId = crypto.randomUUID();
  await db.insert(member).values({
    id: memberId,
    organizationId: org.id,
    userId: newUserId,
    role,
    isBarber,
    canCreateServices: false,
    createdAt: new Date(),
  });

  const setupPage = `${env.BETTER_AUTH_URL}/gstsantos/reset-password`;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (auth.api as any).requestPasswordReset({
      body: { email, redirectTo: setupPage },
    });
  } catch (err) {
    console.error("[INVITE] requestPasswordReset failed:", err);
  }

  return NextResponse.json(
    { memberId, userId: newUserId, name, email, role, isBarber, tempPassword },
    { status: 201 },
  );
}
