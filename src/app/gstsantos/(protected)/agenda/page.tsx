"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AgendaList } from "./_components/AgendaList";
import { AgendaTimeline } from "./_components/AgendaTimeline";
import { AgendaWeek } from "./_components/AgendaWeek";
import { AgendaKanban } from "./_components/AgendaKanban";

export type Appointment = {
  id: string;
  professionalId: string;
  professionalName: string;
  serviceNameAtBooking: string;
  customerName: string;
  customerPhone: string;
  startsAt: string;
  endsAt: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
  priceAtBooking: string;
  notes: string | null;
};

type View = "list" | "timeline" | "week" | "kanban";

const VIEWS: { key: View; label: string }[] = [
  { key: "list", label: "Lista" },
  { key: "timeline", label: "Timeline" },
  { key: "week", label: "Semana" },
  { key: "kanban", label: "Kanban" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AgendaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = (searchParams.get("view") ?? "list") as View;
  const date = searchParams.get("date") ?? todayIso();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    const url = `/api/gstsantos/appointments?date=${date}`;
    const res = await fetch(url);
    if (res.ok) setAppointments(await res.json());
    setLoading(false);
  }, [date]);

  useEffect(() => { void fetchAppointments(); }, [fetchAppointments]);

  const filteredAppointments = searchQuery
    ? appointments.filter((a) => {
        const q = searchQuery.toLowerCase();
        return (
          a.customerName.toLowerCase().includes(q) ||
          a.customerPhone.replace(/\D/g, "").includes(searchQuery.replace(/\D/g, ""))
        );
      })
    : appointments;

  function setView(v: View) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", v);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.replace(`/gstsantos/agenda?${params.toString()}` as any);
  }

  function setDate(d: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", d);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.replace(`/gstsantos/agenda?${params.toString()}` as any);
  }

  async function updateStatus(id: string, status: string): Promise<boolean> {
    const res = await fetch(`/api/gstsantos/appointments/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchAppointments();
    return res.ok;
  }

  return (
    <div style={{ padding: "24px 20px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
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
          Agenda
        </h1>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar cliente..."
          style={{
            padding: "6px 12px",
            background: "#131211",
            border: "1px solid #2A2620",
            borderRadius: 8,
            color: "#F4EEDF",
            fontSize: 13,
            marginLeft: "auto",
            minWidth: 180,
            outline: "none",
          }}
        />
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

      {/* View tabs */}
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
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            style={{
              padding: "6px 16px",
              borderRadius: 7,
              border: "none",
              background: view === v.key ? "rgba(201,168,76,0.15)" : "transparent",
              color: view === v.key ? "#C9A84C" : "#8A847A",
              fontWeight: view === v.key ? 600 : 400,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "#8A847A" }}>Carregando...</p>
      ) : (
        <>
          {view === "list" && (
            <AgendaList appointments={filteredAppointments} onStatusChange={updateStatus} />
          )}
          {view === "timeline" && (
            <AgendaTimeline appointments={filteredAppointments} date={date} />
          )}
          {view === "week" && (
            <AgendaWeek
              appointments={filteredAppointments}
              date={date}
              onDateChange={setDate}
            />
          )}
          {view === "kanban" && (
            <AgendaKanban appointments={filteredAppointments} onStatusChange={updateStatus} />
          )}
        </>
      )}
    </div>
  );
}
