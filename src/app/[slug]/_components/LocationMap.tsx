"use client";

import { useEffect, useRef } from "react";
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
  photoUrl?: string | null;
}

interface LocationMapProps {
  units: MapUnit[];
  /** Unidade destacada (sincroniza com a lista de unidades). */
  activeId?: string | null;
  /** Disparado ao clicar num marcador. */
  onSelect?: (id: string) => void;
}

// Basemap dark gratuito do Carto — não exige API key.
const DARK_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export function LocationMap({ units, activeId, onSelect }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const roRef = useRef<ResizeObserver | null>(null);
  const didFlyRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Apenas unidades com coordenadas válidas entram no mapa.
  const geo = units.filter(
    (u): u is MapUnit & { lat: number; lng: number } =>
      u.lat != null && u.lng != null,
  ) as Array<MapUnit & { lat: number; lng: number }>;

  // Inicializa o mapa uma vez e plota os marcadores.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || geo.length === 0) return;

    let map: maplibregl.Map | null = null;
    let cancelled = false;
    let raf = 0;

    // Cria o mapa só quando o container já tem dimensões reais.
    // Sem isso o MapLibre inicializa com 0×0 e nunca desenha (tela preta).
    const init = () => {
      if (cancelled) return;
      if (container.clientWidth === 0 || container.clientHeight === 0) {
        raf = requestAnimationFrame(init);
        return;
      }

      map = new maplibregl.Map({
        container,
        style: DARK_STYLE,
        center: [geo[0].lng, geo[0].lat],
        zoom: 14,
        attributionControl: { compact: true },
        pitchWithRotate: false,
        dragRotate: false,
      });
      mapRef.current = map;

      map.on("error", (e) => {
        console.error("[LocationMap] maplibre error:", e?.error ?? e);
      });

      map.on("load", () => {
        const m = mapRef.current;
        if (!m) return;
        m.resize();
        // Resizes adiados cobrem o fim da animação de reveal (transform/opacity),
        // que pode deixar o canvas WebGL preto se medido cedo demais.
        const bump = (ms: number) =>
          window.setTimeout(() => {
            if (cancelled || !mapRef.current) return;
            mapRef.current.resize();
            mapRef.current.triggerRepaint();
          }, ms);
        bump(150);
        bump(450);
        bump(900);
      });

      // Repinta sempre que o container muda de tamanho (reveal, resize de janela).
      const ro = new ResizeObserver(() => {
        if (cancelled || !mapRef.current) return;
        mapRef.current.resize();
      });
      ro.observe(container);
      roRef.current = ro;

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

        const popup = new maplibregl.Popup({
          offset: 30,
          closeButton: false,
          maxWidth: "260px",
          className: "gst-map-popup-wrap",
        }).setHTML(popupHtml(u));

        const marker = new maplibregl.Marker({ element: el, anchor: "top" })
          .setLngLat([u.lng, u.lat])
          .setPopup(popup)
          .addTo(map);

        dot.addEventListener("click", () => onSelectRef.current?.(u.id));
        markersRef.current.set(u.id, marker);
      }

      // Enquadra todas as unidades na primeira visão.
      if (geo.length === 1) {
        map.setCenter([geo[0].lng, geo[0].lat]);
        map.setZoom(15);
      } else {
        const bounds = new maplibregl.LngLatBounds();
        geo.forEach((u) => bounds.extend([u.lng, u.lat]));
        map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 0 });
      }
    };

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      roRef.current?.disconnect();
      roRef.current = null;
      markersRef.current.clear();
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units.map((u) => u.id).join(",")]);

  // Destaca o pin ativo. Só voa até a unidade quando o usuário a seleciona —
  // na primeira montagem mantém o enquadramento de todas as unidades.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker, id) => {
      const dot = marker.getElement().querySelector(".gst-map-pin");
      dot?.classList.toggle("on", id === activeId);
    });
    if (!didFlyRef.current) {
      didFlyRef.current = true;
      return; // pula o voo inicial — preserva o fitBounds
    }
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
    </div>
  );
}

/** HTML do popup do marcador — foto (ou banner) + endereço + link de rota. */
function popupHtml(u: MapUnit & { lat: number; lng: number }): string {
  const href =
    u.googleMapsUrl ??
    `https://www.google.com/maps/dir/?api=1&destination=${u.lat},${u.lng}`;
  const initial = escapeHtml(u.name.trim().charAt(0).toUpperCase() || "•");
  const banner = u.photoUrl
    ? `<div class="gst-map-popup-banner">
         <img src="${escapeHtml(u.photoUrl)}" alt="${escapeHtml(u.name)}" loading="lazy" />
       </div>`
    : `<div class="gst-map-popup-banner gst-map-popup-banner--mono">
         <span class="gst-map-popup-mono">${initial}</span>
       </div>`;
  return `
    <div class="gst-map-popup">
      ${banner}
      <div class="gst-map-popup-body">
        <strong>${escapeHtml(u.name)}</strong>
        ${u.address ? `<span>${escapeHtml(u.address)}</span>` : ""}
        <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">Como chegar →</a>
      </div>
    </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
