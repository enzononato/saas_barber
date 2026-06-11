"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";

interface Barber {
  userId: string;
  name: string;
  isBarber: boolean;
  hasWorkingHours: boolean;
}

interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  price: string;
  isActive: boolean;
}

interface CustomerSuggestion {
  id: string;
  name: string;
  phone: string;
}

interface Slot {
  startsAt: string;
  endsAt: string;
}

interface Props {
  defaultDate: string; // YYYY-MM-DD
  /** Barbeiro comum só agenda para si */
  lockedProfessionalId?: string;
  onCreated: () => void;
  onClose: () => void;
}

const fmtPrice = (p: string) => `R$ ${parseFloat(p).toFixed(2).replace(".", ",")}`;

function fmtPhoneBR(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function NewAppointmentModal({ defaultDate, lockedProfessionalId, onCreated, onClose }: Props) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionalId, setProfessionalId] = useState<string>(lockedProfessionalId ?? "");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState(defaultDate);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carrega barbeiros + serviços
  useEffect(() => {
    void (async () => {
      const [bRes, sRes] = await Promise.all([
        fetch("/api/gstsantos/barbers"),
        fetch("/api/gstsantos/services"),
      ]);
      if (bRes.ok) {
        const rows = (await bRes.json()) as Barber[];
        setBarbers(rows.filter((b) => b.isBarber && b.hasWorkingHours));
      }
      if (sRes.ok) {
        const rows = (await sRes.json()) as Service[];
        setServices(rows.filter((s) => s.isActive));
      }
    })();
  }, []);

  // Busca de cliente existente (300ms debounce)
  useEffect(() => {
    if (clientName.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/gstsantos/customers?search=${encodeURIComponent(clientName.trim())}&limit=5`,
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestions(
          (data.customers ?? data ?? []).slice(0, 5).map((c: CustomerSuggestion) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
          })),
        );
      }
    }, 300);
    return () => clearTimeout(t);
  }, [clientName]);

  // Slots livres
  const fetchSlots = useCallback(async () => {
    if (!professionalId || selectedServiceIds.length === 0 || !date) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    setSelectedSlot(null);
    const res = await fetch(
      `/api/gstsantos/availability?professionalId=${professionalId}&serviceIds=${selectedServiceIds.join(",")}&date=${date}`,
    );
    if (res.ok) {
      const data = await res.json();
      setSlots(data.slots ?? []);
    } else {
      setSlots([]);
    }
    setLoadingSlots(false);
  }, [professionalId, selectedServiceIds, date]);

  useEffect(() => { void fetchSlots(); }, [fetchSlots]);

  const totals = useMemo(() => {
    const sel = services.filter((s) => selectedServiceIds.includes(s.id));
    return {
      price: sel.reduce((sum, s) => sum + parseFloat(s.price), 0),
      duration: sel.reduce((sum, s) => sum + s.durationMinutes, 0),
    };
  }, [services, selectedServiceIds]);

  function toggleService(id: string) {
    setSelectedServiceIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  const phoneDigits = clientPhone.replace(/\D/g, "");
  const canSubmit =
    professionalId &&
    selectedServiceIds.length > 0 &&
    selectedSlot &&
    clientName.trim().length >= 2 &&
    phoneDigits.length >= 10;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/gstsantos/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        professionalId,
        serviceIds: selectedServiceIds,
        startsAt: selectedSlot!.startsAt,
        clientName: clientName.trim(),
        clientPhone,
        notes: notes.trim() || undefined,
      }),
    });

    setSubmitting(false);

    if (res.ok) {
      onCreated();
    } else if (res.status === 409) {
      setError("Esse horário acabou de ser ocupado. Escolha outro.");
      void fetchSlots();
    } else {
      setError("Erro ao criar agendamento. Verifique os dados.");
    }
  }

  const fmtHM = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 110,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        animation: "fadeIn 0.2s ease",
      }}
      className="gst-newapt-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "92dvh",
          overflowY: "auto",
          background: "#131211",
          border: "1px solid #2A2620",
          borderRadius: "20px 20px 0 0",
          padding: "22px 22px calc(22px + env(safe-area-inset-bottom))",
          animation: "sheetIn 0.3s cubic-bezier(.2,.7,.2,1)",
        }}
        className="gst-newapt-sheet"
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#F4EEDF", margin: 0 }}>
            Novo agendamento
          </h2>
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "1px solid #2A2620",
              background: "transparent",
              color: "#8A847A",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Cliente */}
        <p style={sectionLabel}>Cliente</p>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <input
            type="text"
            value={clientName}
            onChange={(e) => {
              setClientName(e.target.value);
              setShowSuggestions(true);
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
            placeholder="Nome do cliente"
            style={inputStyle}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                marginTop: 4,
                background: "#1B1916",
                border: "1px solid #2A2620",
                borderRadius: 10,
                overflow: "hidden",
                zIndex: 5,
                boxShadow: "0 12px 30px -10px rgba(0,0,0,0.7)",
              }}
            >
              {suggestions.map((c) => (
                <button
                  key={c.id}
                  onMouseDown={() => {
                    setClientName(c.name);
                    setClientPhone(fmtPhoneBR(c.phone));
                    setShowSuggestions(false);
                  }}
                  style={{
                    display: "flex",
                    width: "100%",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid #2A2620",
                    color: "#F4EEDF",
                    fontSize: 13,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>{c.name}</span>
                  <span style={{ color: "#8A847A", fontSize: 12 }}>{fmtPhoneBR(c.phone)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          type="tel"
          inputMode="numeric"
          value={clientPhone}
          onChange={(e) => setClientPhone(fmtPhoneBR(e.target.value))}
          placeholder="(74) 99999-9999"
          style={{ ...inputStyle, marginBottom: 18 }}
        />

        {/* Profissional */}
        {!lockedProfessionalId && (
          <>
            <p style={sectionLabel}>Profissional</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
              {barbers.map((b) => {
                const sel = professionalId === b.userId;
                return (
                  <button
                    key={b.userId}
                    onClick={() => setProfessionalId(b.userId)}
                    style={{
                      padding: "9px 16px",
                      minHeight: 40,
                      borderRadius: 999,
                      border: sel ? "1px solid #C9A84C" : "1px solid #2A2620",
                      background: sel ? "rgba(201,168,76,0.12)" : "transparent",
                      color: sel ? "#C9A84C" : "#C8C2B4",
                      fontWeight: sel ? 700 : 500,
                      fontSize: 13,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {b.name}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Serviços (multi) */}
        <p style={sectionLabel}>
          Serviços{" "}
          {selectedServiceIds.length > 0 && (
            <span style={{ color: "#C9A84C" }}>
              · {fmtPrice(String(totals.price))} · {totals.duration} min
            </span>
          )}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
          {services.map((s) => {
            const sel = selectedServiceIds.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggleService(s.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "11px 14px",
                  minHeight: 44,
                  borderRadius: 10,
                  border: sel ? "1px solid #C9A84C" : "1px solid #2A2620",
                  background: sel ? "rgba(201,168,76,0.07)" : "transparent",
                  color: "#F4EEDF",
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s",
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    border: sel ? "none" : "1px solid #2A2620",
                    background: sel ? "#C9A84C" : "transparent",
                    display: "grid",
                    placeItems: "center",
                    color: "#1A1408",
                    flexShrink: 0,
                  }}
                >
                  {sel && <Check size={12} strokeWidth={3} />}
                </span>
                <span style={{ flex: 1 }}>{s.name}</span>
                <span style={{ color: "#8A847A", fontSize: 12 }}>
                  {s.durationMinutes} min · {fmtPrice(s.price)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Data + horário */}
        <p style={sectionLabel}>Data e horário</p>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ ...inputStyle, marginBottom: 12 }}
        />
        {loadingSlots ? (
          <p style={{ color: "#8A847A", fontSize: 13, marginBottom: 18 }}>Buscando horários...</p>
        ) : !professionalId || selectedServiceIds.length === 0 ? (
          <p style={{ color: "#8A847A", fontSize: 13, marginBottom: 18 }}>
            Selecione o profissional e ao menos um serviço.
          </p>
        ) : slots.length === 0 ? (
          <p style={{ color: "#8A847A", fontSize: 13, marginBottom: 18 }}>
            Nenhum horário livre nesta data.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
              gap: 8,
              marginBottom: 18,
            }}
          >
            {slots.map((s) => {
              const sel = selectedSlot?.startsAt === s.startsAt;
              return (
                <button
                  key={s.startsAt}
                  onClick={() => setSelectedSlot(s)}
                  style={{
                    padding: "10px 4px",
                    minHeight: 42,
                    borderRadius: 10,
                    border: sel ? "1px solid #C9A84C" : "1px solid #2A2620",
                    background: sel ? "#C9A84C" : "#0B0B0B",
                    color: sel ? "#1A1408" : "#C8C2B4",
                    fontWeight: sel ? 700 : 500,
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {fmtHM(s.startsAt)}
                </button>
              );
            })}
          </div>
        )}

        {/* Observações */}
        <p style={sectionLabel}>Observações (opcional)</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: prefere máquina 1 nas laterais"
          style={{ ...inputStyle, minHeight: 64, resize: "vertical", marginBottom: 16 }}
        />

        {error && (
          <p style={{ color: "#E57373", fontSize: 13, margin: "0 0 14px" }}>{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          style={{
            width: "100%",
            padding: "14px 24px",
            minHeight: 48,
            background: "linear-gradient(180deg,#E0BE5C,#C9A84C 48%,#8E6A24)",
            color: "#1A1408",
            fontWeight: 700,
            fontSize: 15,
            border: "none",
            borderRadius: 999,
            cursor: !canSubmit || submitting ? "not-allowed" : "pointer",
            opacity: !canSubmit || submitting ? 0.45 : 1,
            transition: "opacity 0.2s",
          }}
        >
          {submitting ? "Agendando..." : "Criar agendamento"}
        </button>

        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes sheetIn { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
          @media (min-width: 640px) {
            .gst-newapt-overlay { align-items: center !important; padding: 20px; }
            .gst-newapt-sheet { border-radius: 20px !important; }
          }
        `}</style>
      </div>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#8A847A",
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  background: "#0B0B0B",
  border: "1px solid #2A2620",
  borderRadius: 10,
  color: "#F4EEDF",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};
