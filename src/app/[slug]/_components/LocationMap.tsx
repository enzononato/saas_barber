"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export interface MapUnit {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone?: string | null;
  googleMapsUrl?: string | null;
}

interface LocationMapProps {
  units: MapUnit[];
  /** Unidade destacada (sincroniza com a lista de unidades). */
  activeId?: string | null;
  /** Disparado ao clicar num marcador. */
  onSelect?: (id: string) => void;
}

// Marcador de versão do código — confirma que o novo build está rodando.
const BUILD_TAG = "map-diag-v4";

// Basemap dark gratuito do Carto — não exige API key.
const DARK_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export function LocationMap({ units, activeId, onSelect }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Estado de diagnóstico visível na própria caixa do mapa.
  const [diag, setDiag] = useState<string[]>([`${BUILD_TAG} · montado`]);
  const [ready, setReady] = useState(false);
  const log = (line: string) =>
    setDiag((prev) => [...prev.slice(-7), line]);

  // Apenas unidades com coordenadas válidas entram no mapa.
  const geo = units.filter(
    (u): u is MapUnit & { lat: number; lng: number } =>
      u.lat != null && u.lng != null,
  ) as Array<MapUnit & { lat: number; lng: number }>;

  // Inicializa o mapa uma vez e plota os marcadores.
  useEffect(() => {
    const container = containerRef.current;
    log(`geo=${geo.length} · container=${container ? "ok" : "null"}`);
    if (!container || geo.length === 0) return;

    let map: maplibregl.Map | null = null;
    let cancelled = false;
    let raf = 0;
    let tries = 0;

    // Cria o mapa só quando o container já tem dimensões reais.
    // Sem isso o MapLibre inicializa com 0×0 e nunca desenha (tela preta).
    const init = () => {
      if (cancelled) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) {
        tries += 1;
        if (tries === 1 || tries % 30 === 0) log(`aguardando tamanho… ${w}×${h} (${tries})`);
        if (tries > 300) {
          log(`ABORT: container 0×0 após ${tries} tentativas`);
          return;
        }
        raf = requestAnimationFrame(init);
        return;
      }

      log(`criando mapa · ${w}×${h}`);

      try {
        map = new maplibregl.Map({
          container,
          style: DARK_STYLE,
          center: [geo[0].lng, geo[0].lat],
          zoom: 14,
          attributionControl: { compact: true },
          pitchWithRotate: false,
          dragRotate: false,
        });
      } catch (err) {
        log(`ERRO ao criar: ${(err as Error).message}`);
        return;
      }
      mapRef.current = map;
      log(`mapa criado · esperando style…`);

      map.on("error", (e) => {
        const msg = (e?.error as Error | undefined)?.message ?? String(e);
        log(`maplibre error: ${msg}`);
        console.error("[LocationMap] maplibre error:", e?.error ?? e);
      });

      map.on("load", () => {
        log(`style carregado ✓`);
        map?.resize();
        setReady(true);
      });

      map.on("styledata", () => log(`styledata`));

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "bottom-right",
      );

      for (const u of geo) {
        // Wrapper: dot em cima + label em baixo (âncora no topo do wrapper)
        const el = document.createElement("div");
        el.className = "gst-map-pin-wrap";
        el.setAttribute("data-unit", u.id);

        const dot = document.createElement("div");
        dot.className = "gst-map-pin";
        el.appendChild(dot);

        const labelEl = document.createElement("div");
        labelEl.className = "gst-map-pin-label";
        labelEl.textContent = u.name;
        el.appendChild(labelEl);

        const popupHtml = `
          <div class="gst-map-popup">
            ${u.address ? `<span>${escapeHtml(u.address)}</span>` : ""}
            <a href="${escapeHtml(u.googleMapsUrl ?? `https://www.google.com/maps/dir/?api=1&destination=${u.lat},${u.lng}`)}" target="_blank" rel="noopener noreferrer">Como chegar →</a>
          </div>`;
        const popup = new maplibregl.Popup({ offset: 30, closeButton: false }).setHTML(popupHtml);

        const marker = new maplibregl.Marker({ element: el, anchor: "top" })
          .setLngLat([u.lng, u.lat])
          .setPopup(popup)
          .addTo(map);

        dot.addEventListener("click", () => onSelectRef.current?.(u.id));
        markersRef.current.set(u.id, marker);
      }
      log(`${markersRef.current.size} marcador(es) adicionado(s)`);

      // Enquadra todas as unidades.
      if (geo.length === 1) {
        map.setCenter([geo[0].lng, geo[0].lat]);
        map.setZoom(15);
      } else {
        const bounds = new maplibregl.LngLatBounds();
        geo.forEach((u) => bounds.extend([u.lng, u.lat]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 });
      }
    };

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      markersRef.current.clear();
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units.map((u) => u.id).join(",")]);

  // Voa até a unidade destacada e marca visualmente o pin ativo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker, id) => {
      const dot = marker.getElement().querySelector(".gst-map-pin");
      dot?.classList.toggle("on", id === activeId);
    });
    if (activeId) {
      const u = geo.find((g) => g.id === activeId);
      if (u) map.flyTo({ center: [u.lng, u.lat], zoom: 15, duration: 700 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  if (geo.length === 0) {
    return (
      <div className="gst-map" style={{ display: "grid", placeItems: "center" }}>
        <span style={{ color: "var(--paper-mute)", fontSize: 13 }}>
          Localização em breve
        </span>
      </div>
    );
  }

  return (
    <div className="gst-map">
      <div ref={containerRef} className="gst-map-canvas" />
      {/* Painel de diagnóstico — sai quando o mapa fica pronto. */}
      {!ready && (
        <div
          style={{
            position: "absolute",
            inset: 12,
            zIndex: 5,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            gap: 2,
            padding: 12,
            borderRadius: 10,
            background: "rgba(0,0,0,0.55)",
            border: "1px solid rgba(201,168,76,0.25)",
            font: "11px/1.5 'JetBrains Mono', monospace",
            color: "#C9A84C",
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          {diag.map((line, i) => (
            <div key={i} style={{ opacity: i === diag.length - 1 ? 1 : 0.6 }}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
