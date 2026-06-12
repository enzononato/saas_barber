import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { appointments } from "@/server/db/schema/appointments";
import { units } from "@/server/db/schema/units";
import { requireAuth } from "@/server/middleware/requireAuth";
import { resolveGoogleMapsLink } from "@/server/services/google-maps";

const PHOTO_MAX_CHARS = 2_000_000; // ~2MB de string (URL ou data URL base64)

/** URL http(s) ou data URL de imagem; `null` se vazio; `false` se grande demais. */
function normalizePhotoUrl(value: unknown): string | null | false {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (s.length > PHOTO_MAX_CHARS) return false;
  if (/^https?:\/\//i.test(s) || /^data:image\//i.test(s)) return s;
  return null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  const patch: Partial<{
    name: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
    googleMapsUrl: string | null;
    photoUrl: string | null;
    phone: string | null;
    isActive: boolean;
    position: number;
  }> = {};

  if ("name" in body) patch.name = String(body.name).trim();
  if ("address" in body) patch.address = (body.address as string)?.trim() || null;
  if ("phone" in body) patch.phone = (body.phone as string)?.trim() || null;
  if ("isActive" in body) patch.isActive = Boolean(body.isActive);
  if ("position" in body) patch.position = Number(body.position);
  if ("lat" in body) patch.lat = body.lat === null ? null : Number(body.lat);
  if ("lng" in body) patch.lng = body.lng === null ? null : Number(body.lng);
  if ("photoUrl" in body) {
    const photo = normalizePhotoUrl(body.photoUrl);
    if (photo === false) {
      return NextResponse.json({ error: "photo_too_large" }, { status: 413 });
    }
    patch.photoUrl = photo;
  }

  // Se o link do Maps mudou e não vieram lat/lng explícitos, re-resolve.
  if ("googleMapsUrl" in body) {
    const url = (body.googleMapsUrl as string)?.trim() || null;
    patch.googleMapsUrl = url;
    if (url && !("lat" in body) && !("lng" in body)) {
      try {
        const place = await resolveGoogleMapsLink(url);
        patch.lat = place.lat;
        patch.lng = place.lng;
      } catch (err) {
        return NextResponse.json(
          { error: "maps_resolve_failed", message: (err as Error).message },
          { status: 422 },
        );
      }
    }
  }

  if (patch.name !== undefined && !patch.name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const [updated] = await db
    .update(units)
    .set(patch)
    .where(and(eq(units.id, id), eq(units.organizationId, ctx.orgId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Garante que a unidade pertence à org.
  const [unit] = await db
    .select({ id: units.id })
    .from(units)
    .where(and(eq(units.id, id), eq(units.organizationId, ctx.orgId)))
    .limit(1);
  if (!unit) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Agendamentos referenciam a unidade com ON DELETE RESTRICT — bloqueia exclusão
  // se houver histórico. O dono deve desativar (isActive=false) em vez de excluir.
  const [appt] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(eq(appointments.unitId, id))
    .limit(1);
  if (appt) {
    return NextResponse.json(
      { error: "has_appointments" },
      { status: 409 },
    );
  }

  await db.delete(units).where(eq(units.id, id));
  return NextResponse.json({ ok: true });
}
