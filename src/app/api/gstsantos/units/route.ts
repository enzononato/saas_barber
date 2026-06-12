import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { services } from "@/server/db/schema/services";
import { serviceUnits, units } from "@/server/db/schema/units";
import { requireAuth } from "@/server/middleware/requireAuth";
import { resolveGoogleMapsLink } from "@/server/services/google-maps";

// Limite generoso: um JPEG ~800px comprimido em data URL fica < 300KB.
const PHOTO_MAX_CHARS = 2_000_000; // ~2MB de string

/**
 * Valida a foto da unidade. Aceita URL http(s) ou data URL de imagem.
 * Retorna a string normalizada, `null` se vazia, ou `false` se grande demais.
 */
function normalizePhotoUrl(value: unknown): string | null | false {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (s.length > PHOTO_MAX_CHARS) return false;
  if (/^https?:\/\//i.test(s) || /^data:image\//i.test(s)) return s;
  return null;
}

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
    photoUrl?: string | null;
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

  const photoUrl = normalizePhotoUrl(body.photoUrl);
  if (photoUrl === false) {
    return NextResponse.json({ error: "photo_too_large" }, { status: 413 });
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
      photoUrl: photoUrl || null,
      phone: body.phone?.trim() || null,
      position: nextPosition,
    })
    .returning();

  // A nova unidade herda todos os serviços existentes com o preço base
  // (o dono ajusta os preços por unidade depois na tela de Serviços).
  const orgServices = await db
    .select({ id: services.id, price: services.price, isActive: services.isActive })
    .from(services)
    .where(eq(services.organizationId, ctx.orgId));
  if (orgServices.length > 0) {
    await db
      .insert(serviceUnits)
      .values(
        orgServices.map((s) => ({
          serviceId: s.id,
          unitId: created.id,
          price: s.price,
          isActive: s.isActive,
        })),
      )
      .onConflictDoNothing({ target: [serviceUnits.serviceId, serviceUnits.unitId] });
  }

  return NextResponse.json(created, { status: 201 });
}
