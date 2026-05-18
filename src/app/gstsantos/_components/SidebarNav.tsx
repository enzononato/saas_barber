"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createAuthClient } from "better-auth/client";
import { useRouter } from "next/navigation";

const authClient = createAuthClient({ baseURL: typeof window !== "undefined" ? window.location.origin : "" });

const NAV_ITEMS = [
  { href: "/gstsantos/agenda", label: "Agenda", icon: "📅" },
  { href: "/gstsantos/financial", label: "Financeiro", icon: "💰" },
  { href: "/gstsantos/services", label: "Serviços", icon: "✂️" },
  { href: "/gstsantos/schedule", label: "Minha Agenda", icon: "🗓" },
];

interface Props {
  role: "owner" | "member";
  canManageBarbers: boolean;
}

export function SidebarNav({ role, canManageBarbers }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const items = [
    ...NAV_ITEMS,
    ...(canManageBarbers
      ? [{ href: "/gstsantos/barbers", label: "Barbeiros", icon: "👤" }]
      : []),
  ];

  async function handleLogout() {
    await authClient.signOut();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.replace("/gstsantos/login" as any);
  }

  const linkStyle = (href: string): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 16px",
    borderRadius: 8,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: pathname === href || pathname.startsWith(href) ? 600 : 400,
    color: pathname === href || pathname.startsWith(href) ? "#C9A84C" : "#C8C2B4",
    background:
      pathname === href || pathname.startsWith(href)
        ? "rgba(201,168,76,0.08)"
        : "transparent",
    transition: "all 0.15s",
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
          {items.map((item) => (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <Link key={item.href} href={item.href as any} style={linkStyle(item.href)}>
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
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
          <span>🚪</span>
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
          background: "#131211",
          borderTop: "1px solid #2A2620",
          display: "flex",
          justifyContent: "space-around",
          padding: "8px 0 calc(8px + env(safe-area-inset-bottom))",
          zIndex: 50,
        }}
        className="gst-bottom-nav"
      >
        {items.map((item) => (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <Link
            key={item.href}
            href={item.href as any}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "4px 8px",
              color:
                pathname === item.href || pathname.startsWith(item.href)
                  ? "#C9A84C"
                  : "#8A847A",
              textDecoration: "none",
              fontSize: 10,
            }}
          >
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
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
