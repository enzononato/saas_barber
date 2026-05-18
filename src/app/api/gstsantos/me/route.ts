import { NextResponse } from "next/server";

import { requireAuth } from "@/server/middleware/requireAuth";

export async function GET() {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({
    id: ctx.userId,
    name: ctx.userName,
    email: ctx.userEmail,
    role: ctx.role,
    canCreateServices: ctx.canCreateServices,
  });
}
