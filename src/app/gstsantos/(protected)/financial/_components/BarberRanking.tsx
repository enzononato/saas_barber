"use client";

import { useState } from "react";

export interface RankingEntry {
  id: string;
  name: string;
  revenue: string;
  completed: number;
  missed: number;
  averageTicket: string;
  completedRate: number;
  commission: string;
  attributedCost: string;
  sharedCost: string;
  totalCost: string;
  chairRevenue: string;
  profit: string;
  margin: number;
  breakEvenCuts: number;
  capacity: number;
  saturation: number;
}

interface Props {
  ranking: RankingEntry[];
}

const MEDALS = ["🥇", "🥈", "🥉"];

function fmtR$(v: string | number) {
  return `R$ ${parseFloat(String(v)).toFixed(2).replace(".", ",")}`;
}

export function BarberRanking({ ranking }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (ranking.length === 0) {
    return (
      <div
        style={{
          background: "#131211",
          border: "1px solid #2A2620",
          borderRadius: 12,
          padding: "40px 20px",
          textAlign: "center",
          color: "#8A847A",
          fontSize: 13,
        }}
      >
        Nenhum atendimento registrado nos últimos 30 dias.
      </div>
    );
  }

  const topRevenue = parseFloat(ranking[0]?.revenue ?? "0");

  return (
    <div
      style={{
        background: "#131211",
        border: "1px solid #2A2620",
        borderRadius: 12,
        padding: "18px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#C8C2B4" }}>
          Ranking dos últimos 30 dias
        </p>
        <span
          style={{
            fontSize: 10,
            padding: "2px 8px",
            borderRadius: 999,
            background: "rgba(201,168,76,0.15)",
            color: "#C9A84C",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {ranking.length} barbeiro{ranking.length === 1 ? "" : "s"}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ranking.map((b, i) => {
          const revenue = parseFloat(b.revenue);
          const widthPct = topRevenue > 0 ? (revenue / topRevenue) * 100 : 0;
          const medal = MEDALS[i] ?? `${i + 1}º`;
          const rateColor =
            b.completedRate >= 85 ? "#4CAF50" : b.completedRate >= 70 ? "#E0BE5C" : "#E57373";
          const profitValue = parseFloat(b.profit);
          const profitColor = profitValue >= 0 ? "#4CAF50" : "#E57373";
          const isExpanded = expanded === b.id;

          return (
            <div
              key={b.id}
              style={{
                padding: "14px 16px",
                background: "#0B0B0B",
                border: "1px solid #2A2620",
                borderRadius: 10,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {/* Top line */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: i < 3 ? 22 : 14,
                    fontWeight: 700,
                    color: i < 3 ? "#C9A84C" : "#8A847A",
                    minWidth: 32,
                    textAlign: "center",
                  }}
                >
                  {medal}
                </span>
                <span
                  style={{
                    flex: 1,
                    color: "#F4EEDF",
                    fontSize: 15,
                    fontWeight: 600,
                    minWidth: 120,
                  }}
                >
                  {b.name}
                </span>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, color: "#C9A84C", fontSize: 17, fontWeight: 700 }}>
                    {fmtR$(b.revenue)}
                  </p>
                  <p style={{ margin: 0, color: profitColor, fontSize: 11, fontWeight: 600 }}>
                    Lucro: {fmtR$(b.profit)}
                  </p>
                </div>
              </div>

              {/* Revenue bar */}
              <div
                style={{
                  height: 6,
                  background: "#1E1C1A",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${widthPct}%`,
                    height: "100%",
                    background: "linear-gradient(90deg,#8E6A24,#C9A84C 60%,#E0BE5C)",
                    transition: "width 0.4s",
                  }}
                />
              </div>

              {/* Quick metrics */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: 12,
                  paddingTop: 4,
                }}
              >
                <Metric label="Concluídos" value={String(b.completed)} />
                <Metric label="Ticket médio" value={fmtR$(b.averageTicket)} />
                <Metric
                  label="Conclusão"
                  value={`${b.completedRate}%`}
                  color={rateColor}
                />
                <Metric
                  label="Saturação"
                  value={`${b.saturation}%`}
                  color={
                    b.saturation >= 70 ? "#4CAF50" : b.saturation >= 50 ? "#E0BE5C" : "#E57373"
                  }
                />
              </div>

              {/* Toggle */}
              <button
                onClick={() => setExpanded(isExpanded ? null : b.id)}
                style={{
                  background: "transparent",
                  border: "1px solid #2A2620",
                  borderRadius: 6,
                  padding: "5px 12px",
                  color: "#8A847A",
                  fontSize: 11,
                  cursor: "pointer",
                  alignSelf: "flex-start",
                }}
              >
                {isExpanded ? "Esconder detalhes" : "Ver lucro e break-even"}
              </button>

              {isExpanded && (
                <div
                  style={{
                    background: "#131211",
                    border: "1px solid #2A2620",
                    borderRadius: 8,
                    padding: "12px 14px",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: 12,
                  }}
                >
                  <Metric label="Receita bruta" value={fmtR$(b.revenue)} />
                  <Metric label="Comissão paga" value={fmtR$(b.commission)} color="#E0BE5C" />
                  <Metric
                    label="Custo atribuído"
                    value={fmtR$(b.attributedCost)}
                    color="#E57373"
                  />
                  <Metric
                    label="Custo rateado"
                    value={fmtR$(b.sharedCost)}
                    color="#E57373"
                  />
                  <Metric
                    label="Lucro da cadeira"
                    value={fmtR$(b.profit)}
                    color={profitColor}
                  />
                  <Metric
                    label="Margem"
                    value={`${b.margin.toFixed(1)}%`}
                    color={profitColor}
                  />
                  <Metric
                    label="Break-even"
                    value={`${b.breakEvenCuts} cortes`}
                    color="#C8C2B4"
                  />
                  <Metric
                    label="Capacidade"
                    value={`${b.capacity}/mês`}
                    color="#C8C2B4"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  color = "#C8C2B4",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <p
        style={{
          margin: 0,
          fontSize: 10,
          color: "#8A847A",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {label}
      </p>
      <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 600, color }}>{value}</p>
    </div>
  );
}
