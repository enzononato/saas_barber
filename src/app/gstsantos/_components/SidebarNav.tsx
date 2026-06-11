"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createAuthClient } from "better-auth/client";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarClock,
  DollarSign,
  LogOut,
  MessageCircle,
  Package,
  Scissors,
  UserRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const authClient = createAuthClient({ baseURL: typeof window !== "undefined" ? window.location.origin : "" });

type NavItem = { href: string; label: string; icon: LucideIcon };

interface Props {
  role: "owner" | "member" | "receptionist";
  canManageBarbers: boolean;
  isBarber: boolean;
}

export function SidebarNav({ role, canManageBarbers, isBarber }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const items: NavItem[] = [
    { href: "/gstsantos/agenda", label: "Agenda", icon: CalendarDays },
    { href: "/gstsantos/customers", label: "Clientes", icon: Users },
    { href: "/gstsantos/financial", label: "Financeiro", icon: DollarSign },
    // Recepcionista não gerencia serviços nem tem agenda própria
    ...(role !== "receptionist"
      ? [{ href: "/gstsantos/services", label: "Serviços", icon: Scissors }]
      : []),
    ...(isBarber
      ? [{ href: "/gstsantos/schedule", label: "Minha Agenda", icon: CalendarClock }]
      : []),
    ...(canManageBarbers
      ? [{ href: "/gstsantos/barbers", label: "Equipe", icon: UserRound }]
      : []),
    ...(role === "owner"
      ? [
          { href: "/gstsantos/products", label: "Produtos", icon: Package },
          { href: "/gstsantos/whatsapp", label: "WhatsApp", icon: MessageCircle },
        ]
      : []),
  ];

  async function handleLogout() {
    await authClient.signOut();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.replace("/gstsantos/login" as any);
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="gst-sidebar">
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <div className="gst-side-mark">S</div>
          <p
            style={{
              color: "#8A847A",
              fontSize: 9.5,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              fontFamily: "'JetBrains Mono', monospace",
              margin: "10px 0 0",
            }}
          >
            Santos Studios
          </p>
        </div>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <Link
                key={item.href}
                href={item.href as any}
                className={`gst-side-link${active ? " on" : ""}`}
              >
                <Icon size={17} strokeWidth={active ? 2.2 : 1.7} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button onClick={handleLogout} className="gst-side-link gst-side-logout">
          <LogOut size={17} strokeWidth={1.7} />
          Sair
        </button>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="gst-bottom-nav">
        {items.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <Link
              key={item.href}
              href={item.href as any}
              className={`gst-bnav-link${active ? " on" : ""}`}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.7} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <style>{`
        .gst-sidebar {
          width: 224px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          padding: 26px 12px 18px;
          position: sticky;
          top: 0;
          height: 100dvh;
          border-right: 1px solid rgba(201,168,76,0.1);
          background: linear-gradient(180deg, rgba(244,238,223,0.025), rgba(244,238,223,0.004) 30%);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }
        .gst-side-mark {
          width: 44px;
          height: 44px;
          border: 1px solid #C9A84C;
          border-radius: 50%;
          display: inline-grid;
          place-items: center;
          color: #C9A84C;
          font-size: 19px;
          font-style: italic;
          font-family: 'Playfair Display', Georgia, serif;
          box-shadow: 0 0 24px -8px rgba(201,168,76,0.5), inset 0 0 0 1px rgba(255,255,255,0.04);
        }
        .gst-side-link {
          position: relative;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 11px 14px;
          border-radius: 10px;
          text-decoration: none;
          font-size: 14px;
          font-weight: 400;
          color: #C8C2B4;
          background: transparent;
          border: none;
          width: 100%;
          text-align: left;
          cursor: pointer;
          font-family: inherit;
          transition: color .2s cubic-bezier(.2,.7,.2,1), background .2s cubic-bezier(.2,.7,.2,1), transform .2s cubic-bezier(.2,.7,.2,1);
        }
        .gst-side-link:hover:not(.on) {
          color: #F4EEDF;
          background: rgba(244,238,223,0.04);
          transform: translateX(2px);
        }
        .gst-side-link.on {
          color: #C9A84C;
          font-weight: 600;
          background: linear-gradient(90deg, rgba(201,168,76,0.13), rgba(201,168,76,0.04));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .gst-side-link.on::before {
          content: "";
          position: absolute;
          left: 0;
          top: 22%;
          bottom: 22%;
          width: 3px;
          border-radius: 999px;
          background: linear-gradient(180deg, #E8C870, #C9A84C);
          box-shadow: 0 0 10px rgba(201,168,76,0.6);
          animation: gstPillIn .25s cubic-bezier(.2,.7,.2,1);
        }
        @keyframes gstPillIn { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        .gst-side-logout { color: #8A847A; margin-top: 8px; }
        .gst-side-logout:hover { color: #E76A5A !important; background: rgba(231,106,90,0.06) !important; }

        .gst-bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(180deg, rgba(19,18,17,0.82), rgba(11,11,11,0.96));
          backdrop-filter: blur(18px) saturate(1.35);
          -webkit-backdrop-filter: blur(18px) saturate(1.35);
          border-top: 1px solid rgba(201,168,76,0.14);
          display: flex;
          justify-content: space-around;
          padding: 6px 0 calc(6px + env(safe-area-inset-bottom));
          z-index: 50;
        }
        .gst-bnav-link {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          min-width: 56px;
          min-height: 48px;
          padding: 5px 8px;
          border-radius: 12px;
          color: #8A847A;
          text-decoration: none;
          font-size: 10px;
          transition: color .2s, background .2s, transform .15s;
        }
        .gst-bnav-link:active { transform: scale(0.92); }
        .gst-bnav-link.on {
          color: #C9A84C;
          background: linear-gradient(180deg, rgba(201,168,76,0.14), rgba(201,168,76,0.05));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }
        @media (min-width: 768px) {
          .gst-bottom-nav { display: none !important; }
        }
        @media (max-width: 767px) {
          .gst-sidebar { display: none !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .gst-side-link, .gst-bnav-link { transition: none; }
          .gst-side-link.on::before { animation: none; }
        }
      `}</style>
    </>
  );
}
