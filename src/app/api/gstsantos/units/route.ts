import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { units } from "@/server/db/schema/units";
import { requireAuth } from "@/server/middleware/requireAuth";
import { resolveGoogleMapsLink } from "@/server/services/google-maps";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Gera um slug único dentro da organização (acrescenta -2, -3… se colidir). */
async function uniqueSlug(orgId: string, base: string): Promise<string | null> {
  const root = slugify(base);
  if (!root) return null;
  const existing = await db
    .select({ slug: units.slug })
    .from(units)
    .where(eq(units.organizationId, orgId));
  const taken = new Set(existing.map((u) => u.slug).filter(Boolean));
  if (!taken.has(root)) return root;
  for (let i = 2; i < 100; i++) {
    const candidate = `${root}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return null;
}

export async function GET() {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(units)
    .where(eq(units.organizationId, ctx.orgId))
    .orderBy(asc(units.position), asc(units.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    name?: string;
    googleMapsUrl?: string;
    address?: string;
    lat?: number;
    lng?: number;
    phone?: string;
  };

  let { lat, lng } = body;
  let resolvedName: string | null = null;

  // Se veio link do Maps sem coordenadas, resolve.
  if (body.googleMapsUrl && (lat === undefined || lng === undefined)) {
    try {
      const place = await resolveGoogleMapsLink(body.googleMapsUrl);
      lat = place.lat;
      lng = place.lng;
      resolvedName = place.name;
    } catch (err) {
      return NextResponse.json(
        { error: "maps_resolve_failed", message: (err as Error).message },
        { status: 422 },
      );
    }
  }

  const name = (body.name ?? resolvedName ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }

  // Próxima posição (no fim da lista).
  const positionRows = await db
    .select({ position: units.position })
    .from(units)
    .where(eq(units.organizationId, ctx.orgId))
    .orderBy(asc(units.position));
  const nextPosition =
    positionRows.length > 0 ? positionRows[positionRows.length - 1].position + 1 : 0;

  const [created] = await db
    .insert(units)
    .values({
      organizationId: ctx.orgId,
      name,
      slug: await uniqueSlug(ctx.orgId, name),
      address: body.address?.trim() || null,
      lat: lat ?? null,
      lng: lng ?? null,
      googleMapsUrl: body.googleMapsUrl?.trim() || null,
      phone: body.phone?.trim() || null,
      position: nextPosition,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
