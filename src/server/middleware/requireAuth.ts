import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { member } from "@/server/db/schema/auth";
import { getOrgBySlug } from "@/server/services/tenant";

export interface AuthContext {
  userId: string;
  userName: string;
  userEmail: string;
  memberId: string;
  role: "owner" | "member";
  canCreateServices: boolean;
  isBarber: boolean;
  orgId: string;
}

export async function requireAuth(): Promise<AuthContext | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const org = await getOrgBySlug("santos-studios");
  if (!org) return null;

  const rows = await db
    .select({
      id: member.id,
      role: member.role,
      canCreateServices: member.canCreateServices,
      isBarber: member.isBarber,
    })
    .from(member)
    .where(and(eq(member.organizationId, org.id), eq(member.userId, session.user.id)))
    .limit(1);

  if (rows.length === 0) return null;
  const m = rows[0];

  return {
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    memberId: m.id,
    role: m.role as "owner" | "member",
    canCreateServices: m.canCreateServices,
    isBarber: m.isBarber,
    orgId: org.id,
  };
}
