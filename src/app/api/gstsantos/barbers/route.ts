import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { sendBarberWelcomeEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { db } from "@/server/db";
import { member, user } from "@/server/db/schema/auth";
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
      canCreateServices: member.canCreateServices,
      createdAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(eq(member.organizationId, ctx.orgId), eq(member.role, "member")));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const canManageBarbers = ctx.role === "owner" || ctx.canCreateServices;
  if (!canManageBarbers) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, email } = body as { name?: string; email?: string };

  if (!name || !email) {
    return NextResponse.json({ error: "name and email are required" }, { status: 400 });
  }

  const password = "Santos@" + Math.floor(1000 + Math.random() * 9000);

  // Create user via Better Auth
  const signUpRes = await auth.api.signUpEmail({
    body: { name, email, password },
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
    role: "member",
    canCreateServices: false,
    createdAt: new Date(),
  });

  const loginUrl = env.BETTER_AUTH_URL + "/gstsantos";
  await sendBarberWelcomeEmail({ name, email, password, loginUrl });

  return NextResponse.json({ memberId, userId: newUserId, name, email }, { status: 201 });
}
