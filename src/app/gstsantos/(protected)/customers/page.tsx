"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type LoyaltyTier = "novo" | "recorrente" | "fiel" | "vip";

interface CustomerListItem {
  id: string;
  phone: string;
  name: string;
  tags: string[];
  isBlocked: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  totalVisits: number;
  totalSpent: string;
  loyaltyTier: LoyaltyTier;
}

const TIER_LABELS: Record<LoyaltyTier, { label: string; color: string; bg: string }> = {
  novo: { label: "Novo", color: "#C8C2B4", bg: "rgba(200,194,180,0.12)" },
  recorrente: { label: "Recorrente", color: "#7CB9E8", bg: "rgba(124,185,232,0.12)" },
  fiel: { label: "Fiel", color: "#C9A84C", bg: "rgba(201,168,76,0.15)" },
  vip: { label: "VIP", color: "#E0BE5C", bg: "rgba(224,190,92,0.2)" },
};

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return raw;
}

function formatMoney(s: string): string {
  const n = parseFloat(s);
  if (isNaN(n)) return "R$ 0";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [tier, setTier] = useState<LoyaltyTier | null>(null);
  const [sortBy, setSortBy] = useState<"lastVisit" | "name" | "totalSpent" | "totalVisits">(
    "lastVisit",
  );
  const [items, setItems] = useState<CustomerListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    params.set("sortBy", sortBy);
    params.set("limit", "100");

    const res = await fetch(`/api/gstsantos/customers?${params.toString()}`);
    if (res.ok) {
      const data = (await res.json()) as { customers: CustomerListItem[]; total: number };
      setItems(data.customers);
      setTotal(data.total);
    }
    setLoading(false);
  }, [debouncedSearch, sortBy]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (!tier) return items;
    return items.filter((c) => c.loyaltyTier === tier);
  }, [items, tier]);

  return (
    <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F4EEDF", margin: "0 0 4px" }}>
        Clientes
      </h1>
      <p style={{ margin: "0 0 20px", color: "#8A847A", fontSize: 13 }}>
        {total} cliente{total !== 1 ? "s" : ""} no total
      </p>

      {/* Busca + Ordenação */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Buscar por nome ou telefone..."
          style={{ ...inputStyle, flex: "1 1 260px" }}
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          style={{ ...inputStyle, width: "auto" }}
        >
          <option value="lastVisit">Última visita</option>
          <option value="totalVisits">Mais cortes</option>
          <option value="totalSpent">Mais gastou</option>
          <option value="name">Nome (A-Z)</option>
        </select>
      </div>

      {/* Tier filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <FilterChip label="Todos" active={tier === null} onClick={() => setTier(null)} />
        {(Object.keys(TIER_LABELS) as LoyaltyTier[]).map((t) => (
          <FilterChip
            key={t}
            label={TIER_LABELS[t].label}
            color={TIER_LABELS[t].color}
            active={tier === t}
            onClick={() => setTier(t === tier ? null : t)}
          />
        ))}
      </div>

      {loading ? (
        <p style={{ color: "#8A847A", textAlign: "center", padding: 40 }}>Carregando...</p>
      ) : filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "#8A847A",
            border: "1px solid #2A2620",
            borderRadius: 12,
          }}
        >
          {debouncedSearch ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((c) => {
            const tierStyle = TIER_LABELS[c.loyaltyTier];
            const days = daysAgo(c.lastSeenAt);
            return (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <Link key={c.id} href={`/gstsantos/customers/${c.id}` as any} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    background: "#131211",
                    border: "1px solid #2A2620",
                    borderRadius: 12,
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    transition: "border-color 0.15s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#C9A84C44")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2A2620")}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "rgba(201,168,76,0.12)",
                      border: "1px solid rgba(201,168,76,0.3)",
                      display: "grid",
                      placeItems: "center",
                      color: "#C9A84C",
                      fontWeight: 700,
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {initials(c.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <strong style={{ color: "#F4EEDF", fontSize: 14 }}>{c.name}</strong>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 600,
                          color: tierStyle.color,
                          background: tierStyle.bg,
                          border: `1px solid ${tierStyle.color}44`,
                        }}
                      >
                        {tierStyle.label}
                      </span>
                      {c.isBlocked && (
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontSize: 10,
                            fontWeight: 600,
                            color: "#E57373",
                            background: "rgba(229,115,115,0.12)",
                          }}
                        >
                          Bloqueado
                        </span>
                      )}
                      {c.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontSize: 10,
                            color: "#8A847A",
                            border: "1px solid #2A2620",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#8A847A" }}>
                      {formatPhone(c.phone)}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, color: "#F4EEDF", fontWeight: 600 }}>
                      {c.totalVisits} corte{c.totalVisits !== 1 ? "s" : ""}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: "#8A847A" }}>
                      {formatMoney(c.totalSpent)} · {days === 0 ? "hoje" : `há ${days}d`}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: 999,
        border: `1px solid ${active ? (color ?? "#C9A84C") : "#2A2620"}`,
        background: active ? (color ?? "#C9A84C") + "20" : "transparent",
        color: active ? (color ?? "#C9A84C") : "#8A847A",
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "9px 12px",
  background: "#0B0B0B",
  border: "1px solid #2A2620",
  borderRadius: 8,
  color: "#F4EEDF",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};
