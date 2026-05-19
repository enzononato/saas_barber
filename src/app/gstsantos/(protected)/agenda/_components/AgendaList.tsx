"use client";

import type { Appointment } from "../page";

const STATUS_LABELS: Record<Appointment["status"], string> = {
  SCHEDULED: "Agendado",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
  NO_SHOW: "Não compareceu",
};

const STATUS_COLORS: Record<Appointment["status"], string> = {
  SCHEDULED: "#C9A84C",
  COMPLETED: "#4CAF50",
  CANCELED: "#E57373",
  NO_SHOW: "#8A847A",
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function fmtPrice(p: string) {
  return `R$ ${parseFloat(p).toFixed(2).replace(".", ",")}`;
}

interface Props {
  appointments: Appointment[];
  onStatusChange: (id: string, status: string) => Promise<boolean>;
}

export function AgendaList({ appointments, onStatusChange }: Props) {
  if (appointments.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "60px 20px",
          color: "#8A847A",
          border: "1px solid #2A2620",
          borderRadius: 12,
        }}
      >
        Nenhum agendamento neste dia.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {appointments.map((apt) => (
        <div
          key={apt.id}
          style={{
            background: "#131211",
            border: "1px solid #2A2620",
            borderRadius: 12,
            padding: "16px 20px",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
          }}
        >
          {/* Time */}
          <div style={{ minWidth: 80 }}>
            <span style={{ color: "#C9A84C", fontWeight: 700, fontSize: 15 }}>
              {fmtTime(apt.startsAt)}
            </span>
            <span style={{ color: "#8A847A", fontSize: 12 }}>
              {" "}–{" "}{fmtTime(apt.endsAt)}
            </span>
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 160 }}>
            <p style={{ margin: "0 0 2px", fontWeight: 600, color: "#F4EEDF", fontSize: 14 }}>
              {apt.customerName}
            </p>
            <p style={{ margin: 0, color: "#8A847A", fontSize: 12 }}>
              {apt.serviceNameAtBooking} · {apt.professionalName}
            </p>
          </div>

          {/* Price */}
          <span style={{ color: "#C9A84C", fontWeight: 600, fontSize: 14 }}>
            {fmtPrice(apt.priceAtBooking)}
          </span>

          {/* Status badge + actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                padding: "3px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                background: STATUS_COLORS[apt.status] + "22",
                color: STATUS_COLORS[apt.status],
              }}
            >
              {STATUS_LABELS[apt.status]}
            </span>

            {apt.status === "SCHEDULED" && (
              <>
                <button
                  onClick={() => onStatusChange(apt.id, "COMPLETED")}
                  style={btnStyle("#4CAF50")}
                  title="Concluir"
                >
                  ✓
                </button>
                <button
                  onClick={() => onStatusChange(apt.id, "NO_SHOW")}
                  style={btnStyle("#8A847A")}
                  title="Não compareceu"
                >
                  ✗
                </button>
                <button
                  onClick={() => onStatusChange(apt.id, "CANCELED")}
                  style={btnStyle("#E57373")}
                  title="Cancelar"
                >
                  ✕
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function btnStyle(color: string): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: `1px solid ${color}44`,
    background: color + "22",
    color,
    cursor: "pointer",
    fontSize: 13,
    display: "grid",
    placeItems: "center",
  };
}
