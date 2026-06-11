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

import {
  WalletInsights,
  type WalletData,
  type LtvData,
  type RetentionData,
} from "./_components/WalletInsights";
import { BarberRanking, type RankingEntry } from "./_components/BarberRanking";
import { SimulationTab, type BaselineData } from "./_components/SimulationTab";
import { AlertsCard, type AlertEntry } from "./_components/AlertsCard";
import { downloadCsv } from "./_components/csv";

type Period = "day" | "week" | "month";
type Tab = "overview" | "wallet" | "ranking" | "simulation";

interface ProfitabilityData {
  orgRevenue30d: string;
  orgCommission30d: string;
  orgExpenses30d: string;
  orgUnattributedExpenses30d: string;
  orgProfit30d: string;
  orgMargin30d: number;
  sharedCostPerBarber: string;
  numActiveBarbers: number;
}

interface ProductionData {
  orgCompleted30d: number;
  orgCapacity30d: number;
  orgSaturation: number;
  projection: string;
  monthlyHistory: { month: string; revenue: string }[];
}

interface InsightsData {
  wallet: WalletData;
  ltv: LtvData;
  retention: RetentionData;
  ranking: RankingEntry[];
  profitability: ProfitabilityData;
  production: ProductionData;
  alerts: AlertEntry[];
}

interface DayEntry { day: string; revenue: string; count: number }
interface ServiceEntry { name: string; revenue: string; count: number }
interface BarberEntry { professionalId: string; professionalName: string; revenue: string; count: number }
interface CategoryEntry { category: string | null; total: string; count: number }
interface ExpenseEntry {
  id: string;
  description: string;
  category: string | null;
  amount: string;
  date: string;
  isRecurring: boolean;
  attributedToUserId: string | null;
}

interface BarberOption {
  memberId: string;
  userId: string;
  name: string;
}

interface PaymentMethodEntry {
  method: string | null;
  revenue: string;
  tips: string;
  count: number;
}

interface FinancialData {
  period: string;
  date: string;
  total: string;
  count: number;
  daily: DayEntry[];
  byService: ServiceEntry[];
  byBarber: BarberEntry[] | null;
  byPaymentMethod: PaymentMethodEntry[];
  productRevenue: string;
  productItemsSold: number;
  totalExpenses: string;
  profit: string;
  expensesByCategory: CategoryEntry[];
  expensesList: ExpenseEntry[];
  role?: "owner" | "member" | "receptionist";
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Dinheiro",
  PIX: "PIX",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
};

const COLORS = ["#C9A84C", "#8E6A24", "#E0BE5C", "#6B4F1A", "#F4EEDF"];

const CATEGORY_SUGGESTIONS = [
  "Aluguel",
  "Produtos",
  "Salários",
  "Marketing",
  "Contas",
  "Equipamentos",
  "Outros",
];

function fmtR$(v: string | number) {
  return `R$ ${parseFloat(String(v)).toFixed(2).replace(".", ",")}`;
}

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export default function FinancialPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [period, setPeriod] = useState<Period>("month");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expForm, setExpForm] = useState({
    description: "",
    category: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    isRecurring: false,
    attributedToUserId: "",
  });
  const [savingExpense, setSavingExpense] = useState(false);
  const [barberOptions, setBarberOptions] = useState<BarberOption[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/gstsantos/financial?period=${period}&date=${date}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [period, date]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const isOwner = Boolean(data?.byBarber);

  const fetchInsights = useCallback(async () => {
    if (insights) return;
    setInsightsLoading(true);
    setInsightsError(false);
    try {
      const res = await fetch("/api/gstsantos/insights");
      if (res.ok) {
        setInsights(await res.json());
      } else {
        setInsightsError(true);
      }
    } catch {
      setInsightsError(true);
    }
    setInsightsLoading(false);
  }, [insights]);

  useEffect(() => {
    if (
      (tab === "wallet" || tab === "ranking" || tab === "simulation" || tab === "overview") &&
      isOwner
    ) {
      void fetchInsights();
    }
  }, [tab, isOwner, fetchInsights]);

  useEffect(() => {
    if (!isOwner) return;
    void (async () => {
      const res = await fetch("/api/gstsantos/barbers");
      if (res.ok) {
        const rows = (await res.json()) as Array<{
          memberId: string;
          userId: string;
          name: string;
          isBarber: boolean;
        }>;
        setBarberOptions(rows.filter((r) => r.isBarber).map((r) => ({
          memberId: r.memberId,
          userId: r.userId,
          name: r.name,
        })));
      }
    })();
  }, [isOwner]);

  async function addExpense() {
    if (!expForm.description.trim() || !expForm.amount || !expForm.date) return;
    setSavingExpense(true);
    const res = await fetch("/api/gstsantos/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: expForm.description.trim(),
        category: expForm.category.trim() || null,
        amount: parseFloat(expForm.amount.replace(",", ".")),
        date: expForm.date,
        isRecurring: expForm.isRecurring,
        attributedToUserId: expForm.attributedToUserId || null,
      }),
    });
    setSavingExpense(false);
    if (res.ok) {
      setShowExpenseModal(false);
      setExpForm({
        description: "",
        category: "",
        amount: "",
        date: new Date().toISOString().slice(0, 10),
        isRecurring: false,
        attributedToUserId: "",
      });
      await fetchData();
      // Re-fetch insights since cost allocation may have changed
      setInsights(null);
    }
  }

  async function deleteExpense(id: string) {
    if (!confirm("Remover esta despesa?")) return;
    const res = await fetch(`/api/gstsantos/expenses/${id}`, { method: "DELETE" });
    if (res.ok) {
      await fetchData();
      setInsights(null);
    }
  }

  function exportOverviewCsv() {
    if (!data) return;
    downloadCsv(
      `financeiro-${data.period}-${data.date}.csv`,
      data.daily.map((d) => ({
        dia: d.day,
        receita: parseFloat(d.revenue).toFixed(2),
        atendimentos: d.count,
      })),
    );
  }

  function exportExpensesCsv() {
    if (!data) return;
    downloadCsv(
      `despesas-${data.period}-${data.date}.csv`,
      data.expensesList.map((e) => ({
        data: e.date,
        descricao: e.description,
        categoria: e.category ?? "",
        valor: parseFloat(e.amount).toFixed(2),
        recorrente: e.isRecurring ? "Sim" : "Não",
        atribuida_a: e.attributedToUserId ?? "Rateada",
      })),
    );
  }

  function exportWalletCsv() {
    if (!insights) return;
    const w = insights.wallet;
    downloadCsv("carteira-resumo.csv", [
      {
        status: "Ativos (<= 30d)",
        clientes: w.active,
        pct_total: w.total > 0 ? Math.round((w.active / w.total) * 100) : 0,
      },
      {
        status: "Em Retenção (31-60d)",
        clientes: w.retention,
        pct_total: w.total > 0 ? Math.round((w.retention / w.total) * 100) : 0,
      },
      {
        status: "Em Risco (61-90d)",
        clientes: w.atRisk,
        pct_total: w.total > 0 ? Math.round((w.atRisk / w.total) * 100) : 0,
      },
      {
        status: "Perdidos (> 90d)",
        clientes: w.lost,
        pct_total: w.total > 0 ? Math.round((w.lost / w.total) * 100) : 0,
      },
    ]);
  }

  function exportRankingCsv() {
    if (!insights) return;
    downloadCsv(
      "ranking-barbeiros-30d.csv",
      insights.ranking.map((r) => ({
        barbeiro: r.name,
        receita: r.revenue,
        atendimentos: r.completed,
        faltas_cancelamentos: r.missed,
        ticket_medio: r.averageTicket,
        taxa_conclusao_pct: r.completedRate,
        comissao_paga: r.commission,
        custo_atribuido: r.attributedCost,
        custo_rateado: r.sharedCost,
        lucro_cadeira: r.profit,
        margem_pct: r.margin,
        break_even_cortes: r.breakEvenCuts,
        capacidade_mes: r.capacity,
        saturacao_pct: r.saturation,
      })),
    );
  }

  const TABS: { key: Tab; label: string; ownerOnly: boolean }[] = [
    { key: "overview", label: "Visão Geral", ownerOnly: false },
    { key: "wallet", label: "Carteira", ownerOnly: true },
    { key: "ranking", label: "Ranking", ownerOnly: true },
    { key: "simulation", label: "Simulação", ownerOnly: true },
  ];

  return (
    <div style={{ padding: "24px 20px", maxWidth: 1100, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F4EEDF", margin: 0 }}>
          Financeiro
        </h1>

        {tab === "overview" && (
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
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          background: "#131211",
          border: "1px solid #2A2620",
          borderRadius: 10,
          padding: 4,
          width: "fit-content",
        }}
      >
        {TABS.filter((t) => !t.ownerOnly || isOwner).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "6px 16px",
              borderRadius: 7,
              border: "none",
              background: tab === t.key ? "rgba(201,168,76,0.15)" : "transparent",
              color: tab === t.key ? "#C9A84C" : "#8A847A",
              fontWeight: tab === t.key ? 600 : 400,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading || !data ? (
        <p style={{ color: "#8A847A" }}>Carregando...</p>
      ) : tab === "wallet" ? (
        insightsLoading ? (
          <p style={{ color: "#8A847A" }}>Carregando insights...</p>
        ) : insightsError || !insights ? (
          <InsightsErrorMessage onRetry={() => { setInsightsError(false); setInsights(null); }} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <ExportButton onClick={exportWalletCsv} />
            </div>
            <WalletInsights
              wallet={insights.wallet}
              ltv={insights.ltv}
              retention={insights.retention}
            />
          </div>
        )
      ) : tab === "ranking" ? (
        insightsLoading ? (
          <p style={{ color: "#8A847A" }}>Carregando ranking...</p>
        ) : insightsError || !insights ? (
          <InsightsErrorMessage onRetry={() => { setInsightsError(false); setInsights(null); }} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <ExportButton onClick={exportRankingCsv} />
            </div>
            <BarberRanking ranking={insights.ranking} />
          </div>
        )
      ) : tab === "simulation" ? (
        insightsLoading ? (
          <p style={{ color: "#8A847A" }}>Carregando dados...</p>
        ) : insightsError || !insights ? (
          <InsightsErrorMessage onRetry={() => { setInsightsError(false); setInsights(null); }} />
        ) : (
          <SimulationTab
            baseline={
              {
                numActiveBarbers: insights.profitability.numActiveBarbers,
                avgTicket: parseFloat(insights.ltv.averageTicket) || 0,
                orgRevenue30d: parseFloat(insights.profitability.orgRevenue30d),
                orgCommission30d: parseFloat(insights.profitability.orgCommission30d),
                orgExpenses30d: parseFloat(insights.profitability.orgExpenses30d),
                orgCapacity30d: insights.production.orgCapacity30d,
                orgCompleted30d: insights.production.orgCompleted30d,
              } as BaselineData
            }
          />
        )
      ) : (
        <>
          {/* Consolidated health alerts — owner only */}
          {isOwner && insights && (
            <AlertsCard
              alerts={insights.alerts}
              projection={insights.production.projection}
            />
          )}

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
            {isOwner && (
              <>
                <KpiCard label="Despesas" value={fmtR$(data.totalExpenses)} accent="#E57373" />
                <KpiCard
                  label="Lucro"
                  value={fmtR$(data.profit)}
                  accent={parseFloat(data.profit) >= 0 ? "#4CAF50" : "#E57373"}
                />
              </>
            )}
          </div>

          {/* Fechamento de caixa — receita por forma de pagamento */}
          {data.byPaymentMethod && data.byPaymentMethod.length > 0 && (
            <Section title="Fechamento de caixa">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.byPaymentMethod.map((pm) => {
                  const total = parseFloat(data.total) || 1;
                  const pct = Math.round((parseFloat(pm.revenue) / total) * 100);
                  return (
                    <div
                      key={pm.method ?? "none"}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 14px",
                        background: "#0B0B0B",
                        border: "1px solid #2A2620",
                        borderRadius: 10,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, color: "#F4EEDF", fontWeight: 600 }}>
                          {pm.method ? PAYMENT_LABELS[pm.method] ?? pm.method : "Sem forma registrada"}
                        </p>
                        <div
                          style={{
                            marginTop: 6,
                            height: 4,
                            borderRadius: 999,
                            background: "#1B1916",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              borderRadius: 999,
                              background: "linear-gradient(90deg,#E0BE5C,#C9A84C)",
                              transition: "width 0.6s cubic-bezier(.2,.7,.2,1)",
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ margin: 0, color: "#C9A84C", fontWeight: 700, fontSize: 14 }}>
                          {fmtR$(pm.revenue)}
                        </p>
                        <p style={{ margin: 0, color: "#8A847A", fontSize: 11 }}>
                          {pm.count} atend.
                          {parseFloat(pm.tips) > 0 && ` · ${fmtR$(pm.tips)} gorjeta`}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {parseFloat(data.productRevenue) > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderTop: "1px dashed #2A2620",
                      marginTop: 4,
                    }}
                  >
                    <span style={{ color: "#8A847A", fontSize: 13 }}>
                      Produtos vendidos ({data.productItemsSold} un.)
                    </span>
                    <span style={{ color: "#C9A84C", fontWeight: 700, fontSize: 14 }}>
                      {fmtR$(data.productRevenue)}
                    </span>
                  </div>
                )}
              </div>
            </Section>
          )}

          {data.daily.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12, marginTop: 20 }}>
              <ExportButton onClick={exportOverviewCsv} />
            </div>
          )}

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

          {/* Expenses — owner only */}
          {isOwner && (
            <div style={{ marginTop: 28 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#F4EEDF", margin: 0 }}>
                  Despesas
                </h2>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  {data.expensesList.length > 0 && <ExportButton onClick={exportExpensesCsv} />}
                  <button
                    onClick={() => setShowExpenseModal(true)}
                    style={{
                      padding: "7px 16px",
                      background: "linear-gradient(180deg,#E0BE5C,#C9A84C 48%,#8E6A24)",
                      color: "#1A1408",
                      fontWeight: 700,
                      fontSize: 13,
                      border: "none",
                      borderRadius: 999,
                      cursor: "pointer",
                    }}
                  >
                    + Adicionar despesa
                  </button>
                </div>
              </div>

              <Section title="Lançamentos do período">
                {data.expensesList.length === 0 ? (
                  <p
                    style={{
                      color: "#3A3630",
                      fontSize: 13,
                      textAlign: "center",
                      margin: "16px 0",
                    }}
                  >
                    Nenhuma despesa registrada neste período.
                  </p>
                ) : (
                  <table
                    style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
                  >
                    <thead>
                      <tr>
                        <th style={th}>Data</th>
                        <th style={th}>Descrição</th>
                        <th style={th}>Categoria</th>
                        <th style={{ ...th, textAlign: "right" }}>Valor</th>
                        <th style={{ ...th, textAlign: "right" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.expensesList.map((e) => (
                        <tr key={e.id}>
                          <td style={{ ...td, color: "#8A847A" }}>{fmtDate(e.date)}</td>
                          <td style={td}>{e.description}</td>
                          <td style={{ ...td, color: "#8A847A" }}>{e.category ?? "—"}</td>
                          <td
                            style={{
                              ...td,
                              textAlign: "right",
                              color: "#E57373",
                              fontWeight: 600,
                            }}
                          >
                            {fmtR$(e.amount)}
                          </td>
                          <td style={{ ...td, textAlign: "right" }}>
                            <button
                              onClick={() => void deleteExpense(e.id)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#E57373",
                                cursor: "pointer",
                                fontSize: 16,
                                padding: "2px 6px",
                              }}
                              title="Remover"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>
            </div>
          )}
        </>
      )}

      {/* Add expense modal */}
      {showExpenseModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
          onClick={() => setShowExpenseModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#131211",
              border: "1px solid #2A2620",
              borderRadius: 12,
              padding: 24,
              width: "100%",
              maxWidth: 420,
            }}
          >
            <h2
              style={{
                margin: "0 0 16px",
                fontSize: 17,
                fontWeight: 700,
                color: "#F4EEDF",
              }}
            >
              Nova despesa
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={modalLabel}>Descrição</label>
                <input
                  type="text"
                  value={expForm.description}
                  onChange={(e) =>
                    setExpForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Ex: Aluguel de agosto"
                  style={modalInput}
                />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={modalLabel}>Categoria</label>
                  <input
                    type="text"
                    list="exp-categories"
                    value={expForm.category}
                    onChange={(e) =>
                      setExpForm((f) => ({ ...f, category: e.target.value }))
                    }
                    placeholder="(opcional)"
                    style={modalInput}
                  />
                  <datalist id="exp-categories">
                    {CATEGORY_SUGGESTIONS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div style={{ width: 130 }}>
                  <label style={modalLabel}>Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={expForm.amount}
                    onChange={(e) =>
                      setExpForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    placeholder="0,00"
                    style={modalInput}
                  />
                </div>
              </div>

              <div>
                <label style={modalLabel}>Data</label>
                <input
                  type="date"
                  value={expForm.date}
                  onChange={(e) => setExpForm((f) => ({ ...f, date: e.target.value }))}
                  style={modalInput}
                />
              </div>

              <div>
                <label style={modalLabel}>Atribuir a barbeiro</label>
                <select
                  value={expForm.attributedToUserId}
                  onChange={(e) =>
                    setExpForm((f) => ({ ...f, attributedToUserId: e.target.value }))
                  }
                  style={modalInput}
                >
                  <option value="">— Rateada entre todos —</option>
                  {barberOptions.map((b) => (
                    <option key={b.userId} value={b.userId}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <p style={{ margin: "4px 0 0", fontSize: 10, color: "#8A847A" }}>
                  Sem atribuição, o custo é rateado igualmente entre cadeiras ativas.
                </p>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  color: "#C8C2B4",
                  fontSize: 12,
                }}
              >
                <input
                  type="checkbox"
                  checked={expForm.isRecurring}
                  onChange={(e) =>
                    setExpForm((f) => ({ ...f, isRecurring: e.target.checked }))
                  }
                  style={{ accentColor: "#C9A84C" }}
                />
                Despesa recorrente (mensal)
              </label>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 20,
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setShowExpenseModal(false)}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  border: "1px solid #2A2620",
                  borderRadius: 8,
                  color: "#8A847A",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => void addExpense()}
                disabled={
                  savingExpense ||
                  !expForm.description.trim() ||
                  !expForm.amount ||
                  !expForm.date
                }
                style={{
                  padding: "8px 18px",
                  background: "linear-gradient(180deg,#E0BE5C,#C9A84C 48%,#8E6A24)",
                  color: "#1A1408",
                  fontWeight: 700,
                  fontSize: 13,
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  opacity:
                    savingExpense ||
                    !expForm.description.trim() ||
                    !expForm.amount ||
                    !expForm.date
                      ? 0.5
                      : 1,
                }}
              >
                {savingExpense ? "Salvando..." : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InsightsErrorMessage({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      style={{
        background: "#131211",
        border: "1px solid #3A2020",
        borderRadius: 12,
        padding: "32px 24px",
        textAlign: "center",
        color: "#E57373",
      }}
    >
      <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>
        Erro ao carregar dados de BI
      </p>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: "#8A847A" }}>
        Verifique se as migrações do banco foram aplicadas no servidor.
      </p>
      <button
        onClick={onRetry}
        style={{
          padding: "7px 20px",
          background: "transparent",
          border: "1px solid #E57373",
          borderRadius: 8,
          color: "#E57373",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Tentar novamente
      </button>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent = "#C9A84C",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: "#131211",
        border: "1px solid #2A2620",
        borderRadius: 12,
        padding: "16px 20px",
      }}
    >
      <p
        style={{
          margin: "0 0 6px",
          fontSize: 11,
          color: "#8A847A",
          textTransform: "uppercase",
          letterSpacing: "0.15em",
        }}
      >
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: accent }}>{value}</p>
    </div>
  );
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        background: "transparent",
        border: "1px solid #2A2620",
        borderRadius: 999,
        color: "#C8C2B4",
        fontSize: 12,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
      title="Baixar planilha CSV"
    >
      <span>📥</span> Exportar CSV
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

const modalLabel: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  color: "#8A847A",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  marginBottom: 4,
};

const modalInput: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "#0B0B0B",
  border: "1px solid #2A2620",
  borderRadius: 7,
  color: "#F4EEDF",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};
