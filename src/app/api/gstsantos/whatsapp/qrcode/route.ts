import { NextResponse } from "next/server";

import { requireAuth } from "@/server/middleware/requireAuth";
import { getQrCode } from "@/server/services/evolution";
import { getInstanceNameForOrg } from "@/server/services/whatsapp";

/** Refetch do QR code — usado pelo botão "Gerar novo QR" no modal. */
export async function GET() {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const instanceName = await getInstanceNameForOrg(ctx.orgId);
  if (!instanceName) {
    return NextResponse.json({ error: "no_instance" }, { status: 404 });
  }

  const qrcode = await getQrCode(instanceName);
  return NextResponse.json({ qrcode });
}
