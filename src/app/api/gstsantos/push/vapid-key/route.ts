import { NextResponse } from "next/server";

import { env } from "@/lib/env";

export async function GET() {
  const key = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? env.VAPID_PUBLIC_KEY;
  if (!key) {
    return NextResponse.json({ error: "vapid_not_configured" }, { status: 503 });
  }
  return NextResponse.json({ publicKey: key });
}
