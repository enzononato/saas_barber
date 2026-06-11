"use client";

import { Check, X, UserX, CalendarX2, StickyNote } from "lucide-react";

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
      <div className="empty">
        <CalendarX2 className="ic" strokeWidth={1.4} />
        <p style={{ margin: 0, fontSize: 14 }}>Nenhum agendamento neste dia.</p>
      </div>
    );
  }

  return (
    <div className="gst-stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {appointments.map((apt) => (
        <div
          key={apt.id}
          className="gst-card gst-card-hover"
          style={{
            borderLeft: `3px solid ${STATUS_COLORS[apt.status]}55`,
            padding: "16px 20px",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
          }}
        >
          {/* Time */}
          <div style={{ minWidth: 80 }}>
            <span
              style={{
                color: "#C9A84C",
                fontWeight: 700,
                fontSize: 15,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
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
            {apt.notes && (
              <p
                title={apt.notes}
                style={{
                  margin: "4px 0 0",
                  color: "#8A847A",
                  fontSize: 11,
                  fontStyle: "italic",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical" as const,
                }}
              >
                <StickyNote
                  size={11}
                  style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }}
                />
                {apt.notes}
              </p>
            )}
          </div>

          {/* Price */}
          <span
            style={{
              color: "#C9A84C",
              fontWeight: 600,
              fontSize: 14,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
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
                border: `1px solid ${STATUS_COLORS[apt.status]}44`,
                color: STATUS_COLORS[apt.status],
              }}
            >
              {STATUS_LABELS[apt.status]}
            </span>

            {apt.status === "SCHEDULED" && (
              <>
                <button
                  onClick={() => onStatusChange(apt.id, "COMPLETED")}
                  className="agenda-act"
                  style={actStyle("#4CAF50")}
                  title="Concluir"
                  aria-label="Concluir atendimento"
                >
                  <Check size={15} strokeWidth={2.4} />
                </button>
                <button
                  onClick={() => onStatusChange(apt.id, "NO_SHOW")}
                  className="agenda-act"
                  style={actStyle("#8A847A")}
                  title="Não compareceu"
                  aria-label="Marcar como não compareceu"
                >
                  <UserX size={14} strokeWidth={2.2} />
                </button>
                <button
                  onClick={() => onStatusChange(apt.id, "CANCELED")}
                  className="agenda-act"
                  style={actStyle("#E57373")}
                  title="Cancelar"
                  aria-label="Cancelar agendamento"
                >
                  <X size={15} strokeWidth={2.4} />
                </button>
              </>
            )}
          </div>
        </div>
      ))}

      <style>{`
        .agenda-act { transition: transform .15s cubic-bezier(.2,.7,.2,1), filter .2s; }
        .agenda-act:hover { transform: scale(1.12); filter: brightness(1.25); }
        .agenda-act:active { transform: scale(0.92); }
      `}</style>
    </div>
  );
}

function actStyle(color: string): React.CSSProperties {
  return {
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: `1px solid ${color}44`,
    background: color + "1c",
    color,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
  };
}
