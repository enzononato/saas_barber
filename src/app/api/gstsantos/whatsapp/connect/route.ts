import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { whatsappSettings } from "@/server/db/schema/whatsapp";
import { organization } from "@/server/db/schema/auth";
import { requireAuth } from "@/server/middleware/requireAuth";
import { ensureInstance, getQrCode, instanceNameForSlug } from "@/server/services/evolution";

/**
 * Inicia o fluxo de conexão WhatsApp:
 *   1. Gera o instance name a partir do slug da org
 *   2. Garante que a instância existe na Evolution (idempotente)
 *   3. Pede o QR code
 *   4. Atualiza whatsapp_settings: instance_name + connection_status="connecting"
 *   5. Retorna { qrcode } pro painel exibir
 */
export async function POST() {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Slug da org pra derivar instance name
  const [org] = await db
    .select({ slug: organization.slug })
    .from(organization)
    .where(eq(organization.id, ctx.orgId))
    .limit(1);

  if (!org?.slug) {
    return NextResponse.json({ error: "org_slug_missing" }, { status: 500 });
  }

  const instanceName = instanceNameForSlug(org.slug);

  // Garante existência na Evolution
  const ensure = await ensureInstance(instanceName);
  if (!ensure.ok) {
    return NextResponse.json(
      { error: "evolution_unavailable" },
      { status: 503 },
    );
  }

  // Pega QR code
  const qrcode = await getQrCode(instanceName);

  // Persistir estado
  await db
    .insert(whatsappSettings)
    .values({
      organizationId: ctx.orgId,
      instanceName,
      connectionStatus: "connecting",
      lastSyncAt: new Date(),
    })
    .onConflictDoUpdate({
      target: whatsappSettings.organizationId,
      set: {
        instanceName,
        connectionStatus: "connecting",
        lastSyncAt: sql`now()`,
        updatedAt: sql`now()`,
      },
    });

  return NextResponse.json({
    instanceName,
    qrcode, // base64 sem prefixo (frontend prefixa data:image/png;base64,)
    status: "connecting",
  });
}
