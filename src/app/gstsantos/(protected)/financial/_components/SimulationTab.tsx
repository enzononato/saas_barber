"use client";

import { useState, useMemo } from "react";

export interface BaselineData {
  numActiveBarbers: number;
  avgTicket: number;
  orgRevenue30d: number;
  orgCommission30d: number;
  orgExpenses30d: number;
  orgCapacity30d: number;
  orgCompleted30d: number;
}

interface Props {
  baseline: BaselineData;
}

function fmtR$(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

export function SimulationTab({ baseline }: Props) {
  const [chairs, setChairs] = useState(Math.max(1, baseline.numActiveBarbers));
  const [ticket, setTicket] = useState(baseline.avgTicket || 60);
  const [commissionPct, setCommissionPct] = useState(
    baseline.orgRevenue30d > 0
      ? Math.round((baseline.orgCommission30d / baseline.orgRevenue30d) * 100)
      : 50,
  );
  const [fixedCosts, setFixedCosts] = useState(baseline.orgExpenses30d);
  const [cutsPerChair, setCutsPerChair] = useState(
    baseline.numActiveBarbers > 0
      ? Math.round(baseline.orgCompleted30d / baseline.numActiveBarbers)
      : 80,
  );

  const result = useMemo(() => {
    const totalCuts = chairs * cutsPerChair;
    const revenue = totalCuts * ticket;
    const commission = revenue * (commissionPct / 100);
    const profit = revenue - commission - fixedCosts;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const chairRevenuePerCut = ticket * (1 - commissionPct / 100);
    const breakEvenCutsPerChair =
      chairRevenuePerCut > 0 && chairs > 0
        ? Math.ceil(fixedCosts / chairs / chairRevenuePerCut)
        : 0;
    return {
      totalCuts,
      revenue,
      commission,
      profit,
      margin,
      breakEvenCutsPerChair,
      chairRevenuePerCut,
    };
  }, [chairs, ticket, commissionPct, fixedCosts, cutsPerChair]);

  const profitColor = result.profit >= 0 ? "#4CAF50" : "#E57373";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          padding: "10px 14px",
          background: "rgba(201,168,76,0.08)",
          border: "1px solid rgba(201,168,76,0.3)",
          borderRadius: 10,
          color: "#C8C2B4",
          fontSize: 12,
        }}
      >
        💡 Simule cenários ajustando os controles abaixo. Os valores iniciais vêm dos últimos 30
        dias da sua barbearia. Nada é salvo — é apenas uma calculadora.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {/* Controls */}
        <Section title="Parâmetros">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SliderField
              label="Cadeiras (barbeiros)"
              value={chairs}
              min={1}
              max={20}
              step={1}
              format={(v) => String(v)}
              onChange={setChairs}
            />
            <SliderField
              label="Cortes por cadeira / mês"
              value={cutsPerChair}
              min={0}
              max={200}
              step={5}
              format={(v) => String(v)}
              onChange={setCutsPerChair}
            />
            <SliderField
              label="Ticket médio (R$)"
              value={ticket}
              min={20}
              max={300}
              step={5}
              format={(v) => fmtR$(v)}
              onChange={setTicket}
            />
            <SliderField
              label="Comissão"
              value={commissionPct}
              min={0}
              max={100}
              step={5}
              format={(v) => `${v}%`}
              onChange={setCommissionPct}
            />
            <SliderField
              label="Custo fixo mensal (R$)"
              value={fixedCosts}
              min={0}
              max={50000}
              step={100}
              format={(v) => fmtR$(v)}
              onChange={setFixedCosts}
            />
          </div>
        </Section>

        {/* Results */}
        <Section title="Resultado simulado / mês">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ResultRow label="Atendimentos totais" value={String(result.totalCuts)} />
            <ResultRow label="Receita bruta" value={fmtR$(result.revenue)} color="#C9A84C" />
            <ResultRow label="Comissão paga" value={fmtR$(result.commission)} color="#E0BE5C" />
            <ResultRow label="Custos fixos" value={fmtR$(fixedCosts)} color="#E57373" />
            <hr style={{ border: "none", borderTop: "1px solid #2A2620", margin: "4px 0" }} />
            <ResultRow
              label="LUCRO"
              value={fmtR$(result.profit)}
              color={profitColor}
              big
            />
            <ResultRow
              label="Margem"
              value={`${result.margin.toFixed(1)}%`}
              color={profitColor}
            />
            <hr style={{ border: "none", borderTop: "1px solid #2A2620", margin: "4px 0" }} />
            <ResultRow
              label="Break-even por cadeira"
              value={`${result.breakEvenCutsPerChair} cortes`}
              color="#C8C2B4"
            />
            <ResultRow
              label="Receita da cadeira / corte"
              value={fmtR$(result.chairRevenuePerCut)}
              color="#C8C2B4"
            />
          </div>
        </Section>
      </div>

      {/* Quick scenarios */}
      <Section title="Cenários rápidos">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Scenario
            label="+1 cadeira"
            onClick={() => setChairs((c) => Math.min(20, c + 1))}
          />
          <Scenario
            label="−1 cadeira"
            onClick={() => setChairs((c) => Math.max(1, c - 1))}
          />
          <Scenario
            label="Ticket +20%"
            onClick={() => setTicket((t) => Math.round(t * 1.2))}
          />
          <Scenario
            label="Comissão −10%"
            onClick={() => setCommissionPct((c) => Math.max(0, c - 10))}
          />
          <Scenario
            label="Comissão +10%"
            onClick={() => setCommissionPct((c) => Math.min(100, c + 10))}
          />
          <Scenario
            label="Custos −20%"
            onClick={() => setFixedCosts((f) => Math.round(f * 0.8))}
          />
          <Scenario
            label="Resetar aos valores reais"
            onClick={() => {
              setChairs(Math.max(1, baseline.numActiveBarbers));
              setTicket(baseline.avgTicket || 60);
              setCommissionPct(
                baseline.orgRevenue30d > 0
                  ? Math.round((baseline.orgCommission30d / baseline.orgRevenue30d) * 100)
                  : 50,
              );
              setFixedCosts(baseline.orgExpenses30d);
              setCutsPerChair(
                baseline.numActiveBarbers > 0
                  ? Math.round(baseline.orgCompleted30d / baseline.numActiveBarbers)
                  : 80,
              );
            }}
            primary
          />
        </div>
      </Section>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 4,
        }}
      >
        <label
          style={{
            fontSize: 11,
            color: "#8A847A",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          {label}
        </label>
        <span style={{ color: "#C9A84C", fontSize: 14, fontWeight: 700 }}>{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "#C9A84C" }}
      />
    </div>
  );
}

function ResultRow({
  label,
  value,
  color = "#F4EEDF",
  big = false,
}: {
  label: string;
  value: string;
  color?: string;
  big?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
      }}
    >
      <span style={{ color: "#8A847A", fontSize: big ? 13 : 12 }}>{label}</span>
      <span style={{ color, fontSize: big ? 22 : 14, fontWeight: big ? 700 : 600 }}>{value}</span>
    </div>
  );
}

function Scenario({
  label,
  onClick,
  primary,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        background: primary
          ? "linear-gradient(180deg,#E0BE5C,#C9A84C 48%,#8E6A24)"
          : "transparent",
        color: primary ? "#1A1408" : "#C8C2B4",
        border: primary ? "none" : "1px solid #2A2620",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: primary ? 700 : 500,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#131211",
        border: "1px solid #2A2620",
        borderRadius: 12,
        padding: "18px 20px",
      }}
    >
      <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 600, color: "#C8C2B4" }}>
        {title}
      </p>
      {children}
    </div>
  );
}
