import { and, desc, eq, gte, lte } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { expenses } from "@/server/db/schema/expenses";
import { requireAuth } from "@/server/middleware/requireAuth";

export async function GET(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const conditions = [eq(expenses.organizationId, ctx.orgId)];
  if (from) conditions.push(gte(expenses.date, from));
  if (to) conditions.push(lte(expenses.date, to));

  const rows = await db
    .select({
      id: expenses.id,
      description: expenses.description,
      category: expenses.category,
      amount: expenses.amount,
      date: expenses.date,
      isRecurring: expenses.isRecurring,
      attributedToUserId: expenses.attributedToUserId,
      createdAt: expenses.createdAt,
    })
    .from(expenses)
    .where(and(...conditions))
    .orderBy(desc(expenses.date), desc(expenses.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const { description, category, amount, date, isRecurring, attributedToUserId } = body as {
    description?: string;
    category?: string | null;
    amount?: number | string;
    date?: string;
    isRecurring?: boolean;
    attributedToUserId?: string | null;
  };

  if (!description || amount === undefined || amount === null || !date) {
    return NextResponse.json(
      { error: "description, amount and date are required" },
      { status: 400 },
    );
  }

  const amountNum = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(amountNum) || amountNum < 0) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }

  const [created] = await db
    .insert(expenses)
    .values({
      organizationId: ctx.orgId,
      description,
      category: category && category.trim() ? category.trim() : null,
      amount: amountNum.toFixed(2),
      date,
      isRecurring: Boolean(isRecurring),
      attributedToUserId: attributedToUserId && attributedToUserId.trim() ? attributedToUserId : null,
      createdByUserId: ctx.userId,
    })
    .returning({
      id: expenses.id,
      description: expenses.description,
      category: expenses.category,
      amount: expenses.amount,
      date: expenses.date,
      isRecurring: expenses.isRecurring,
      attributedToUserId: expenses.attributedToUserId,
      createdAt: expenses.createdAt,
    });

  return NextResponse.json(created, { status: 201 });
}
