"use client";

import type { Appointment } from "../page";

interface Props {
  appointments: Appointment[];
  date: string;
  onDateChange: (d: string) => void;
}

function getWeekDays(dateStr: string): Date[] {
  const d = new Date(dateStr + "T00:00:00Z");
  const dayOfWeek = d.getUTCDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + i);
    return day;
  });
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function AgendaWeek({ appointments, date, onDateChange }: Props) {
  const weekDays = getWeekDays(date);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div
      style={{
        background: "#131211",
        border: "1px solid #2A2620",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Week nav */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid #2A2620",
        }}
      >
        <button
          onClick={() => {
            const prev = new Date(weekDays[0]);
            prev.setUTCDate(prev.getUTCDate() - 7);
            onDateChange(isoDate(prev));
          }}
          style={navBtn}
        >
          ←
        </button>
        <span style={{ color: "#C8C2B4", fontSize: 13 }}>
          {weekDays[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" })} –{" "}
          {weekDays[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}
        </span>
        <button
          onClick={() => {
            const next = new Date(weekDays[0]);
            next.setUTCDate(next.getUTCDate() + 7);
            onDateChange(isoDate(next));
          }}
          style={navBtn}
        >
          →
        </button>
      </div>

      {/* Day columns */}
      <div style={{ display: "flex", overflowX: "auto" }}>
        {weekDays.map((day, i) => {
          const dayIso = isoDate(day);
          const dayApts = appointments.filter((a) =>
            a.startsAt.slice(0, 10) === dayIso,
          );
          const isToday = dayIso === today;
          const isSelected = dayIso === date;

          return (
            <div
              key={dayIso}
              style={{
                flex: "1 0 100px",
                minWidth: 90,
                borderLeft: i === 0 ? "none" : "1px solid #2A2620",
              }}
            >
              {/* Day header */}
              <button
                onClick={() => onDateChange(dayIso)}
                style={{
                  width: "100%",
                  padding: "10px 8px",
                  background: isSelected ? "rgba(201,168,76,0.1)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "center",
                  borderBottom: "1px solid #2A2620",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    color: "#8A847A",
                    textTransform: "uppercase",
                  }}
                >
                  {DAY_NAMES[i]}
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 16,
                    fontWeight: 700,
                    color: isToday ? "#C9A84C" : isSelected ? "#F4EEDF" : "#C8C2B4",
                  }}
                >
                  {day.getUTCDate()}
                </p>
              </button>

              {/* Appointments */}
              <div style={{ padding: "8px 6px", minHeight: 80 }}>
                {dayApts.length === 0 ? (
                  <p style={{ color: "#3A3630", fontSize: 11, textAlign: "center", margin: 0 }}>
                    —
                  </p>
                ) : (
                  dayApts.map((apt) => (
                    <div
                      key={apt.id}
                      title={apt.notes ?? undefined}
                      style={{
                        background: "#0B0B0B",
                        border: "1px solid #2A2620",
                        borderLeft: "3px solid #C9A84C",
                        borderRadius: 6,
                        padding: "5px 7px",
                        marginBottom: 4,
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#F4EEDF" }}>
                        {new Date(apt.startsAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "America/Sao_Paulo",
                        })}
                      </p>
                      <p style={{ margin: 0, fontSize: 10, color: "#8A847A" }}>
                        {apt.customerName}
                      </p>
                      {apt.notes && (
                        <p
                          style={{
                            margin: "2px 0 0",
                            fontSize: 9,
                            color: "#8A847A",
                            fontStyle: "italic",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          📝 {apt.notes}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  background: "#0B0B0B",
  border: "1px solid #2A2620",
  borderRadius: 8,
  color: "#C8C2B4",
  padding: "4px 12px",
  cursor: "pointer",
  fontSize: 14,
};
