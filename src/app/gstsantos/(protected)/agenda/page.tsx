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
    <div className="gst-page">
      {/* Header */}
      <div className="gst-head">
        <h1 className="gst-title">Agenda</h1>
        <button onClick={() => setNewOpen(true)} className="gst-btn gst-btn-gold">
          <Plus size={15} strokeWidth={2.5} />
          Novo agendamento
        </button>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar cliente..."
          className="gst-input"
          style={{ marginLeft: "auto", minWidth: 180, fontSize: 13 }}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="gst-input"
          style={{ fontSize: 13 }}
        />
      </div>

      {/* View tabs */}
      <div className="gst-tabs" style={{ marginBottom: 20 }}>
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`gst-tab${view === v.key ? " on" : ""}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="gst-skel" style={{ height: 72 }} />
          <div className="gst-skel" style={{ height: 72, opacity: 0.7 }} />
          <div className="gst-skel" style={{ height: 72, opacity: 0.45 }} />
        </div>
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
