import { and, asc, count, desc, eq, exists, ilike, or, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { customers, loyaltyTierForVisits, type LoyaltyTier } from "@/server/db/schema/customers";
import { appointments } from "@/server/db/schema/appointments";
import { user } from "@/server/db/schema/auth";
import { services as servicesTable } from "@/server/db/schema/services";

export type CustomerListItem = {
  id: string;
  phone: string;
  name: string;
  tags: string[];
  isBlocked: boolean;
  firstSeenAt: Date;
  lastSeenAt: Date;
  totalVisits: number;
  totalSpent: string;
  loyaltyTier: LoyaltyTier;
};

export type CustomerAnalytics = {
  totalAppointments: number;
  completedCount: number;
  canceledCount: number;
  noShowCount: number;
  scheduledCount: number;
  totalSpent: string;
  noShowRate: number;
  avgFrequencyDays: number | null;
  lastAppointmentAt: Date | null;
  nextAppointmentAt: Date | null;
  topProfessionals: Array<{ id: string; name: string; count: number }>;
  topServices: Array<{ name: string; count: number }>;
  preferredHourBucket: "manha" | "tarde" | "noite" | null;
  preferredWeekday: number | null;
  monthlyCounts: Array<{ month: string; count: number }>;
  loyaltyTier: LoyaltyTier;
};

/**
 * Upsert idempotente.
 *
 * `appointmentDate` é o starts_at do agendamento — usamos pra atualizar
 * first/last_seen_at adequadamente (pode ser passado, pode ser passado).
 */
export async function upsertCustomer(params: {
  orgId: string;
  phone: string;
  name: string;
  appointmentDate?: Date;
}): Promise<{ id: string; isBlocked: boolean }> {
  const seen = params.appointmentDate ?? new Date();

  const [row] = await db
    .insert(customers)
    .values({
      organizationId: params.orgId,
      phone: params.phone,
      name: params.name,
      firstSeenAt: seen,
      lastSeenAt: seen,
    })
    .onConflictDoUpdate({
      target: [customers.organizationId, customers.phone],
      set: {
        name: params.name,
        firstSeenAt: sql`LEAST(${customers.firstSeenAt}, ${seen})`,
        lastSeenAt: sql`GREATEST(${customers.lastSeenAt}, ${seen})`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: customers.id, isBlocked: customers.isBlocked });

  return row;
}

type ListParams = {
  orgId: string;
  search?: string;
  tag?: string;
  scopeUserId?: string; // se passado, restringe a clientes que esse user atendeu (barbeiro)
  sortBy?: "lastVisit" | "name" | "totalSpent" | "totalVisits";
  limit?: number;
  offset?: number;
};

export async function listCustomers(p: ListParams): Promise<{
  customers: CustomerListItem[];
  total: number;
}> {
  const limit = Math.min(p.limit ?? 30, 100);
  const offset = Math.max(p.offset ?? 0, 0);

  // Condições base
  const conditions = [eq(customers.organizationId, p.orgId)];

  if (p.search) {
    const pattern = `%${p.search}%`;
    conditions.push(or(ilike(customers.name, pattern), ilike(customers.phone, pattern))!);
  }

  if (p.tag) {
    conditions.push(sql`${customers.tags} @> ARRAY[${p.tag}]::text[]`);
  }

  if (p.scopeUserId) {
    // Apenas clientes que tiveram appointments com este profissional
    conditions.push(
      exists(
        db
          .select({ id: appointments.id })
          .from(appointments)
          .where(
            and(
              eq(appointments.organizationId, p.orgId),
              eq(appointments.customerPhone, customers.phone),
              eq(appointments.professionalId, p.scopeUserId),
            ),
          )
          .limit(1),
      ),
    );
  }

  const whereClause = and(...conditions);

  // Subquery de agregação por phone (escopo se barbeiro)
  const aggSubquery = db
    .select({
      phone: appointments.customerPhone,
      totalVisits: sql<number>`COUNT(*) FILTER (WHERE ${appointments.status} = 'COMPLETED')::int`.as(
        "total_visits",
      ),
      totalSpent: sql<string>`COALESCE(SUM(${appointments.priceAtBooking}) FILTER (WHERE ${appointments.status} = 'COMPLETED'), 0)::text`.as(
        "total_spent",
      ),
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.organizationId, p.orgId),
        ...(p.scopeUserId ? [eq(appointments.professionalId, p.scopeUserId)] : []),
      ),
    )
    .groupBy(appointments.customerPhone)
    .as("agg");

  // Ordenação
  const orderBy = (() => {
    switch (p.sortBy) {
      case "name":
        return asc(customers.name);
      case "totalSpent":
        return desc(sql`COALESCE(${aggSubquery.totalSpent}::numeric, 0)`);
      case "totalVisits":
        return desc(sql`COALESCE(${aggSubquery.totalVisits}, 0)`);
      case "lastVisit":
      default:
        return desc(customers.lastSeenAt);
    }
  })();

  const rows = await db
    .select({
      id: customers.id,
      phone: customers.phone,
      name: customers.name,
      tags: customers.tags,
      isBlocked: customers.isBlocked,
      firstSeenAt: customers.firstSeenAt,
      lastSeenAt: customers.lastSeenAt,
      totalVisits: sql<number>`COALESCE(${aggSubquery.totalVisits}, 0)::int`,
      totalSpent: sql<string>`COALESCE(${aggSubquery.totalSpent}, '0')`,
    })
    .from(customers)
    .leftJoin(aggSubquery, eq(aggSubquery.phone, customers.phone))
    .where(whereClause)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(customers)
    .where(whereClause);

  const items: CustomerListItem[] = rows.map((r) => ({
    ...r,
    loyaltyTier: loyaltyTierForVisits(r.totalVisits),
  }));

  return { customers: items, total };
}

export async function getCustomerById(orgId: string, customerId: string) {
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.organizationId, orgId), eq(customers.id, customerId)))
    .limit(1);
  return row ?? null;
}

export async function getCustomerAnalytics(
  orgId: string,
  customerPhone: string,
  scopeUserId?: string,
): Promise<CustomerAnalytics> {
  const scopedWhere = and(
    eq(appointments.organizationId, orgId),
    eq(appointments.customerPhone, customerPhone),
    ...(scopeUserId ? [eq(appointments.professionalId, scopeUserId)] : []),
  );

  // 1. Contagens por status + total gasto
  const [counts] = await db
    .select({
      total: count(),
      completed: sql<number>`COUNT(*) FILTER (WHERE ${appointments.status} = 'COMPLETED')::int`,
      canceled: sql<number>`COUNT(*) FILTER (WHERE ${appointments.status} = 'CANCELED')::int`,
      noShow: sql<number>`COUNT(*) FILTER (WHERE ${appointments.status} = 'NO_SHOW')::int`,
      scheduled: sql<number>`COUNT(*) FILTER (WHERE ${appointments.status} = 'SCHEDULED')::int`,
      totalSpent: sql<string>`COALESCE(SUM(${appointments.priceAtBooking}) FILTER (WHERE ${appointments.status} = 'COMPLETED'), 0)::text`,
    })
    .from(appointments)
    .where(scopedWhere);

  // 2. Datas chave (último/próximo)
  const [dates] = await db
    .select({
      lastAt: sql<Date | null>`MAX(${appointments.startsAt}) FILTER (WHERE ${appointments.startsAt} <= NOW())`,
      nextAt: sql<Date | null>`MIN(${appointments.startsAt}) FILTER (WHERE ${appointments.startsAt} > NOW() AND ${appointments.status} = 'SCHEDULED')`,
    })
    .from(appointments)
    .where(scopedWhere);

  // 3. Top profissionais
  const topProfs = await db
    .select({
      id: appointments.professionalId,
      name: user.name,
      count: count(),
    })
    .from(appointments)
    .innerJoin(user, eq(appointments.professionalId, user.id))
    .where(scopedWhere)
    .groupBy(appointments.professionalId, user.name)
    .orderBy(desc(count()))
    .limit(3);

  // 4. Top serviços (pelo snapshot do nome)
  const topSvcs = await db
    .select({
      name: appointments.serviceNameAtBooking,
      count: count(),
    })
    .from(appointments)
    .where(scopedWhere)
    .groupBy(appointments.serviceNameAtBooking)
    .orderBy(desc(count()))
    .limit(3);

  // 5. Horário preferido (bucket)
  const [hourPref] = await db
    .select({
      manha: sql<number>`COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM ${appointments.startsAt}) < 12)::int`,
      tarde: sql<number>`COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM ${appointments.startsAt}) BETWEEN 12 AND 17)::int`,
      noite: sql<number>`COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM ${appointments.startsAt}) > 17)::int`,
    })
    .from(appointments)
    .where(scopedWhere);

  let preferredHourBucket: "manha" | "tarde" | "noite" | null = null;
  if (hourPref && hourPref.manha + hourPref.tarde + hourPref.noite > 0) {
    const max = Math.max(hourPref.manha, hourPref.tarde, hourPref.noite);
    if (max === hourPref.manha) preferredHourBucket = "manha";
    else if (max === hourPref.tarde) preferredHourBucket = "tarde";
    else preferredHourBucket = "noite";
  }

  // 6. Dia da semana preferido (0=domingo, 6=sábado)
  const weekdayRows = await db
    .select({
      dow: sql<number>`EXTRACT(DOW FROM ${appointments.startsAt})::int`,
      count: count(),
    })
    .from(appointments)
    .where(scopedWhere)
    .groupBy(sql`EXTRACT(DOW FROM ${appointments.startsAt})`)
    .orderBy(desc(count()))
    .limit(1);

  const preferredWeekday = weekdayRows[0]?.dow ?? null;

  // 7. Gráfico mensal (últimos 12 meses) — apenas COMPLETED
  const monthlyRows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${appointments.startsAt}), 'YYYY-MM')`,
      count: count(),
    })
    .from(appointments)
    .where(
      and(
        scopedWhere,
        sql`${appointments.status} IN ('COMPLETED','SCHEDULED')`,
        sql`${appointments.startsAt} > NOW() - INTERVAL '12 months'`,
      ),
    )
    .groupBy(sql`date_trunc('month', ${appointments.startsAt})`)
    .orderBy(sql`date_trunc('month', ${appointments.startsAt}) ASC`);

  // 8. Frequência média entre cortes (em dias) — apenas COMPLETED
  const completedDates = await db
    .select({ startsAt: appointments.startsAt })
    .from(appointments)
    .where(and(scopedWhere, eq(appointments.status, "COMPLETED")))
    .orderBy(asc(appointments.startsAt));

  let avgFrequencyDays: number | null = null;
  if (completedDates.length >= 2) {
    let totalDays = 0;
    for (let i = 1; i < completedDates.length; i++) {
      const diff =
        new Date(completedDates[i].startsAt).getTime() -
        new Date(completedDates[i - 1].startsAt).getTime();
      totalDays += diff / (1000 * 60 * 60 * 24);
    }
    avgFrequencyDays = Math.round(totalDays / (completedDates.length - 1));
  }

  const completedCount = counts.completed ?? 0;
  const noShowCount = counts.noShow ?? 0;
  const totalApptForRate = completedCount + noShowCount;
  const noShowRate = totalApptForRate > 0 ? noShowCount / totalApptForRate : 0;

  // Suprime warning de import não-usado
  void servicesTable;

  return {
    totalAppointments: counts.total,
    completedCount,
    canceledCount: counts.canceled ?? 0,
    noShowCount,
    scheduledCount: counts.scheduled ?? 0,
    totalSpent: counts.totalSpent,
    noShowRate,
    avgFrequencyDays,
    lastAppointmentAt: dates?.lastAt ?? null,
    nextAppointmentAt: dates?.nextAt ?? null,
    topProfessionals: topProfs,
    topServices: topSvcs,
    preferredHourBucket,
    preferredWeekday,
    monthlyCounts: monthlyRows,
    loyaltyTier: loyaltyTierForVisits(completedCount),
  };
}

export async function getCustomerAppointments(
  orgId: string,
  customerPhone: string,
  scopeUserId?: string,
  limit = 50,
  offset = 0,
) {
  const whereClause = and(
    eq(appointments.organizationId, orgId),
    eq(appointments.customerPhone, customerPhone),
    ...(scopeUserId ? [eq(appointments.professionalId, scopeUserId)] : []),
  );

  const rows = await db
    .select({
      id: appointments.id,
      professionalId: appointments.professionalId,
      professionalName: user.name,
      serviceNameAtBooking: appointments.serviceNameAtBooking,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      priceAtBooking: appointments.priceAtBooking,
      notes: appointments.notes,
    })
    .from(appointments)
    .innerJoin(user, eq(appointments.professionalId, user.id))
    .where(whereClause)
    .orderBy(desc(appointments.startsAt))
    .limit(limit)
    .offset(offset);

  return rows;
}
