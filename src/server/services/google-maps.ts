/**
 * Resolve um link do Google Maps (curto ou longo) e extrai coordenadas + nome.
 *
 * Suporta:
 *   - Links curtos: https://maps.app.goo.gl/XXXX  (resolvidos via redirect)
 *   - Links curtos legados: https://goo.gl/maps/XXXX
 *   - Links longos: https://www.google.com/maps/place/Nome/@lat,lng,17z/...!3d<lat>!4d<lng>
 *
 * As coordenadas do marcador (`!3d<lat>!4d<lng>`) são preferidas sobre o centro
 * do mapa (`@lat,lng`), pois apontam o ponto exato do estabelecimento.
 */

export interface ResolvedPlace {
  lat: number;
  lng: number;
  /** Nome do estabelecimento extraído do segmento /place/, se disponível. */
  name: string | null;
  /** URL final após resolver redirects (para referência/depuração). */
  resolvedUrl: string;
}

const MARKER_RE = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/;
const CENTER_RE = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
const QUERY_RE = /[?&](?:q|query|destination)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
const PLACE_RE = /\/place\/([^/@]+)/;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function isValidLat(n: number) {
  return Number.isFinite(n) && n >= -90 && n <= 90;
}
function isValidLng(n: number) {
  return Number.isFinite(n) && n >= -180 && n <= 180;
}

/** Extrai lat/lng de uma URL já textual (sem rede). Retorna null se não achar. */
export function parseLatLngFromUrl(url: string): { lat: number; lng: number } | null {
  for (const re of [MARKER_RE, CENTER_RE, QUERY_RE]) {
    const m = url.match(re);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (isValidLat(lat) && isValidLng(lng)) return { lat, lng };
    }
  }
  return null;
}

function parsePlaceName(url: string): string | null {
  const m = url.match(PLACE_RE);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1].replace(/\+/g, " ")).trim() || null;
  } catch {
    return m[1].replace(/\+/g, " ").trim() || null;
  }
}

function isGoogleMapsLink(url: string): boolean {
  return /(?:google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.)/i.test(
    url,
  );
}

/**
 * Resolve o link e extrai os dados. Faz no máximo uma requisição de rede
 * (para expandir links curtos). Lança Error com mensagem amigável em PT-BR.
 */
export async function resolveGoogleMapsLink(rawLink: string): Promise<ResolvedPlace> {
  const link = rawLink.trim();
  if (!link) throw new Error("Cole o link do Google Maps.");
  if (!/^https?:\/\//i.test(link)) {
    throw new Error("O link precisa começar com http(s)://");
  }
  if (!isGoogleMapsLink(link)) {
    throw new Error("Esse link não parece ser do Google Maps.");
  }

  // 1. Tenta extrair direto (caso o usuário cole a URL longa já com coordenadas).
  const direct = parseLatLngFromUrl(link);
  if (direct) {
    return {
      ...direct,
      name: parsePlaceName(link),
      resolvedUrl: link,
    };
  }

  // 2. Link curto: resolve o redirect para obter a URL longa com coordenadas.
  let resolvedUrl = link;
  try {
    const res = await fetch(link, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": BROWSER_UA, "Accept-Language": "pt-BR,pt;q=0.9" },
      signal: AbortSignal.timeout(10_000),
    });
    resolvedUrl = res.url || link;

    let coords = parseLatLngFromUrl(resolvedUrl);

    // 3. Fallback: alguns redirects param numa página de consentimento;
    //    nesse caso as coordenadas costumam estar no corpo HTML.
    if (!coords) {
      const body = await res.text();
      coords = parseLatLngFromUrl(body);
      if (coords && !parsePlaceName(resolvedUrl)) {
        const nameFromBody = parsePlaceName(body);
        if (nameFromBody) {
          return { ...coords, name: nameFromBody, resolvedUrl };
        }
      }
    }

    if (!coords) {
      throw new Error(
        "Não consegui encontrar as coordenadas nesse link. Abra o local no Google Maps e copie o link de compartilhamento.",
      );
    }

    return {
      ...coords,
      name: parsePlaceName(resolvedUrl),
      resolvedUrl,
    };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Não consegui")) throw err;
    throw new Error(
      "Não consegui abrir esse link do Google Maps. Verifique o link e tente novamente.",
    );
  }
}
