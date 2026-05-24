import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { whatsappSettings } from "@/server/db/schema/whatsapp";
import { requireAuth } from "@/server/middleware/requireAuth";
import { getConnectionState, getInstanceInfo } from "@/server/services/evolution";
import { getInstanceNameForOrg } from "@/server/services/whatsapp";

/**
 * Consulta o estado atual da conexão na Evolution e sincroniza o banco.
 * Usado pelo polling no painel após "Conectar".
 */
export async function GET() {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const instanceName = await getInstanceNameForOrg(ctx.orgId);
  if (!instanceName) {
    return NextResponse.json({ status: "disconnected", connectedNumber: null });
  }

  const state = await getConnectionState(instanceName);

  let dbStatus: "disconnected" | "connecting" | "connected" | "error" = "disconnected";
  let connectedNumber: string | null = null;

  if (state === "open") {
    dbStatus = "connected";
    const info = await getInstanceInfo(instanceName);
    connectedNumber = info.number;
  } else if (state === "connecting") {
    dbStatus = "connecting";
  } else if (state === "close") {
    dbStatus = "disconnected";
  } else {
    dbStatus = "error";
  }

  // Persistir estado atualizado
  await db
    .update(whatsappSettings)
    .set({
      connectionStatus: dbStatus,
      connectedNumber,
      lastSyncAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(eq(whatsappSettings.organizationId, ctx.orgId));

  return NextResponse.json({
    status: dbStatus,
    connectedNumber,
    instanceName,
  });
}
