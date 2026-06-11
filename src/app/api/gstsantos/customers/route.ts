import { NextResponse } from "next/server";

import { requireAuth } from "@/server/middleware/requireAuth";
import { listCustomers } from "@/server/services/customers";

export async function GET(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? undefined;
  const tag = searchParams.get("tag") ?? undefined;
  const sortByParam = searchParams.get("sortBy") ?? undefined;
  const limit = parseInt(searchParams.get("limit") ?? "30", 10);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const sortBy =
    sortByParam === "name" ||
    sortByParam === "totalSpent" ||
    sortByParam === "totalVisits" ||
    sortByParam === "lastVisit"
      ? sortByParam
      : "lastVisit";

  // Barbeiro comum: vê só os clientes que atendeu. Owner e recepcionista veem todos.
  const scopeUserId = ctx.role === "member" ? ctx.userId : undefined;

  const result = await listCustomers({
    orgId: ctx.orgId,
    search,
    tag,
    sortBy,
    limit,
    offset,
    scopeUserId,
  });

  return NextResponse.json(result);
}
