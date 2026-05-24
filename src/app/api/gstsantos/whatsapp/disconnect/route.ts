import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { whatsappSettings } from "@/server/db/schema/whatsapp";
import { requireAuth } from "@/server/middleware/requireAuth";
import { logoutInstance } from "@/server/services/evolution";
import { getInstanceNameForOrg } from "@/server/services/whatsapp";

/**
 * Desconecta a instância (logout, mas mantém a instância criada na Evolution).
 * Útil pra trocar de número sem perder a configuração.
 */
export async function POST() {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const instanceName = await getInstanceNameForOrg(ctx.orgId);
  if (instanceName) {
    await logoutInstance(instanceName);
  }

  await db
    .update(whatsappSettings)
    .set({
      connectionStatus: "disconnected",
      connectedNumber: null,
      lastSyncAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(eq(whatsappSettings.organizationId, ctx.orgId));

  return NextResponse.json({ ok: true });
}
