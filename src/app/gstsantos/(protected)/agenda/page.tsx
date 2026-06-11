"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { AgendaList } from "./_components/AgendaList";
import { AgendaTimeline } from "./_components/AgendaTimeline";
import { AgendaWeek } from "./_components/AgendaWeek";
import { AgendaKanban } from "./_components/AgendaKanban";
import { CheckoutModal, type CheckoutPayload } from "./_components/CheckoutModal";
import { NewAppointmentModal } from "./_components/NewAppointmentModal";

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
  paymentMethod?: string | null;
  tipAmount?: string | null;
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

type Me = {
  id: string;
  role: "owner" | "member" | "receptionist";
  canCreateServices: boolean;
};

export default function AgendaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = (searchParams.get("view") ?? "list") as View;
  const date = searchParams.get("date") ?? todayIso();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [checkoutFor, setCheckoutFor] = useState<Appointment | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/gstsantos/me");
      if (res.ok) setMe(await res.json());
    })();
  }, []);

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

  async function patchStatus(id: string, body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/gstsantos/appointments/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await fetchAppointments();
    return res.ok;
  }

  async function updateStatus(id: string, status: string): Promise<boolean> {
    // Concluir abre o modal de fechamento (POS) em vez de completar direto
    if (status === "COMPLETED") {
      const apt = appointments.find((a) => a.id === id);
      if (apt) {
        setCheckoutFor(apt);
        return false; // Kanban faz rollback visual; o card move após o fechamento
      }
    }
    return patchStatus(id, { status });
  }

  async function handleCheckout(payload: CheckoutPayload) {
    if (!checkoutFor) return;
    const ok = await patchStatus(checkoutFor.id, {
      status: "COMPLETED",
      paymentMethod: payload.paymentMethod,
      tipAmount: payload.tipAmount,
      products: payload.products,
    });
    if (ok) setCheckoutFor(null);
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
        <button
          onClick={() => setNewOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 18px",
            minHeight: 38,
            background: "linear-gradient(180deg,#E0BE5C,#C9A84C 48%,#8E6A24)",
            color: "#1A1408",
            fontWeight: 700,
            fontSize: 13,
            border: "none",
            borderRadius: 999,
            cursor: "pointer",
            transition: "transform 0.15s, box-shadow 0.15s",
            boxShadow: "0 8px 20px -8px rgba(201,168,76,0.5)",
          }}
        >
          <Plus size={15} strokeWidth={2.5} />
          Novo agendamento
        </button>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar cliente..."
          style={{
            padding: "8px 12px",
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
            padding: "8px 12px",
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
              padding: "7px 16px",
              minHeight: 34,
              borderRadius: 7,
              border: "none",
              background: view === v.key ? "rgba(201,168,76,0.15)" : "transparent",
              color: view === v.key ? "#C9A84C" : "#8A847A",
              fontWeight: view === v.key ? 600 : 400,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.15s",
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

      {/* Modal de fechamento (POS) */}
      {checkoutFor && (
        <CheckoutModal
          appointment={checkoutFor}
          onConfirm={handleCheckout}
          onClose={() => setCheckoutFor(null)}
        />
      )}

      {/* Modal de novo agendamento */}
      {newOpen && (
        <NewAppointmentModal
          defaultDate={date}
          lockedProfessionalId={
            me && me.role === "member" && !me.canCreateServices ? me.id : undefined
          }
          onCreated={() => {
            setNewOpen(false);
            void fetchAppointments();
          }}
          onClose={() => setNewOpen(false)}
        />
      )}
    </div>
  );
}
