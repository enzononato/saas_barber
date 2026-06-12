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
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Apenas unidades com coordenadas válidas entram no mapa.
  const geo = units.filter(
    (u): u is MapUnit & { lat: number; lng: number } =>
      u.lat != null && u.lng != null,
  ) as Array<MapUnit & { lat: number; lng: number }>;

  // Inicializa o mapa uma vez e plota os marcadores.
  useEffect(() => {
    if (!containerRef.current || geo.length === 0) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_STYLE,
      center: [geo[0].lng, geo[0].lat],
      zoom: 14,
      attributionControl: { compact: true },
      pitchWithRotate: false,
      dragRotate: false,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.resize();

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

    // Enquadra todas as unidades.
    if (geo.length === 1) {
      map.setCenter([geo[0].lng, geo[0].lat]);
      map.setZoom(15);
    } else {
      const bounds = new maplibregl.LngLatBounds();
      geo.forEach((u) => bounds.extend([u.lng, u.lat]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 });
    }

    map.on("load", () => map.resize());

    return () => {
      markersRef.current.clear();
      map.remove();
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
