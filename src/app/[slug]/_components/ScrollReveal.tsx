"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";

export function useReveal(opts: { threshold?: number; rootMargin?: string; once?: boolean } = {}) {
  const { threshold = 0.15, rootMargin = "0px 0px -8% 0px", once = true } = opts;
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            if (once) obs.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        });
      },
      { threshold, rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return [ref, visible] as const;
}

interface RevealProps {
  children: ReactNode;
  delay?: number;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  kind?: "up" | "fade" | "rise" | "left" | "right" | "scale";
  [key: string]: unknown;
}

export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
  style = {},
  kind = "up",
  ...rest
}: RevealProps) {
  const [ref, visible] = useReveal();
  const baseClass = `rv rv-${kind} ${visible ? "in" : ""} ${className}`.trim();
  return (
    <Tag
      ref={ref}
      className={baseClass}
      style={{ ...style, transitionDelay: visible ? `${delay}ms` : "0ms" }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
