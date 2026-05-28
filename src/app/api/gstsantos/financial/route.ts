import { and, eq, gte, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { appointments } from "@/server/db/schema/appointments";
import { user } from "@/server/db/schema/auth";
import { expenses } from "@/server/db/schema/expenses";
import { requireAuth } from "@/server/middleware/requireAuth";

function getPeriodRange(period: string, date: string): { start: Date; end: Date } {
  const d = new Date(date + "T00:00:00Z");

  if (period === "day") {
    return {
      start: new Date(date + "T00:00:00Z"),
      end: new Date(date + "T23:59:59.999Z"),
    };
  }

  if (period === "week") {
    // Monday of the week containing d
    const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon...
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() + diff);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    sunday.setUTCHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
  }

  // month
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1)),
    end: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
  };
}

export async function GET(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "month"; // day | week | month
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const { start, end } = getPeriodRange(period, date);

  const conditions = [
    eq(appointments.organizationId, ctx.orgId),
    eq(appointments.status, "COMPLETED"),
    gte(appointments.startsAt, start),
    lte(appointments.startsAt, end),
  ];

  if (ctx.role === "member") {
    conditions.push(eq(appointments.professionalId, ctx.userId));
  }

  // Total revenue + count
  const [totals] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${appointments.priceAtBooking}), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(appointments)
    .where(and(...conditions));

  // Daily breakdown for chart
  const daily = await db
    .select({
      day: sql<string>`TO_CHAR(${appointments.startsAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      revenue: sql<string>`SUM(${appointments.priceAtBooking})`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(appointments)
    .where(and(...conditions))
    .groupBy(sql`TO_CHAR(${appointments.startsAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`)
    .orderBy(sql`TO_CHAR(${appointments.startsAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`);

  // Service breakdown (donut)
  const byService = await db
    .select({
      name: appointments.serviceNameAtBooking,
      revenue: sql<string>`SUM(${appointments.priceAtBooking})`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(appointments)
    .where(and(...conditions))
    .groupBy(appointments.serviceNameAtBooking)
    .orderBy(sql`SUM(${appointments.priceAtBooking}) DESC`);

  // By barber — owner only
  let byBarber = null;
  if (ctx.role === "owner") {
    byBarber = await db
      .select({
        professionalId: appointments.professionalId,
        professionalName: user.name,
        revenue: sql<string>`SUM(${appointments.priceAtBooking})`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(appointments)
      .innerJoin(user, eq(appointments.professionalId, user.id))
      .where(and(...conditions))
      .groupBy(appointments.professionalId, user.name)
      .orderBy(sql`SUM(${appointments.priceAtBooking}) DESC`);
  }

  // Expenses — owner only
  let totalExpenses = "0";
  let expensesByCategory: Array<{ category: string | null; total: string; count: number }> = [];
  let expensesList: Array<{
    id: string;
    description: string;
    category: string | null;
    amount: string;
    date: string;
  }> = [];

  if (ctx.role === "owner") {
    const fromDate = start.toISOString().slice(0, 10);
    const toDate = end.toISOString().slice(0, 10);

    const expenseConditions = [
      eq(expenses.organizationId, ctx.orgId),
      gte(expenses.date, fromDate),
      lte(expenses.date, toDate),
    ];

    const [expTotals] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .where(and(...expenseConditions));
    totalExpenses = expTotals?.total ?? "0";

    expensesByCategory = await db
      .select({
        category: expenses.category,
        total: sql<string>`SUM(${expenses.amount})`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(expenses)
      .where(and(...expenseConditions))
      .groupBy(expenses.category)
      .orderBy(sql`SUM(${expenses.amount}) DESC`);

    expensesList = await db
      .select({
        id: expenses.id,
        description: expenses.description,
        category: expenses.category,
        amount: expenses.amount,
        date: expenses.date,
      })
      .from(expenses)
      .where(and(...expenseConditions))
      .orderBy(sql`${expenses.date} DESC`, sql`${expenses.createdAt} DESC`);
  }

  const profit = (
    parseFloat(totals?.total ?? "0") - parseFloat(totalExpenses)
  ).toFixed(2);

  return NextResponse.json({
    period,
    date,
    start: start.toISOString(),
    end: end.toISOString(),
    total: totals?.total ?? "0",
    count: totals?.count ?? 0,
    daily,
    byService,
    byBarber,
    totalExpenses,
    profit,
    expensesByCategory,
    expensesList,
  });
}
