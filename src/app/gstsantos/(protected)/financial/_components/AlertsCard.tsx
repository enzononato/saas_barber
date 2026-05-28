"use client";

export interface AlertEntry {
  key: string;
  label: string;
  value: string;
  level: "green" | "yellow" | "red" | string;
  hint: string;
}

interface Props {
  alerts: AlertEntry[];
  projection?: string;
}

const LEVEL_STYLE: Record<
  string,
  { color: string; bg: string; icon: string; label: string }
> = {
  green: { color: "#4CAF50", bg: "rgba(76,175,80,0.1)", icon: "✓", label: "Saudável" },
  yellow: { color: "#E0BE5C", bg: "rgba(224,190,92,0.1)", icon: "!", label: "Atenção" },
  red: { color: "#E57373", bg: "rgba(229,115,115,0.1)", icon: "✕", label: "Crítico" },
};

function fmtR$(v: string) {
  return `R$ ${parseFloat(v).toFixed(2).replace(".", ",")}`;
}

export function AlertsCard({ alerts, projection }: Props) {
  return (
    <div
      style={{
        background: "#131211",
        border: "1px solid #2A2620",
        borderRadius: 12,
        padding: "18px 20px",
        marginBottom: 20,
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
          Indicadores de saúde
        </p>
        {projection && parseFloat(projection) > 0 && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "#8A847A",
            }}
          >
            Projeção do mês:{" "}
            <span style={{ color: "#C9A84C", fontWeight: 600 }}>{fmtR$(projection)}</span>
          </span>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
        }}
      >
        {alerts.map((a) => {
          const style = LEVEL_STYLE[a.level] ?? LEVEL_STYLE.yellow;
          return (
            <div
              key={a.key}
              style={{
                padding: "12px 14px",
                background: style.bg,
                border: `1px solid ${style.color}44`,
                borderRadius: 10,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: style.color,
                    color: "#1A1408",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {style.icon}
                </span>
                <span
                  style={{
                    color: style.color,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {style.label}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#F4EEDF" }}>
                {a.value}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "#C8C2B4", fontWeight: 600 }}>
                {a.label}
              </p>
              <p style={{ margin: 0, fontSize: 10, color: "#8A847A" }}>{a.hint}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
