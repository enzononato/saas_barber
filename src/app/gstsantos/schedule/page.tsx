"use client";

import { useEffect, useState, useCallback } from "react";

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface WorkingHour {
  id: string;
  professionalId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface TimeException {
  id: string;
  professionalId: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

// Working hours are stored per day: 0=Sun...6=Sat
// We edit Mon-Sun (1-0) for better UX
const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon first

type DayState = { enabled: boolean; startTime: string; endTime: string };

function buildDayMap(rows: WorkingHour[]): Record<number, DayState> {
  const map: Record<number, DayState> = {};
  for (let i = 0; i <= 6; i++) {
    map[i] = { enabled: false, startTime: "09:00", endTime: "18:00" };
  }
  for (const r of rows) {
    map[r.dayOfWeek] = { enabled: true, startTime: r.startTime, endTime: r.endTime };
  }
  return map;
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

export default function SchedulePage() {
  const [hours, setHours] = useState<Record<number, DayState>>({});
  const [exceptions, setExceptions] = useState<TimeException[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [exForm, setExForm] = useState({
    startsAt: "",
    endsAt: "",
    reason: "",
  });
  const [addingEx, setAddingEx] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [whRes, exRes] = await Promise.all([
      fetch("/api/gstsantos/working-hours"),
      fetch("/api/gstsantos/time-exceptions"),
    ]);
    if (whRes.ok) setHours(buildDayMap(await whRes.json()));
    if (exRes.ok) setExceptions(await exRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  async function saveHours() {
    setSaving(true);
    const hoursArr = WEEK_DAYS.filter((d) => hours[d]?.enabled).map((d) => ({
      dayOfWeek: d,
      startTime: hours[d].startTime,
      endTime: hours[d].endTime,
    }));

    await fetch("/api/gstsantos/working-hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours: hoursArr }),
    });
    setSaving(false);
    await fetchAll();
  }

  async function addException() {
    setAddingEx(true);
    await fetch("/api/gstsantos/time-exceptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startsAt: exForm.startsAt,
        endsAt: exForm.endsAt,
        reason: exForm.reason || null,
      }),
    });
    setAddingEx(false);
    setExForm({ startsAt: "", endsAt: "", reason: "" });
    await fetchAll();
  }

  async function deleteException(id: string) {
    await fetch(`/api/gstsantos/time-exceptions/${id}`, { method: "DELETE" });
    await fetchAll();
  }

  function updateDay(day: number, patch: Partial<DayState>) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  return (
    <div style={{ padding: "24px 20px", maxWidth: 700, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F4EEDF", margin: "0 0 24px" }}>
        Minha Agenda
      </h1>

      {loading ? (
        <p style={{ color: "#8A847A" }}>Carregando...</p>
      ) : (
        <>
          {/* Working hours */}
          <section
            style={{
              background: "#131211",
              border: "1px solid #2A2620",
              borderRadius: 12,
              padding: "20px",
              marginBottom: 24,
            }}
          >
            <h2 style={{ margin: "0 0 16px", fontSize: 15, color: "#C8C2B4" }}>
              Horários de trabalho
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {WEEK_DAYS.map((day) => {
                const ds = hours[day] ?? { enabled: false, startTime: "09:00", endTime: "18:00" };
                return (
                  <div
                    key={day}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Toggle */}
                    <ToggleSwitch
                      checked={ds.enabled}
                      onChange={() => updateDay(day, { enabled: !ds.enabled })}
                    />

                    {/* Day name */}
                    <span
                      style={{
                        width: 32,
                        fontSize: 13,
                        color: ds.enabled ? "#F4EEDF" : "#8A847A",
                        fontWeight: ds.enabled ? 600 : 400,
                      }}
                    >
                      {DAY_NAMES[day]}
                    </span>

                    {ds.enabled ? (
                      <>
                        <input
                          type="time"
                          value={ds.startTime}
                          onChange={(e) => updateDay(day, { startTime: e.target.value })}
                          style={timeInput}
                        />
                        <span style={{ color: "#8A847A", fontSize: 12 }}>até</span>
                        <input
                          type="time"
                          value={ds.endTime}
                          onChange={(e) => updateDay(day, { endTime: e.target.value })}
                          style={timeInput}
                        />
                      </>
                    ) : (
                      <span style={{ color: "#3A3630", fontSize: 12 }}>Folga</span>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => void saveHours()}
              disabled={saving}
              style={{ ...primaryBtn, marginTop: 20, marginLeft: 0 }}
            >
              {saving ? "Salvando..." : "Salvar horários"}
            </button>
          </section>

          {/* Time exceptions */}
          <section
            style={{
              background: "#131211",
              border: "1px solid #2A2620",
              borderRadius: 12,
              padding: "20px",
            }}
          >
            <h2 style={{ margin: "0 0 16px", fontSize: 15, color: "#C8C2B4" }}>
              Exceções / Folgas
            </h2>

            {/* Add form */}
            <div
              style={{
                background: "#0B0B0B",
                border: "1px solid #2A2620",
                borderRadius: 10,
                padding: "16px",
                marginBottom: 16,
              }}
            >
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#8A847A" }}>
                Adicionar folga ou bloqueio de horário
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                <div>
                  <label style={label}>De</label>
                  <input
                    type="datetime-local"
                    value={exForm.startsAt}
                    onChange={(e) => setExForm((f) => ({ ...f, startsAt: e.target.value }))}
                    style={timeInput}
                  />
                </div>
                <div>
                  <label style={label}>Até</label>
                  <input
                    type="datetime-local"
                    value={exForm.endsAt}
                    onChange={(e) => setExForm((f) => ({ ...f, endsAt: e.target.value }))}
                    style={timeInput}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label style={label}>Motivo (opcional)</label>
                  <input
                    type="text"
                    value={exForm.reason}
                    onChange={(e) => setExForm((f) => ({ ...f, reason: e.target.value }))}
                    style={{ ...timeInput, width: "100%", boxSizing: "border-box" }}
                    placeholder="Férias, consulta..."
                  />
                </div>
                <button
                  onClick={() => void addException()}
                  disabled={addingEx || !exForm.startsAt || !exForm.endsAt}
                  style={primaryBtn}
                >
                  {addingEx ? "..." : "Adicionar"}
                </button>
              </div>
            </div>

            {/* List */}
            {exceptions.length === 0 ? (
              <p style={{ color: "#3A3630", fontSize: 13, textAlign: "center", margin: "16px 0" }}>
                Nenhuma exceção futura.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {exceptions.map((ex) => (
                  <div
                    key={ex.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      background: "#0B0B0B",
                      border: "1px solid #2A2620",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <span style={{ color: "#C8C2B4", fontSize: 13 }}>
                        {fmtDatetime(ex.startsAt)} → {fmtDatetime(ex.endsAt)}
                      </span>
                      {ex.reason && (
                        <span style={{ color: "#8A847A", fontSize: 12, marginLeft: 8 }}>
                          · {ex.reason}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => void deleteException(ex.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#E57373",
                        cursor: "pointer",
                        fontSize: 16,
                        padding: "2px 6px",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: 36,
        height: 20,
        borderRadius: 999,
        background: checked ? "#C9A84C" : "#2A2620",
        position: "relative",
        cursor: "pointer",
        transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#F4EEDF",
          transition: "left 0.2s",
        }}
      />
    </div>
  );
}

const timeInput: React.CSSProperties = {
  padding: "7px 10px",
  background: "#131211",
  border: "1px solid #2A2620",
  borderRadius: 7,
  color: "#F4EEDF",
  fontSize: 13,
  outline: "none",
};

const primaryBtn: React.CSSProperties = {
  padding: "8px 18px",
  background: "linear-gradient(180deg,#E0BE5C,#C9A84C 48%,#8E6A24)",
  color: "#1A1408",
  fontWeight: 700,
  fontSize: 13,
  border: "none",
  borderRadius: 999,
  cursor: "pointer",
  marginLeft: "auto",
  flexShrink: 0,
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  color: "#8A847A",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  marginBottom: 4,
};
