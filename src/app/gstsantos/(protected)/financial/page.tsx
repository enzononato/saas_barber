"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type Period = "day" | "week" | "month";

interface DayEntry { day: string; revenue: string; count: number }
interface ServiceEntry { name: string; revenue: string; count: number }
interface BarberEntry { professionalId: string; professionalName: string; revenue: string; count: number }

interface FinancialData {
  period: string;
  date: string;
  total: string;
  count: number;
  daily: DayEntry[];
  byService: ServiceEntry[];
  byBarber: BarberEntry[] | null;
}

const COLORS = ["#C9A84C", "#8E6A24", "#E0BE5C", "#6B4F1A", "#F4EEDF"];

function fmtR$(v: string | number) {
  return `R$ ${parseFloat(String(v)).toFixed(2).replace(".", ",")}`;
}

export default function FinancialPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/gstsantos/financial?period=${period}&date=${date}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [period, date]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  return (
    <div style={{ padding: "24px 20px", maxWidth: 1100, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F4EEDF", margin: 0 }}>
          Financeiro
        </h1>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["day", "week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: `1px solid ${period === p ? "#C9A84C" : "#2A2620"}`,
                background: period === p ? "rgba(201,168,76,0.12)" : "transparent",
                color: period === p ? "#C9A84C" : "#8A847A",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {p === "day" ? "Dia" : p === "week" ? "Semana" : "Mês"}
            </button>
          ))}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              padding: "6px 12px",
              background: "#131211",
              border: "1px solid #2A2620",
              borderRadius: 8,
              color: "#F4EEDF",
              fontSize: 13,
            }}
          />
        </div>
      </div>

      {loading || !data ? (
        <p style={{ color: "#8A847A" }}>Carregando...</p>
      ) : (
        <>
          {/* KPIs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 12,
              marginBottom: 28,
            }}
          >
            <KpiCard label="Receita total" value={fmtR$(data.total)} />
            <KpiCard label="Atendimentos" value={String(data.count)} />
            <KpiCard
              label="Ticket médio"
              value={data.count > 0 ? fmtR$(parseFloat(data.total) / data.count) : "—"}
            />
          </div>

          {/* Revenue line chart */}
          {data.daily.length > 0 && (
            <Section title="Receita por dia">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.daily.map((d) => ({ ...d, r: parseFloat(d.revenue) }))}>
                  <XAxis
                    dataKey="day"
                    tickFormatter={(v) => v.slice(5)}
                    stroke="#3A3630"
                    tick={{ fill: "#8A847A", fontSize: 11 }}
                  />
                  <YAxis
                    stroke="#3A3630"
                    tick={{ fill: "#8A847A", fontSize: 11 }}
                    tickFormatter={(v) => `R$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#131211",
                      border: "1px solid #2A2620",
                      borderRadius: 8,
                      color: "#F4EEDF",
                    }}
                    formatter={(v) => [fmtR$(Number(v ?? 0)), "Receita"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="r"
                    stroke="#C9A84C"
                    strokeWidth={2}
                    dot={{ fill: "#C9A84C", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Section>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 20,
              marginTop: 20,
            }}
          >
            {/* Services donut */}
            {data.byService.length > 0 && (
              <Section title="Por serviço">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={data.byService.map((s) => ({
                        name: s.name,
                        value: parseFloat(s.revenue),
                      }))}
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {data.byService.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#131211",
                        border: "1px solid #2A2620",
                        borderRadius: 8,
                        color: "#F4EEDF",
                      }}
                      formatter={(v) => [fmtR$(Number(v ?? 0)), "Receita"]}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => (
                        <span style={{ color: "#C8C2B4", fontSize: 12 }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Section>
            )}

            {/* By barber table */}
            {data.byBarber && data.byBarber.length > 0 && (
              <Section title="Por barbeiro">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={th}>Barbeiro</th>
                      <th style={{ ...th, textAlign: "right" }}>Atend.</th>
                      <th style={{ ...th, textAlign: "right" }}>Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byBarber.map((b) => (
                      <tr key={b.professionalId}>
                        <td style={td}>{b.professionalName}</td>
                        <td style={{ ...td, textAlign: "right", color: "#8A847A" }}>{b.count}</td>
                        <td style={{ ...td, textAlign: "right", color: "#C9A84C", fontWeight: 600 }}>
                          {fmtR$(b.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#131211",
        border: "1px solid #2A2620",
        borderRadius: 12,
        padding: "16px 20px",
      }}
    >
      <p style={{ margin: "0 0 6px", fontSize: 11, color: "#8A847A", textTransform: "uppercase", letterSpacing: "0.15em" }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#C9A84C" }}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#131211",
        border: "1px solid #2A2620",
        borderRadius: 12,
        padding: "16px 20px",
      }}
    >
      <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "#C8C2B4" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 0",
  color: "#8A847A",
  fontWeight: 500,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  borderBottom: "1px solid #2A2620",
};

const td: React.CSSProperties = {
  padding: "8px 0",
  color: "#C8C2B4",
  borderBottom: "1px solid #1E1C1A",
};
