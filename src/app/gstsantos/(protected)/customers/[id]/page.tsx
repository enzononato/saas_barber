"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type LoyaltyTier = "novo" | "recorrente" | "fiel" | "vip";

interface Customer {
  id: string;
  phone: string;
  name: string;
  notes: string | null;
  tags: string[];
  isBlocked: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface Analytics {
  totalAppointments: number;
  completedCount: number;
  canceledCount: number;
  noShowCount: number;
  scheduledCount: number;
  totalSpent: string;
  noShowRate: number;
  avgFrequencyDays: number | null;
  lastAppointmentAt: string | null;
  nextAppointmentAt: string | null;
  topProfessionals: Array<{ id: string; name: string; count: number }>;
  topServices: Array<{ name: string; count: number }>;
  preferredHourBucket: "manha" | "tarde" | "noite" | null;
  preferredWeekday: number | null;
  monthlyCounts: Array<{ month: string; count: number }>;
  loyaltyTier: LoyaltyTier;
}

interface Appointment {
  id: string;
  professionalId: string;
  professionalName: string;
  serviceNameAtBooking: string;
  startsAt: string;
  endsAt: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
  priceAtBooking: string;
  notes: string | null;
}

interface Me {
  id: string;
  role: "owner" | "member";
}

const TIER_LABELS: Record<LoyaltyTier, { label: string; color: string; bg: string }> = {
  novo: { label: "Novo", color: "#C8C2B4", bg: "rgba(200,194,180,0.12)" },
  recorrente: { label: "Recorrente", color: "#7CB9E8", bg: "rgba(124,185,232,0.12)" },
  fiel: { label: "Fiel", color: "#C9A84C", bg: "rgba(201,168,76,0.15)" },
  vip: { label: "VIP", color: "#E0BE5C", bg: "rgba(224,190,92,0.2)" },
};

const STATUS_LABEL: Record<Appointment["status"], { label: string; color: string }> = {
  SCHEDULED: { label: "Agendado", color: "#7CB9E8" },
  COMPLETED: { label: "Concluído", color: "#C9A84C" },
  CANCELED: { label: "Cancelado", color: "#8A847A" },
  NO_SHOW: { label: "Faltou", color: "#E57373" },
};

const WEEKDAY = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [me, setMe] = useState<Me | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Editing state
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [meRes, custRes, apptRes] = await Promise.all([
      fetch("/api/gstsantos/me"),
      fetch(`/api/gstsantos/customers/${id}`),
      fetch(`/api/gstsantos/customers/${id}/appointments?limit=100`),
    ]);

    if (meRes.ok) setMe(await meRes.json());

    if (custRes.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    if (custRes.ok) {
      const data = (await custRes.json()) as { customer: Customer; analytics: Analytics };
      setCustomer(data.customer);
      setAnalytics(data.analytics);
      setNotesDraft(data.customer.notes ?? "");
    }
    if (apptRes.ok) {
      const data = (await apptRes.json()) as { appointments: Appointment[] };
      setAppointments(data.appointments);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function patchCustomer(body: Partial<{ name: string; notes: string | null; tags: string[]; isBlocked: boolean }>) {
    const res = await fetch(`/api/gstsantos/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  }

  async function saveNotes() {
    if (!customer || notesDraft === (customer.notes ?? "")) return;
    setSavingNotes(true);
    const ok = await patchCustomer({ notes: notesDraft || null });
    setSavingNotes(false);
    if (ok) {
      setCustomer({ ...customer, notes: notesDraft });
      showToast("Nota salva", true);
    } else {
      showToast("Erro ao salvar nota", false);
    }
  }

  async function addTag() {
    const tag = tagInput.trim();
    if (!tag || !customer || customer.tags.includes(tag)) {
      setTagInput("");
      return;
    }
    const newTags = [...customer.tags, tag];
    const ok = await patchCustomer({ tags: newTags });
    if (ok) {
      setCustomer({ ...customer, tags: newTags });
      setTagInput("");
    }
  }

  async function removeTag(tag: string) {
    if (!customer) return;
    const newTags = customer.tags.filter((t) => t !== tag);
    const ok = await patchCustomer({ tags: newTags });
    if (ok) setCustomer({ ...customer, tags: newTags });
  }

  async function toggleBlock() {
    if (!customer) return;
    const action = customer.isBlocked ? "Desbloquear" : "Bloquear";
    if (!confirm(`${action} este cliente?`)) return;
    const ok = await patchCustomer({ isBlocked: !customer.isBlocked });
    if (ok) {
      setCustomer({ ...customer, isBlocked: !customer.isBlocked });
      showToast(customer.isBlocked ? "Cliente desbloqueado" : "Cliente bloqueado", true);
    }
  }

  if (loading) {
    return (
      <div className="gst-page" style={{ maxWidth: 900 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <div className="gst-skel" style={{ height: 80, maxWidth: 420 }} />
          <div className="gst-skel" style={{ height: 110 }} />
          <div className="gst-skel" style={{ height: 200, opacity: 0.6 }} />
        </div>
      </div>
    );
  }

  if (notFound || !customer || !analytics) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#8A847A" }}>Cliente não encontrado.</p>
        <button onClick={() => router.back()} style={ghostBtn}>
          Voltar
        </button>
      </div>
    );
  }

  const tier = TIER_LABELS[analytics.loyaltyTier];
  const isOwner = me?.role === "owner";

  return (
    <div className="gst-page" style={{ maxWidth: 900 }}>
      {/* Voltar */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        href={"/gstsantos/customers" as any}
        style={{ color: "#8A847A", fontSize: 13, textDecoration: "none", display: "inline-block", marginBottom: 16, transition: "color .2s" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#C9A84C")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#8A847A")}
      >
        ← Clientes
      </Link>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(201,168,76,0.12)",
            border: "1px solid rgba(201,168,76,0.3)",
            display: "grid",
            placeItems: "center",
            color: "#C9A84C",
            fontWeight: 700,
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          {initials(customer.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#F4EEDF" }}>
              {customer.name}
            </h1>
            <span
              style={{
                padding: "2px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                color: tier.color,
                background: tier.bg,
                border: `1px solid ${tier.color}44`,
              }}
            >
              {tier.label}
            </span>
            {customer.isBlocked && (
              <span
                style={{
                  padding: "2px 10px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#E57373",
                  background: "rgba(229,115,115,0.12)",
                }}
              >
                Bloqueado
              </span>
            )}
          </div>
          <p style={{ margin: "4px 0 0", color: "#8A847A", fontSize: 13 }}>
            {formatPhone(customer.phone)} · Cliente desde {new Date(customer.firstSeenAt).toLocaleDateString("pt-BR")}
          </p>
        </div>
        {isOwner && (
          <button onClick={() => void toggleBlock()} style={customer.isBlocked ? primaryBtn : ghostBtn}>
            {customer.isBlocked ? "Desbloquear" : "Bloquear"}
          </button>
        )}
      </div>

      {/* Tags */}
      {isOwner && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {customer.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  color: "#C8C2B4",
                  border: "1px solid #2A2620",
                  background: "#131211",
                }}
              >
                {tag}
                <button
                  onClick={() => void removeTag(tag)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#8A847A",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addTag();
                }
              }}
              placeholder="+ tag"
              style={{
                padding: "4px 10px",
                background: "transparent",
                border: "1px dashed #2A2620",
                borderRadius: 999,
                color: "#C8C2B4",
                fontSize: 12,
                outline: "none",
                width: 80,
              }}
            />
          </div>
        </div>
      )}

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 24,
        }}
      >
        <KpiCard label="Cortes" value={String(analytics.completedCount)} />
        <KpiCard label="Total gasto" value={formatMoney(analytics.totalSpent)} />
        <KpiCard
          label="Frequência"
          value={analytics.avgFrequencyDays ? `${analytics.avgFrequencyDays}d` : "—"}
          sub="entre cortes"
        />
        <KpiCard
          label="Taxa de faltas"
          value={`${Math.round(analytics.noShowRate * 100)}%`}
          accent={analytics.noShowRate > 0.2 ? "#E57373" : undefined}
        />
        <KpiCard label="Status" value={tier.label} accent={tier.color} />
      </div>

      {/* Próximo agendamento */}
      {analytics.nextAppointmentAt && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            background: "rgba(124,185,232,0.08)",
            border: "1px solid rgba(124,185,232,0.3)",
            color: "#7CB9E8",
            fontSize: 13,
            marginBottom: 24,
          }}
        >
          📅 Próximo agendamento: {formatDateTime(analytics.nextAppointmentAt)}
        </div>
      )}

      {/* Análises */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Section title="Barbeiro favorito">
          {analytics.topProfessionals.length === 0 ? (
            <p style={emptyStyle}>Nenhum corte registrado</p>
          ) : (
            <RankList items={analytics.topProfessionals.map((p) => ({ label: p.name, count: p.count }))} />
          )}
        </Section>

        <Section title="Serviço favorito">
          {analytics.topServices.length === 0 ? (
            <p style={emptyStyle}>—</p>
          ) : (
            <RankList items={analytics.topServices.map((s) => ({ label: s.name, count: s.count }))} />
          )}
        </Section>

        <Section title="Preferências">
          <p style={{ margin: "4px 0", color: "#C8C2B4", fontSize: 13 }}>
            <strong>Horário:</strong>{" "}
            {analytics.preferredHourBucket === "manha"
              ? "Manhã"
              : analytics.preferredHourBucket === "tarde"
                ? "Tarde"
                : analytics.preferredHourBucket === "noite"
                  ? "Noite"
                  : "—"}
          </p>
          <p style={{ margin: "4px 0", color: "#C8C2B4", fontSize: 13 }}>
            <strong>Dia da semana:</strong>{" "}
            {analytics.preferredWeekday !== null ? WEEKDAY[analytics.preferredWeekday] : "—"}
          </p>
        </Section>

        {analytics.monthlyCounts.length > 0 && (
          <Section title="Frequência mensal">
            <div style={{ width: "100%", height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.monthlyCounts}>
                  <XAxis dataKey="month" stroke="#8A847A" fontSize={10} />
                  <YAxis stroke="#8A847A" fontSize={10} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#131211",
                      border: "1px solid #2A2620",
                      borderRadius: 8,
                      color: "#F4EEDF",
                    }}
                  />
                  <Line type="monotone" dataKey="count" stroke="#C9A84C" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>
        )}
      </div>

      {/* Notas privadas (owner only) */}
      {isOwner && (
        <Section title="Notas privadas">
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={() => void saveNotes()}
            placeholder="Observações sobre este cliente (visível só pra você)..."
            rows={4}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "#0B0B0B",
              border: "1px solid #2A2620",
              borderRadius: 8,
              color: "#F4EEDF",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
          {savingNotes && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#8A847A" }}>Salvando...</p>}
        </Section>
      )}

      {/* Histórico */}
      <Section title={`Histórico (${appointments.length})`}>
        {appointments.length === 0 ? (
          <p style={emptyStyle}>Sem agendamentos</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {appointments.map((a) => {
              const st = STATUS_LABEL[a.status];
              return (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "#0B0B0B",
                    border: "1px solid #2A2620",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, color: "#F4EEDF", fontWeight: 500 }}>
                      {a.serviceNameAtBooking}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#8A847A" }}>
                      {formatDateTime(a.startsAt)} · {a.professionalName}
                    </p>
                  </div>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 600,
                      color: st.color,
                      background: `${st.color}22`,
                      border: `1px solid ${st.color}44`,
                    }}
                  >
                    {st.label}
                  </span>
                  <span style={{ fontSize: 12, color: "#C8C2B4", minWidth: 64, textAlign: "right" }}>
                    {formatMoney(a.priceAtBooking)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 100,
            left: "50%",
            transform: "translateX(-50%)",
            background: toast.ok ? "rgba(124,185,232,0.15)" : "rgba(229,115,115,0.15)",
            border: `1px solid ${toast.ok ? "#7CB9E8" : "#E57373"}`,
            color: toast.ok ? "#7CB9E8" : "#E57373",
            padding: "10px 18px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            zIndex: 100,
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="gst-kpi" style={{ padding: "14px 16px" }}>
      <p className="k-label" style={{ margin: 0 }}>
        {label}
      </p>
      <p
        style={{
          margin: "5px 0 0",
          fontSize: 19,
          fontWeight: 700,
          fontFamily: "'Playfair Display', serif",
          color: accent ?? "#F4EEDF",
        }}
      >
        {value}
      </p>
      {sub && <p style={{ margin: "2px 0 0", fontSize: 10, color: "#8A847A" }}>{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="gst-card" style={{ padding: 16, marginBottom: 12 }}>
      <h2
        style={{
          margin: "0 0 12px",
          fontSize: 11,
          fontWeight: 600,
          color: "#C9A84C",
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function RankList({ items }: { items: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item) => (
        <div key={item.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#C8C2B4" }}>
            <span>{item.label}</span>
            <span style={{ color: "#8A847A" }}>{item.count}×</span>
          </div>
          <div
            style={{
              height: 4,
              background: "#0B0B0B",
              borderRadius: 999,
              marginTop: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(item.count / max) * 100}%`,
                background: "linear-gradient(90deg, #E8C870, #C9A84C)",
                borderRadius: 999,
                boxShadow: "0 0 8px rgba(201,168,76,0.4)",
                transition: "width .6s cubic-bezier(.2,.7,.2,1)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const emptyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#8A847A",
  fontStyle: "italic",
};

const primaryBtn: React.CSSProperties = {
  padding: "8px 16px",
  background: "linear-gradient(180deg,#E0BE5C,#C9A84C 48%,#8E6A24)",
  color: "#1A1408",
  fontWeight: 700,
  fontSize: 12,
  border: "none",
  borderRadius: 999,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 14px",
  background: "transparent",
  border: "1px solid #2A2620",
  borderRadius: 999,
  color: "#C8C2B4",
  fontSize: 12,
  cursor: "pointer",
};
