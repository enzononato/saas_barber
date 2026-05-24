import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/server/middleware/requireAuth";
import { sendTestMessage, getInstanceNameForOrg } from "@/server/services/whatsapp";

const testSchema = z.object({
  number: z.string().min(8),
  text: z.string().optional(),
});

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

  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const instanceName = await getInstanceNameForOrg(ctx.orgId);
  if (!instanceName) {
    return NextResponse.json({ error: "not_connected" }, { status: 409 });
  }

  const ok = await sendTestMessage({
    instanceName,
    number: parsed.data.number,
    text: parsed.data.text,
  });

  if (!ok) {
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
