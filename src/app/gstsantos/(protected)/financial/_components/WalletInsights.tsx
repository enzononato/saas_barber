"use client";

import { AlertTriangle, Info } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

export interface WalletData {
  active: number;
  retention: number;
  atRisk: number;
  lost: number;
  total: number;
  healthPct: number;
  healthLevel: "green" | "yellow" | "red";
}

export interface LtvData {
  averageTicket: string;
  frequencyPerYear: number;
  value: string;
  partialData: boolean;
  operationDays: number;
  customerCount: number;
}

export interface RetentionData {
  secondVisitRate: number;
  loyaltyRate: number;
  loyalTotal: number;
  loyalActive: number;
  monthlyRetention: number;
  monthlyPrevCount: number;
  monthlyReturned: number;
}

interface Props {
  wallet: WalletData;
  ltv: LtvData;
  retention: RetentionData;
}

const STATUS_COLORS = {
  active: "#4CAF50",
  retention: "#C9A84C",
  atRisk: "#E0BE5C",
  lost: "#E57373",
};

const HEALTH_BADGE: Record<
  WalletData["healthLevel"],
  { label: string; color: string; bg: string }
> = {
  green: { label: "Saudável", color: "#4CAF50", bg: "rgba(76,175,80,0.12)" },
  yellow: { label: "Atenção", color: "#E0BE5C", bg: "rgba(224,190,92,0.12)" },
  red: { label: "Crítica", color: "#E57373", bg: "rgba(229,115,115,0.12)" },
};

function fmtR$(v: string | number) {
  return `R$ ${parseFloat(String(v)).toFixed(2).replace(".", ",")}`;
}

export function WalletInsights({ wallet, ltv, retention }: Props) {
  const lowSample = ltv.customerCount < 10;
  const pieData = [
    { name: "Ativos", value: wallet.active, color: STATUS_COLORS.active },
    { name: "Em Retenção", value: wallet.retention, color: STATUS_COLORS.retention },
    { name: "Em Risco", value: wallet.atRisk, color: STATUS_COLORS.atRisk },
    { name: "Perdidos", value: wallet.lost, color: STATUS_COLORS.lost },
  ].filter((d) => d.value > 0);

  const badge = HEALTH_BADGE[wallet.healthLevel];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {lowSample && (
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(229,115,115,0.08)",
            border: "1px solid rgba(229,115,115,0.3)",
            borderRadius: 10,
            color: "#E0BE5C",
            fontSize: 12,
          }}
        >
          <AlertTriangle size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
          Poucos dados ({ltv.customerCount} clientes). Os indicadores ficam mais confiáveis a
          partir de 10+ clientes com histórico.
        </div>
      )}

      {/* Wallet — donut + status counts + health badge */}
      <Section title="Status da carteira">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 280px) 1fr",
            gap: 24,
            alignItems: "center",
          }}
        >
          {/* Donut */}
          <div style={{ position: "relative", height: 200 }}>
            {wallet.total > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {pieData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#131211",
                        border: "1px solid #2A2620",
                        borderRadius: 8,
                        color: "#F4EEDF",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    pointerEvents: "none",
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <p style={{ margin: 0, color: "#8A847A", fontSize: 11 }}>Total</p>
                    <p
                      style={{
                        margin: 0,
                        color: "#F4EEDF",
                        fontSize: 28,
                        fontWeight: 700,
                      }}
                    >
                      {wallet.total}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                  color: "#3A3630",
                  fontSize: 13,
                }}
              >
                Sem clientes cadastrados.
              </div>
            )}
          </div>

          {/* Status legend + health */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <StatusLine
              label="Ativos"
              hint="visitou nos últimos 30 dias"
              count={wallet.active}
              total={wallet.total}
              color={STATUS_COLORS.active}
            />
            <StatusLine
              label="Em Retenção"
              hint="31 a 60 dias sem visita"
              count={wallet.retention}
              total={wallet.total}
              color={STATUS_COLORS.retention}
            />
            <StatusLine
              label="Em Risco"
              hint="61 a 90 dias sem visita"
              count={wallet.atRisk}
              total={wallet.total}
              color={STATUS_COLORS.atRisk}
            />
            <StatusLine
              label="Perdidos"
              hint="mais de 90 dias sem visita"
              count={wallet.lost}
              total={wallet.total}
              color={STATUS_COLORS.lost}
            />

            <div
              style={{
                marginTop: 8,
                padding: "10px 14px",
                background: badge.bg,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: badge.color,
                }}
              />
              <div>
                <p
                  style={{
                    margin: 0,
                    color: badge.color,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Saúde {badge.label} — {wallet.healthPct}% ativos
                </p>
                <p style={{ margin: 0, color: "#8A847A", fontSize: 11 }}>
                  Verde ≥ 40% · Amarelo 25–40% · Vermelho &lt; 25%
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* LTV */}
      <Section
        title="LTV — Valor do cliente ao longo do tempo"
        badge={ltv.partialData && ltv.operationDays > 0 ? "Dados parciais" : undefined}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <KpiCard
            label="LTV estimado"
            value={fmtR$(ltv.value)}
            sub="ticket médio × frequência anual"
            accent="#C9A84C"
          />
          <KpiCard label="Ticket médio" value={fmtR$(ltv.averageTicket)} />
          <KpiCard
            label="Frequência anual"
            value={`${ltv.frequencyPerYear.toFixed(1)} visitas`}
            sub="estimativa por cliente / ano"
          />
          <KpiCard
            label="Histórico"
            value={ltv.operationDays > 0 ? `${ltv.operationDays}d` : "—"}
            sub={ltv.operationDays > 0 ? `${ltv.customerCount} clientes únicos` : "Sem atendimentos"}
          />
        </div>
        {ltv.partialData && ltv.operationDays > 0 && (
          <p style={{ margin: "12px 0 0", fontSize: 11, color: "#8A847A", fontStyle: "italic" }}>
            <Info size={12} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} />
            Frequência anual extrapolada a partir de {ltv.operationDays} dias de histórico. Os
            valores se estabilizam após 1 ano de operação.
          </p>
        )}
      </Section>

      {/* Retention */}
      <Section title="Retenção e fidelização">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <KpiCard
            label="Taxa de 2ª visita"
            value={`${retention.secondVisitRate}%`}
            sub="clientes que voltaram pelo menos 1 vez"
          />
          <KpiCard
            label="Taxa de fidelização"
            value={`${retention.loyaltyRate}%`}
            sub="clientes com 5+ atendimentos"
          />
          <KpiCard
            label="Fiéis ativos"
            value={`${retention.loyalActive} / ${retention.loyalTotal}`}
            sub="fiéis que visitaram nos últimos 30d"
          />
          <KpiCard
            label="Retenção mensal"
            value={`${retention.monthlyRetention}%`}
            sub={
              retention.monthlyPrevCount > 0
                ? `${retention.monthlyReturned} de ${retention.monthlyPrevCount} voltaram`
                : "sem cohort anterior"
            }
          />
        </div>
      </Section>
    </div>
  );
}

function StatusLine({
  label,
  hint,
  count,
  total,
  color,
}: {
  label: string;
  hint: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
        <span style={{ color: "#F4EEDF", fontWeight: 600, fontSize: 13 }}>{label}</span>
        <span style={{ color: "#8A847A", fontSize: 11 }}>{hint}</span>
        <span style={{ marginLeft: "auto", color, fontSize: 13, fontWeight: 700 }}>
          {count} <span style={{ color: "#8A847A", fontWeight: 400 }}>({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div
        style={{
          height: 4,
          background: "#1E1C1A",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            transition: "width 0.3s",
          }}
        />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent = "#C9A84C",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="gst-kpi" style={{ padding: "14px 16px" }}>
      <p className="k-label" style={{ margin: "0 0 4px" }}>
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 21,
          fontWeight: 700,
          fontFamily: "'Playfair Display', serif",
          color: accent,
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#8A847A" }}>{sub}</p>
      )}
    </div>
  );
}

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="gst-card" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 600,
            color: "#C9A84C",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </p>
        {badge && (
          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 999,
              background: "rgba(224,190,92,0.15)",
              color: "#E0BE5C",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
