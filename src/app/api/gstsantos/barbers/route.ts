import { and, eq, exists } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { markInviteEmail } from "@/lib/email";
import { db } from "@/server/db";
import { member, user } from "@/server/db/schema/auth";
import { workingHours } from "@/server/db/schema/availability";
import { memberUnits, units } from "@/server/db/schema/units";
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
      role: member.role,
      isBarber: member.isBarber,
      createdAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, ctx.orgId));

  // Vínculos membro→unidades de toda a org (uma query, depois agrupado em memória).
  const links = await db
    .select({ memberId: memberUnits.memberId, unitId: memberUnits.unitId })
    .from(memberUnits)
    .innerJoin(member, eq(memberUnits.memberId, member.id))
    .where(eq(member.organizationId, ctx.orgId));

  const unitsByMember = new Map<string, string[]>();
  for (const l of links) {
    const arr = unitsByMember.get(l.memberId) ?? [];
    arr.push(l.unitId);
    unitsByMember.set(l.memberId, arr);
  }

  // Enrich with hasWorkingHours flag + unitIds
  const enriched = await Promise.all(
    rows.map(async (row) => {
      const [wh] = await db
        .select({ id: workingHours.id })
        .from(workingHours)
        .where(
          and(
            eq(workingHours.organizationId, ctx.orgId),
            eq(workingHours.professionalId, row.userId),
          ),
        )
        .limit(1);
      return {
        ...row,
        hasWorkingHours: Boolean(wh),
        unitIds: unitsByMember.get(row.memberId) ?? [],
      };
    }),
  );

  return NextResponse.json(enriched);
}

export async function POST(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const canManageBarbers = ctx.role === "owner" || ctx.canCreateServices;
  if (!canManageBarbers) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    name,
    email,
    role = "member",
    isBarber = true,
  } = body as {
    name?: string;
    email?: string;
    role?: "owner" | "member" | "receptionist";
    isBarber?: boolean;
  };

  if (!name || !email) {
    return NextResponse.json({ error: "name and email are required" }, { status: 400 });
  }

  if (!["owner", "member", "receptionist"].includes(role)) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }

  // Only owner can create another owner
  if (role === "owner" && ctx.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Recepcionista nunca aparece na lista pública de agendamento
  const finalIsBarber = role === "receptionist" ? false : isBarber;

  const tempPassword = crypto.randomUUID();
  const signUpRes = await auth.api.signUpEmail({
    body: { name, email, password: tempPassword },
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
    role,
    isBarber: finalIsBarber,
    canCreateServices: false,
    createdAt: new Date(),
  });

  // Vincula o novo membro às unidades informadas, ou a todas as ativas por padrão
  // (evita barbeiro órfão que não apareceria em nenhuma filial).
  const requestedUnitIds = Array.isArray(body.unitIds) ? (body.unitIds as string[]) : null;
  const targetUnitIds =
    requestedUnitIds && requestedUnitIds.length > 0
      ? requestedUnitIds
      : (
          await db
            .select({ id: units.id })
            .from(units)
            .where(and(eq(units.organizationId, org.id), eq(units.isActive, true)))
        ).map((u) => u.id);
  if (targetUnitIds.length > 0) {
    await db
      .insert(memberUnits)
      .values(targetUnitIds.map((unitId) => ({ memberId, unitId })))
      .onConflictDoNothing({ target: [memberUnits.memberId, memberUnits.unitId] });
  }

  const setupPage = `${(env.BETTER_AUTH_URL ?? "").replace(/\/$/, "")}/gstsantos/reset-password`;
  try {
    // Marca o e-mail como convite ANTES do request — o callback sendResetPassword
    // do Better Auth vai usar o template de boas-vindas em vez do genérico.
    markInviteEmail(email);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (auth.api as any).requestPasswordReset({
      body: { email, redirectTo: setupPage },
    });
  } catch (err) {
    console.error("[INVITE] requestPasswordReset failed:", err);
  }

  return NextResponse.json(
    { memberId, userId: newUserId, name, email, role, isBarber: finalIsBarber },
    { status: 201 },
  );
}
