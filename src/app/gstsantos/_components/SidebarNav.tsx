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

  const linkStyle = (href: string): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 16px",
    borderRadius: 8,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: isActive(href) ? 600 : 400,
    color: isActive(href) ? "#C9A84C" : "#C8C2B4",
    background: isActive(href) ? "rgba(201,168,76,0.08)" : "transparent",
    transition: "all 0.15s",
    cursor: "pointer",
  });

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        style={{
          width: 220,
          borderRight: "1px solid #2A2620",
          display: "flex",
          flexDirection: "column",
          padding: "24px 12px",
          position: "sticky",
          top: 0,
          height: "100dvh",
        }}
        className="gst-sidebar"
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: "1px solid #C9A84C",
              borderRadius: "50%",
              display: "inline-grid",
              placeItems: "center",
              color: "#C9A84C",
              fontSize: 18,
              fontStyle: "italic",
              fontFamily: "Georgia, serif",
            }}
          >
            S
          </div>
          <p
            style={{
              color: "#8A847A",
              fontSize: 10,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              margin: "8px 0 0",
            }}
          >
            Santos Studios
          </p>
        </div>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <Link key={item.href} href={item.href as any} style={linkStyle(item.href)}>
                <Icon size={17} strokeWidth={isActive(item.href) ? 2.2 : 1.7} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            background: "transparent",
            color: "#8A847A",
            fontSize: 14,
            cursor: "pointer",
            width: "100%",
            textAlign: "left",
          }}
        >
          <LogOut size={17} strokeWidth={1.7} />
          Sair
        </button>
      </aside>

      {/* Mobile bottom nav */}
      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(19,18,17,0.92)",
          backdropFilter: "blur(16px) saturate(1.3)",
          WebkitBackdropFilter: "blur(16px) saturate(1.3)",
          borderTop: "1px solid #2A2620",
          display: "flex",
          justifyContent: "space-around",
          padding: "6px 0 calc(6px + env(safe-area-inset-bottom))",
          zIndex: 50,
        }}
        className="gst-bottom-nav"
      >
        {items.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <Link
              key={item.href}
              href={item.href as any}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                minWidth: 52,
                minHeight: 48,
                padding: "4px 8px",
                borderRadius: 10,
                color: active ? "#C9A84C" : "#8A847A",
                background: active ? "rgba(201,168,76,0.08)" : "transparent",
                textDecoration: "none",
                fontSize: 10,
                transition: "all 0.15s",
              }}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.7} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <style>{`
        @media (min-width: 768px) {
          .gst-bottom-nav { display: none !important; }
        }
        @media (max-width: 767px) {
          .gst-sidebar { display: none !important; }
        }
      `}</style>
    </>
  );
}
