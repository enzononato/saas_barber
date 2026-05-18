"use client";

import type { Appointment } from "../page";

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00 – 20:00

const STATUS_COLORS: Record<Appointment["status"], string> = {
  SCHEDULED: "#C9A84C",
  COMPLETED: "#4CAF50",
  CANCELED: "#E57373",
  NO_SHOW: "#8A847A",
};

interface Props {
  appointments: Appointment[];
  date: string;
}

function minutesSinceMidnight(iso: string, tz = "America/Sao_Paulo") {
  const d = new Date(iso);
  const local = new Date(d.toLocaleString("en-US", { timeZone: tz }));
  return local.getHours() * 60 + local.getMinutes();
}

export function AgendaTimeline({ appointments, date }: Props) {
  const ROW_H = 60; // pixels per hour
  const LABEL_W = 48;
  const totalH = HOURS.length * ROW_H;

  const professionals = Array.from(
    new Map(appointments.map((a) => [a.professionalId, a.professionalName])).entries(),
  );

  if (professionals.length === 0) {
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

  const COL_W = Math.max(140, Math.floor((900 - LABEL_W) / professionals.length));

  return (
    <div
      style={{
        overflowX: "auto",
        background: "#131211",
        border: "1px solid #2A2620",
        borderRadius: 12,
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", borderBottom: "1px solid #2A2620" }}>
        <div style={{ width: LABEL_W, flexShrink: 0 }} />
        {professionals.map(([id, name]) => (
          <div
            key={id}
            style={{
              width: COL_W,
              flexShrink: 0,
              padding: "10px 12px",
              fontSize: 12,
              fontWeight: 600,
              color: "#C9A84C",
              borderLeft: "1px solid #2A2620",
              textAlign: "center",
            }}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ position: "relative", height: totalH, display: "flex" }}>
        {/* Hour labels */}
        <div style={{ width: LABEL_W, flexShrink: 0, position: "relative" }}>
          {HOURS.map((h, i) => (
            <div
              key={h}
              style={{
                position: "absolute",
                top: i * ROW_H - 7,
                left: 0,
                width: LABEL_W,
                textAlign: "right",
                paddingRight: 8,
                fontSize: 11,
                color: "#8A847A",
              }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* Professional columns */}
        {professionals.map(([profId]) => {
          const profApts = appointments.filter((a) => a.professionalId === profId);
          return (
            <div
              key={profId}
              style={{
                width: COL_W,
                flexShrink: 0,
                position: "relative",
                borderLeft: "1px solid #2A2620",
              }}
            >
              {/* Hour grid lines */}
              {HOURS.map((_, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    top: i * ROW_H,
                    left: 0,
                    right: 0,
                    borderTop: "1px solid #1E1C1A",
                  }}
                />
              ))}

              {/* Appointments */}
              {profApts.map((apt) => {
                const startMin = minutesSinceMidnight(apt.startsAt);
                const endMin = minutesSinceMidnight(apt.endsAt);
                const top = ((startMin - HOURS[0] * 60) / 60) * ROW_H;
                const height = ((endMin - startMin) / 60) * ROW_H - 2;
                const color = STATUS_COLORS[apt.status];

                return (
                  <div
                    key={apt.id}
                    style={{
                      position: "absolute",
                      top: Math.max(0, top),
                      left: 3,
                      right: 3,
                      height: Math.max(20, height),
                      background: color + "22",
                      border: `1px solid ${color}55`,
                      borderLeft: `3px solid ${color}`,
                      borderRadius: 6,
                      padding: "3px 6px",
                      overflow: "hidden",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color }}>
                      {apt.customerName}
                    </p>
                    <p style={{ margin: 0, fontSize: 10, color: "#8A847A" }}>
                      {apt.serviceNameAtBooking}
                    </p>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
