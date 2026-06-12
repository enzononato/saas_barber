import { NextResponse } from "next/server";

import { requireAuth } from "@/server/middleware/requireAuth";
import { resolveGoogleMapsLink } from "@/server/services/google-maps";

/**
 * Resolve um link do Google Maps e devolve nome + coordenadas, para preview
 * na tela de cadastro de unidade antes de salvar.
 */
export async function POST(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { url } = (await req.json()) as { url?: string };
  if (!url) return NextResponse.json({ error: "url_required" }, { status: 400 });

  try {
    const place = await resolveGoogleMapsLink(url);
    return NextResponse.json({
      lat: place.lat,
      lng: place.lng,
      name: place.name,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "maps_resolve_failed", message: (err as Error).message },
      { status: 422 },
    );
  }
}
