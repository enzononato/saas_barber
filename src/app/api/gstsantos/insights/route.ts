import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@/server/db";
import { requireAuth } from "@/server/middleware/requireAuth";

interface WalletRow {
  active: number;
  retention: number;
  at_risk: number;
  lost: number;
  total: number;
}

interface LtvRow {
  customer_count: number;
  total_visits: number;
  avg_ticket: string | null;
  first_visit: Date | null;
  last_visit: Date | null;
}

interface RetentionRow {
  clients_with_second: number;
  loyal_total: number;
  loyal_active: number;
  clients_total: number;
}

interface CohortRow {
  returned: number;
  prev_count: number;
}

interface RankingRow {
  id: string;
  name: string;
  revenue: string | null;
  completed: number;
  missed: number;
}

interface CommissionRow {
  barber_id: string;
  total_commission: string | null;
}

interface AttributedExpenseRow {
  attributed_to_user_id: string | null;
  total: string;
}

interface MonthlyRevenueRow {
  month: Date;
  revenue: string;
}

interface WorkingHoursRow {
  professional_id: string;
  day_of_week: number;
  minutes_per_day: number;
}

interface AvgDurationRow {
  professional_id: string;
  avg_minutes: string;
}

export async function GET(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const orgId = ctx.orgId;
  const { searchParams } = new URL(req.url);
  const unitId = searchParams.get("unitId"); // filtra todas as métricas por filial

  // Fragmentos opcionais de filtro por unidade (noop quando sem filtro)
  const unitCond = unitId ? sql` AND unit_id = ${unitId}` : sql``;
  const unitCondA = unitId ? sql` AND a.unit_id = ${unitId}` : sql``;

  const [
    walletRes,
    ltvRes,
    retentionRes,
    cohortRes,
    rankingRes,
    commissionRes,
    attributedExpRes,
    monthlyRevRes,
    workingHoursRes,
    avgDurationRes,
  ] = await Promise.all([
    // 1. Wallet status — com filtro de unidade, deriva o "último atendimento"
    // dos próprios appointments da filial (customers é global da org)
    unitId
      ? db.execute(sql`
          WITH per AS (
            SELECT customer_phone, MAX(starts_at) AS last_seen_at
            FROM appointments
            WHERE organization_id = ${orgId} AND status = 'COMPLETED' AND unit_id = ${unitId}
            GROUP BY customer_phone
          )
          SELECT
            COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '30 days')::int AS active,
            COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '60 days' AND last_seen_at < NOW() - INTERVAL '30 days')::int AS retention,
            COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '90 days' AND last_seen_at < NOW() - INTERVAL '60 days')::int AS at_risk,
            COUNT(*) FILTER (WHERE last_seen_at < NOW() - INTERVAL '90 days')::int AS lost,
            COUNT(*)::int AS total
          FROM per
        `)
      : db.execute(sql`
          SELECT
            COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '30 days')::int AS active,
            COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '60 days' AND last_seen_at < NOW() - INTERVAL '30 days')::int AS retention,
            COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '90 days' AND last_seen_at < NOW() - INTERVAL '60 days')::int AS at_risk,
            COUNT(*) FILTER (WHERE last_seen_at < NOW() - INTERVAL '90 days')::int AS lost,
            COUNT(*)::int AS total
          FROM customers WHERE organization_id = ${orgId}
        `),

    // 2. LTV
    db.execute(sql`
      SELECT
        COUNT(DISTINCT customer_phone)::int AS customer_count,
        COUNT(*)::int AS total_visits,
        AVG(price_at_booking)::text AS avg_ticket,
        MIN(starts_at) AS first_visit,
        MAX(starts_at) AS last_visit
      FROM appointments
      WHERE organization_id = ${orgId} AND status = 'COMPLETED'${unitCond}
    `),

    // 3. Retention / Loyalty (last_seen vem dos próprios appointments do escopo)
    db.execute(sql`
      WITH visits AS (
        SELECT customer_phone, COUNT(*) AS n, MAX(starts_at) AS last_seen_at
        FROM appointments
        WHERE organization_id = ${orgId} AND status = 'COMPLETED'${unitCond}
        GROUP BY customer_phone
      )
      SELECT
        COUNT(*) FILTER (WHERE v.n >= 2)::int AS clients_with_second,
        COUNT(*) FILTER (WHERE v.n >= 5)::int AS loyal_total,
        COUNT(*) FILTER (
          WHERE v.n >= 5 AND v.last_seen_at >= NOW() - INTERVAL '30 days'
        )::int AS loyal_active,
        COUNT(*)::int AS clients_total
      FROM visits v
    `),

    // 4. Monthly retention cohort
    db.execute(sql`
      WITH prev AS (
        SELECT DISTINCT customer_phone
        FROM appointments
        WHERE organization_id = ${orgId}
          AND status = 'COMPLETED'
          AND starts_at >= NOW() - INTERVAL '60 days'
          AND starts_at < NOW() - INTERVAL '30 days'${unitCond}
      ),
      curr AS (
        SELECT DISTINCT customer_phone
        FROM appointments
        WHERE organization_id = ${orgId}
          AND status = 'COMPLETED'
          AND starts_at >= NOW() - INTERVAL '30 days'${unitCond}
      )
      SELECT
        (SELECT COUNT(*)::int FROM prev WHERE customer_phone IN (SELECT customer_phone FROM curr)) AS returned,
        (SELECT COUNT(*)::int FROM prev) AS prev_count
    `),

    // 5. Barber ranking 30d
    db.execute(sql`
      SELECT
        u.id AS id,
        u.name AS name,
        COALESCE(SUM(a.price_at_booking) FILTER (WHERE a.status = 'COMPLETED'), 0)::text AS revenue,
        COUNT(*) FILTER (WHERE a.status = 'COMPLETED')::int AS completed,
        COUNT(*) FILTER (WHERE a.status IN ('NO_SHOW', 'CANCELED'))::int AS missed
      FROM appointments a
      INNER JOIN "user" u ON u.id = a.professional_id
      WHERE a.organization_id = ${orgId}
        AND a.starts_at >= NOW() - INTERVAL '30 days'${unitCondA}
      GROUP BY u.id, u.name
      HAVING COUNT(*) FILTER (WHERE a.status = 'COMPLETED') > 0
         OR COUNT(*) FILTER (WHERE a.status IN ('NO_SHOW', 'CANCELED')) > 0
      ORDER BY revenue DESC
    `),

    // 6. Commission per barber 30d
    db.execute(sql`
      SELECT
        u.id AS barber_id,
        COALESCE(SUM(a.price_at_booking * COALESCE(bs.commission_pct, 0) / 100), 0)::text AS total_commission
      FROM appointments a
      INNER JOIN "user" u ON u.id = a.professional_id
      LEFT JOIN member m ON m."userId" = u.id AND m."organizationId" = a.organization_id
      LEFT JOIN barber_services bs ON bs.member_id = m.id AND bs.service_id = a.service_id
      WHERE a.organization_id = ${orgId}
        AND a.status = 'COMPLETED'
        AND a.starts_at >= NOW() - INTERVAL '30 days'${unitCondA}
      GROUP BY u.id
    `),

    // 7. Attributed expenses 30d
    db.execute(sql`
      SELECT
        attributed_to_user_id,
        COALESCE(SUM(amount), 0)::text AS total
      FROM expenses
      WHERE organization_id = ${orgId}
        AND date >= (CURRENT_DATE - INTERVAL '30 days')${unitCond}
      GROUP BY attributed_to_user_id
    `),

    // 8. Monthly revenue last 3 months (for projection)
    db.execute(sql`
      SELECT
        DATE_TRUNC('month', starts_at) AS month,
        COALESCE(SUM(price_at_booking), 0)::text AS revenue
      FROM appointments
      WHERE organization_id = ${orgId}
        AND status = 'COMPLETED'
        AND starts_at >= DATE_TRUNC('month', NOW() - INTERVAL '3 months')
        AND starts_at < DATE_TRUNC('month', NOW() + INTERVAL '1 month')${unitCond}
      GROUP BY month
      ORDER BY month
    `),

    // 9. Working hours per active barber (for capacity)
    db.execute(sql`
      SELECT
        wh.professional_id,
        wh.day_of_week,
        (EXTRACT(EPOCH FROM (wh.end_time - wh.start_time)) / 60
         - COALESCE(EXTRACT(EPOCH FROM (wh.break_end_time - wh.break_start_time)) / 60, 0))::int
         AS minutes_per_day
      FROM working_hours wh
      INNER JOIN member m ON m."userId" = wh.professional_id AND m."organizationId" = wh.organization_id
      WHERE wh.organization_id = ${orgId}
        AND m.is_barber = true${unitId ? sql` AND wh.unit_id = ${unitId}` : sql``}
    `),

    // 10. Average service duration per barber (from completed appointments + their attached services)
    db.execute(sql`
      SELECT
        a.professional_id,
        AVG(s.duration_minutes)::text AS avg_minutes
      FROM appointments a
      INNER JOIN services s ON s.id = a.service_id
      WHERE a.organization_id = ${orgId}
        AND a.status = 'COMPLETED'
        AND a.starts_at >= NOW() - INTERVAL '30 days'${unitCondA}
      GROUP BY a.professional_id
    `),
  ]);

  const walletRow = (walletRes.rows[0] as unknown as WalletRow) ?? {
    active: 0,
    retention: 0,
    at_risk: 0,
    lost: 0,
    total: 0,
  };
  const ltvRow = (ltvRes.rows[0] as unknown as LtvRow) ?? {
    customer_count: 0,
    total_visits: 0,
    avg_ticket: null,
    first_visit: null,
    last_visit: null,
  };
  const retentionRow = (retentionRes.rows[0] as unknown as RetentionRow) ?? {
    clients_with_second: 0,
    loyal_total: 0,
    loyal_active: 0,
    clients_total: 0,
  };
  const cohortRow = (cohortRes.rows[0] as unknown as CohortRow) ?? {
    returned: 0,
    prev_count: 0,
  };
  const rankingRows = (rankingRes.rows as unknown as RankingRow[]) ?? [];
  const commissionRows = (commissionRes.rows as unknown as CommissionRow[]) ?? [];
  const attributedExpRows =
    (attributedExpRes.rows as unknown as AttributedExpenseRow[]) ?? [];
  const monthlyRevRows = (monthlyRevRes.rows as unknown as MonthlyRevenueRow[]) ?? [];
  const workingHoursRows = (workingHoursRes.rows as unknown as WorkingHoursRow[]) ?? [];
  const avgDurationRows = (avgDurationRes.rows as unknown as AvgDurationRow[]) ?? [];

  // Wallet derivations
  const total = walletRow.total;
  const active = walletRow.active;
  const healthPct = total > 0 ? Math.round((active / total) * 100) : 0;
  const healthLevel: "green" | "yellow" | "red" =
    healthPct >= 40 ? "green" : healthPct >= 25 ? "yellow" : "red";

  // LTV derivations
  const avgTicket = ltvRow.avg_ticket ? parseFloat(ltvRow.avg_ticket) : 0;
  let frequencyPerYear = 0;
  let operationDays = 0;
  let partialData = true;

  if (ltvRow.first_visit && ltvRow.last_visit && ltvRow.customer_count > 0) {
    const firstMs = new Date(ltvRow.first_visit).getTime();
    const lastMs = new Date(ltvRow.last_visit).getTime();
    operationDays = Math.max(1, Math.round((lastMs - firstMs) / 86_400_000));
    const effectiveDays = Math.max(30, operationDays);
    const visitsPerCustomer = ltvRow.total_visits / ltvRow.customer_count;
    frequencyPerYear = (visitsPerCustomer * 365) / effectiveDays;
    partialData = operationDays < 365;
  }
  const ltvValue = avgTicket * frequencyPerYear;

  // Retention derivations
  const clientsTotal = retentionRow.clients_total;
  const secondVisitRate =
    clientsTotal > 0 ? Math.round((retentionRow.clients_with_second / clientsTotal) * 100) : 0;
  const loyaltyRate =
    clientsTotal > 0 ? Math.round((retentionRow.loyal_total / clientsTotal) * 100) : 0;
  const monthlyRetention =
    cohortRow.prev_count > 0
      ? Math.round((cohortRow.returned / cohortRow.prev_count) * 100)
      : 0;

  // Expense allocation: split into attributed and unattributed
  let unattributedExpenses30d = 0;
  const expensesByBarber = new Map<string, number>();
  for (const row of attributedExpRows) {
    const amount = parseFloat(row.total ?? "0");
    if (row.attributed_to_user_id) {
      expensesByBarber.set(row.attributed_to_user_id, amount);
    } else {
      unattributedExpenses30d += amount;
    }
  }
  const totalExpenses30d =
    unattributedExpenses30d +
    Array.from(expensesByBarber.values()).reduce((a, b) => a + b, 0);

  // Number of active barbers = those who appear in ranking (had appointments)
  const numActiveBarbers = rankingRows.length;
  const sharedCostPerBarber =
    numActiveBarbers > 0 ? unattributedExpenses30d / numActiveBarbers : 0;

  const commissionByBarber = new Map(
    commissionRows.map((r) => [r.barber_id, parseFloat(r.total_commission ?? "0")]),
  );

  // Capacity per barber: minutes worked per 30 days
  const minutesPerBarber = new Map<string, number>();
  for (const wh of workingHoursRows) {
    // each day_of_week occurs ~4.286 times in 30 days
    const occurrences = 30 / 7;
    const prev = minutesPerBarber.get(wh.professional_id) ?? 0;
    minutesPerBarber.set(wh.professional_id, prev + wh.minutes_per_day * occurrences);
  }

  const avgDurationByBarber = new Map(
    avgDurationRows.map((r) => [r.professional_id, parseFloat(r.avg_minutes ?? "0")]),
  );

  // Ranking with profitability
  const ranking = rankingRows.map((r) => {
    const completed = r.completed;
    const missed = r.missed;
    const totalAppointments = completed + missed;
    const completedRate =
      totalAppointments > 0 ? Math.round((completed / totalAppointments) * 100) : 0;
    const revenue = parseFloat(r.revenue ?? "0");
    const averageTicket = completed > 0 ? revenue / completed : 0;
    const commission = commissionByBarber.get(r.id) ?? 0;
    const attributedCost = expensesByBarber.get(r.id) ?? 0;
    const totalCost = attributedCost + sharedCostPerBarber;
    const chairRevenue = revenue - commission; // what stays with the chair
    const profit = chairRevenue - totalCost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    // Break-even: how many cuts to cover total cost given chair revenue per cut
    const chairRevenuePerCut = completed > 0 ? chairRevenue / completed : 0;
    const breakEvenCuts =
      chairRevenuePerCut > 0 ? Math.ceil(totalCost / chairRevenuePerCut) : 0;

    // Capacity & saturation
    const minutesAvailable = minutesPerBarber.get(r.id) ?? 0;
    const avgMin = avgDurationByBarber.get(r.id) ?? 0;
    const capacity = avgMin > 0 ? Math.floor(minutesAvailable / avgMin) : 0;
    const saturation =
      capacity > 0 ? Math.min(100, Math.round((completed / capacity) * 100)) : 0;

    return {
      id: r.id,
      name: r.name,
      revenue: revenue.toFixed(2),
      completed,
      missed,
      averageTicket: averageTicket.toFixed(2),
      completedRate,
      commission: commission.toFixed(2),
      attributedCost: attributedCost.toFixed(2),
      sharedCost: sharedCostPerBarber.toFixed(2),
      totalCost: totalCost.toFixed(2),
      chairRevenue: chairRevenue.toFixed(2),
      profit: profit.toFixed(2),
      margin: Math.round(margin * 10) / 10,
      breakEvenCuts,
      capacity,
      saturation,
    };
  });

  // Org-level profitability totals
  const orgRevenue30d = ranking.reduce((s, r) => s + parseFloat(r.revenue), 0);
  const orgCommission30d = ranking.reduce((s, r) => s + parseFloat(r.commission), 0);
  const orgProfit30d = orgRevenue30d - orgCommission30d - totalExpenses30d;
  const orgMargin30d = orgRevenue30d > 0 ? (orgProfit30d / orgRevenue30d) * 100 : 0;

  // Monthly projection: average of last 3 full months (excluding current incomplete)
  const monthsSorted = monthlyRevRows.map((m) => ({
    month: new Date(m.month).toISOString().slice(0, 7),
    revenue: parseFloat(m.revenue),
  }));
  const currentMonth = new Date().toISOString().slice(0, 7);
  const completedMonths = monthsSorted.filter((m) => m.month !== currentMonth);
  const projection =
    completedMonths.length > 0
      ? completedMonths.reduce((s, m) => s + m.revenue, 0) / completedMonths.length
      : 0;

  // Total capacity and saturation org-wide
  const orgCapacity30d = ranking.reduce((s, r) => s + r.capacity, 0);
  const orgCompleted30d = ranking.reduce((s, r) => s + r.completed, 0);
  const orgSaturation =
    orgCapacity30d > 0 ? Math.round((orgCompleted30d / orgCapacity30d) * 100) : 0;

  // Consolidated alerts
  const alerts = [
    {
      key: "wallet_health",
      label: "Saúde da carteira",
      value: `${healthPct}%`,
      level: healthLevel,
      hint: "% de clientes ativos (visitaram nos últimos 30d)",
    },
    {
      key: "monthly_retention",
      label: "Retenção mensal",
      value: `${monthlyRetention}%`,
      level: monthlyRetention >= 50 ? "green" : monthlyRetention >= 30 ? "yellow" : "red",
      hint: "clientes do mês passado que voltaram",
    },
    {
      key: "margin",
      label: "Margem",
      value: `${Math.round(orgMargin30d * 10) / 10}%`,
      level: orgMargin30d >= 30 ? "green" : orgMargin30d >= 15 ? "yellow" : "red",
      hint: "lucro ÷ receita nos últimos 30d",
    },
    {
      key: "saturation",
      label: "Saturação das cadeiras",
      value: `${orgSaturation}%`,
      level: orgSaturation >= 70 ? "green" : orgSaturation >= 50 ? "yellow" : "red",
      hint: "atendimentos ÷ capacidade nos últimos 30d",
    },
  ];

  return NextResponse.json({
    wallet: {
      active: walletRow.active,
      retention: walletRow.retention,
      atRisk: walletRow.at_risk,
      lost: walletRow.lost,
      total,
      healthPct,
      healthLevel,
    },
    ltv: {
      averageTicket: avgTicket.toFixed(2),
      frequencyPerYear: Math.round(frequencyPerYear * 10) / 10,
      value: ltvValue.toFixed(2),
      partialData,
      operationDays,
      customerCount: ltvRow.customer_count,
    },
    retention: {
      secondVisitRate,
      loyaltyRate,
      loyalTotal: retentionRow.loyal_total,
      loyalActive: retentionRow.loyal_active,
      monthlyRetention,
      monthlyPrevCount: cohortRow.prev_count,
      monthlyReturned: cohortRow.returned,
    },
    ranking,
    profitability: {
      orgRevenue30d: orgRevenue30d.toFixed(2),
      orgCommission30d: orgCommission30d.toFixed(2),
      orgExpenses30d: totalExpenses30d.toFixed(2),
      orgUnattributedExpenses30d: unattributedExpenses30d.toFixed(2),
      orgProfit30d: orgProfit30d.toFixed(2),
      orgMargin30d: Math.round(orgMargin30d * 10) / 10,
      sharedCostPerBarber: sharedCostPerBarber.toFixed(2),
      numActiveBarbers,
    },
    production: {
      orgCompleted30d,
      orgCapacity30d,
      orgSaturation,
      projection: projection.toFixed(2),
      monthlyHistory: monthsSorted.map((m) => ({
        month: m.month,
        revenue: m.revenue.toFixed(2),
      })),
    },
    alerts,
  });
}
