"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface BeforeAfterProps {
  before: ReactNode;
  after: ReactNode;
  beforeLabel?: string;
  afterLabel?: string;
  caption?: string;
  idx?: number;
  initial?: number;
}

export function BeforeAfter({
  before,
  after,
  beforeLabel = "Antes",
  afterLabel = "Depois",
  caption,
  idx,
  initial = 50,
}: BeforeAfterProps) {
  const [pos, setPos] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateFromX = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
      if (cx == null) return;
      updateFromX(cx);
    };
    const onUp = () => {
      setDragging(false);
      setShowHint(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
    window.addEventListener("touchcancel", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchcancel", onUp);
    };
  }, [dragging]);

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    setDragging(true);
    setShowHint(false);
    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    if (cx != null) updateFromX(cx);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); setPos((p) => Math.max(0, p - 4)); }
    if (e.key === "ArrowRight") { e.preventDefault(); setPos((p) => Math.min(100, p + 4)); }
  };

  return (
    <div
      ref={containerRef}
      className={`ba ${dragging ? "dragging" : ""} ${showHint ? "hint-on" : ""}`}
      style={{ "--pos": pos + "%" } as React.CSSProperties}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
      role="slider"
      aria-label={`${beforeLabel} versus ${afterLabel}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos)}
      tabIndex={0}
      onKeyDown={handleKey}
    >
      <div className="ba-pane before">{before}</div>
      <div className="ba-pane after">{after}</div>

      <span className="ba-tag l">{beforeLabel}</span>
      <span className="ba-tag r">{afterLabel}</span>

      {caption && (
        <div className="ba-cap">
          {idx != null && <span className="idx">{String(idx).padStart(2, "0")}</span>}
          <span>{caption}</span>
        </div>
      )}

      <div className="ba-divider" />
      <button
        type="button"
        className="ba-knob"
        aria-hidden="true"
        tabIndex={-1}
        onMouseDown={(e) => { e.stopPropagation(); handleStart(e); }}
        onTouchStart={(e) => { e.stopPropagation(); handleStart(e); }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 6 4 12 9 18" />
          <polyline points="15 6 20 12 15 18" />
        </svg>
      </button>
    </div>
  );
}

export function BeforeArt({ variant = "head" }: { variant?: "head" | "beard" | "taper" }) {
  if (variant === "head") {
    return (
      <div className="ba-art">
        <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M55 78 Q50 40 100 32 Q150 36 148 78 Q156 70 158 80 L155 100 Q160 92 158 105 L150 118 Q156 112 152 120" strokeWidth="1.5" />
          <ellipse cx="100" cy="92" rx="42" ry="50" />
          <path d="M70 130 Q75 168 100 175 Q125 168 130 130 Q128 145 120 158 Q110 168 100 170 Q90 168 80 158 Q72 145 70 130 Z" />
          <path d="M40 200 L40 175 Q70 158 100 158 Q130 158 160 175 L160 200" />
          <path d="M60 60 L55 50 M65 50 L62 38 M75 42 L73 30 M125 42 L127 30 M135 50 L138 38 M140 60 L145 50" strokeWidth="1" opacity="0.7" />
        </svg>
      </div>
    );
  }
  if (variant === "beard") {
    return (
      <div className="ba-art">
        <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="100" cy="80" rx="36" ry="40" />
          <path d="M70 110 Q60 150 100 178 Q140 150 130 110 Q140 125 142 145 Q138 165 125 175 Q110 182 100 182 Q90 182 75 175 Q62 165 58 145 Q60 125 70 110 Z" />
          <path d="M55 130 L48 145 M60 150 L52 168 M145 130 L152 145 M140 150 L148 168" strokeWidth="0.8" opacity="0.6" />
        </svg>
      </div>
    );
  }
  return (
    <div className="ba-art">
      <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M58 70 Q55 30 100 28 Q145 30 142 70 L148 110 L52 110 Z" />
        <ellipse cx="100" cy="100" rx="40" ry="46" />
        <path d="M65 80 L60 60 M75 70 L72 50 M100 60 L100 42 M125 70 L128 50 M135 80 L140 60" strokeWidth="0.8" opacity="0.5" />
        <path d="M40 200 L40 175 Q70 158 100 158 Q130 158 160 175 L160 200" />
      </svg>
    </div>
  );
}

export function AfterArt({ variant = "head" }: { variant?: "head" | "beard" | "taper" }) {
  if (variant === "head") {
    return (
      <div className="ba-art">
        <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M62 75 Q66 50 100 46 Q134 50 138 75" strokeWidth="2" />
          <ellipse cx="100" cy="92" rx="38" ry="48" />
          <path d="M72 128 Q78 152 100 162 Q122 152 128 128" />
          <line x1="118" y1="58" x2="116" y2="80" strokeWidth="0.8" opacity="0.5" />
          <path d="M40 200 L40 178 Q70 162 100 162 Q130 162 160 178 L160 200" />
          <path d="M85 165 L100 178 L115 165" strokeWidth="1" opacity="0.6" />
        </svg>
      </div>
    );
  }
  if (variant === "beard") {
    return (
      <div className="ba-art">
        <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="100" cy="80" rx="36" ry="40" />
          <path d="M70 110 Q75 145 100 155 Q125 145 130 110" strokeWidth="2" />
          <path d="M80 130 L80 122 M120 130 L120 122 M100 130 L100 138" strokeWidth="0.8" opacity="0.5" />
        </svg>
      </div>
    );
  }
  return (
    <div className="ba-art">
      <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M58 80 L58 110 L142 110 L142 80" strokeWidth="0.6" opacity="0.4" />
        <path d="M62 78 Q66 48 100 44 Q134 48 138 78" strokeWidth="2.2" />
        <ellipse cx="100" cy="100" rx="40" ry="46" />
        <path d="M40 200 L40 178 Q70 162 100 162 Q130 162 160 178 L160 200" />
        <path d="M85 165 L100 178 L115 165" strokeWidth="1" opacity="0.6" />
      </svg>
    </div>
  );
}
