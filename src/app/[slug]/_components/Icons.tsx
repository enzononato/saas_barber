import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function Razor(p: IconProps) {
  return (
    <svg {...base} strokeWidth="1.5" {...p}>
      <path d="M3 21l6-6" />
      <path d="M9 15l3-3 6 6-3 3a2 2 0 0 1-3 0l-3-3a2 2 0 0 1 0-3z" />
      <path d="M12 12l9-9" />
    </svg>
  );
}

export function Scissors(p: IconProps) {
  return (
    <svg {...base} strokeWidth="1.5" {...p}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}

export function Check(p: IconProps) {
  return (
    <svg {...base} strokeWidth="2.5" {...p}>
      <polyline points="5 12 10 17 19 7" />
    </svg>
  );
}

export function ArrowRight(p: IconProps) {
  return (
    <svg {...base} strokeWidth="1.8" {...p}>
      <line x1="4" y1="12" x2="20" y2="12" />
      <polyline points="14 6 20 12 14 18" />
    </svg>
  );
}

export function ArrowLeft(p: IconProps) {
  return (
    <svg {...base} strokeWidth="1.8" {...p}>
      <line x1="20" y1="12" x2="4" y2="12" />
      <polyline points="10 6 4 12 10 18" />
    </svg>
  );
}

export function Close(p: IconProps) {
  return (
    <svg {...base} strokeWidth="1.8" {...p}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

export function Calendar(p: IconProps) {
  return (
    <svg {...base} strokeWidth="1.5" {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  );
}

export function Phone(p: IconProps) {
  return (
    <svg {...base} strokeWidth="1.5" {...p}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export function Pin(p: IconProps) {
  return (
    <svg {...base} strokeWidth="1.5" {...p}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function Clock(p: IconProps) {
  return (
    <svg {...base} strokeWidth="1.5" {...p}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

export function Star(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" />
    </svg>
  );
}
