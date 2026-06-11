import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { whatsappSettings } from "@/server/db/schema/whatsapp";
import { requireAuth } from "@/server/middleware/requireAuth";
import { triggerRemindersForOrg } from "@/server/services/whatsapp";
import { env } from "@/lib/env";

/**
 * Endpoint do cron de lembretes pré-agendamento.
 * Rodar a cada 10-15 minutos — dedup garantido por appointments.reminder_sent_at.
 *
 * Aceita duas formas de autenticação:
 * 1. Header `Authorization: Bearer {CRON_SECRET}` (cron externo do EasyPanel)
 * 2. Sessão autenticada de owner (botão "Disparar agora" no painel)
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const expectedToken = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;

  if (expectedToken && authHeader === expectedToken) {
    return runAllEnabledOrgs();
  }

  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const result = await triggerRemindersForOrg(ctx.orgId);
  return NextResponse.json(result);
}

async function runAllEnabledOrgs() {
  const orgs = await db
    .select({ organizationId: whatsappSettings.organizationId })
    .from(whatsappSettings)
    .where(eq(whatsappSettings.isEnabled, true));

  let totalSent = 0;
  let totalSkipped = 0;

  for (const o of orgs) {
    const { sent, skipped } = await triggerRemindersForOrg(o.organizationId);
    totalSent += sent;
    totalSkipped += skipped;
  }

  return NextResponse.json({ sent: totalSent, skipped: totalSkipped, orgs: orgs.length });
}
