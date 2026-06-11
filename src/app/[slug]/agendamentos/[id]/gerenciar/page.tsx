"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import * as Icons from "../../../_components/Icons";

interface AppointmentInfo {
  id: string;
  serviceName: string;
  customerFirstName: string;
  startsAt: string;
  endsAt: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
  price: string;
  professionalName: string;
}

interface Slot {
  startsAt: string;
  endsAt: string;
}

type Mode = "view" | "reschedule" | "canceled" | "rescheduled";

const DOW_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MON_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MON_FULL = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: "Agendado", color: "#C9A84C" },
  COMPLETED: { label: "Concluído", color: "#6FBF8F" },
  CANCELED: { label: "Cancelado", color: "#E76A5A" },
  NO_SHOW: { label: "Não compareceu", color: "#8A847A" },
};

const fmtPrice = (p: string) => `R$ ${parseFloat(p).toFixed(2).replace(".", ",")}`;

function fmtDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function next14Days(): Date[] {
  const out: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    out.push(d);
  }
  return out;
}

export default function ManageAppointmentPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = use(params);

  const [info, setInfo] = useState<AppointmentInfo | null>(null);
  const [canCancel, setCanCancel] = useState(false);
  const [canReschedule, setCanReschedule] = useState(false);
  const [minHours, setMinHours] = useState(2);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState<Mode>("view");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reschedule state
  const dates = useMemo(() => next14Days(), []);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const fetchInfo = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/${slug}/appointments/${id}`);
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      setInfo(data.appointment);
      setCanCancel(data.canCancel);
      setCanReschedule(data.canReschedule);
      setMinHours(data.minHoursBefore ?? 2);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [slug, id]);

  useEffect(() => { void fetchInfo(); }, [fetchInfo]);

  useEffect(() => {
    if (!selectedDate || mode !== "reschedule") return;
    let cancelled = false;
    setLoadingSlots(true);
    setSelectedSlot(null);
    void (async () => {
      try {
        const res = await fetch(
          `/api/${slug}/appointments/${id}/slots?date=${fmtDateKey(selectedDate)}`,
        );
        const data = await res.json();
        if (!cancelled) setSlots(data.slots ?? []);
      } catch {
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, id, selectedDate, mode]);

  async function handleCancel() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/${slug}/appointments/${id}/cancel`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      setMode("canceled");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(
        data.error === "too_late"
          ? `O prazo para cancelar online já passou (até ${minHours}h antes). Entre em contato com a barbearia.`
          : "Não foi possível cancelar. Tente novamente.",
      );
      setConfirmCancel(false);
    }
  }

  async function handleReschedule() {
    if (!selectedSlot) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/${slug}/appointments/${id}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startsAt: selectedSlot.startsAt }),
    });
    setBusy(false);
    if (res.ok) {
      setMode("rescheduled");
      void fetchInfo();
    } else if (res.status === 409) {
      setError("Esse horário acabou de ser ocupado. Escolha outro.");
      setSelectedSlot(null);
      // refetch slots
      const d = selectedDate;
      setSelectedDate(null);
      setTimeout(() => setSelectedDate(d), 50);
    } else {
      setError("Não foi possível reagendar. Tente novamente.");
    }
  }

  const fmtHM = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="mng-bg">
        <div className="loading-row" style={{ minHeight: "60dvh" }}>
          <div className="spin spin-gold" />
          <span className="lbl">carregando agendamento</span>
        </div>
        <ManageStyles />
      </div>
    );
  }

  if (notFound || !info) {
    return (
      <div className="mng-bg">
        <div className="mng-card" style={{ textAlign: "center" }}>
          <p style={{ color: "var(--paper-dim)", fontSize: 15, marginBottom: 18 }}>
            Agendamento não encontrado.
          </p>
          <a className="btn btn-ghost" href={`/${slug}`}>
            Ir para o site da barbearia
          </a>
        </div>
        <ManageStyles />
      </div>
    );
  }

  const start = new Date(info.startsAt);
  const end = new Date(info.endsAt);
  const dateStr = `${DOW_PT[start.getDay()]}, ${start.getDate()} de ${MON_FULL[start.getMonth()]}`;
  const timeStr = `${fmtHM(info.startsAt)} – ${fmtHM(info.endsAt)}`;
  const status = STATUS_INFO[info.status] ?? STATUS_INFO.SCHEDULED;

  return (
    <div className="mng-bg">
      <div className="mng-aura" aria-hidden="true" />

      <div className="mng-wrap">
        {/* Brand */}
        <a href={`/${slug}`} className="mng-brand">
          <span className="mark">S</span>
          <span>
            SANTOS<span className="studios">STUDIOS</span>
          </span>
        </a>

        {mode === "canceled" ? (
          <div className="mng-card mng-anim" style={{ textAlign: "center" }}>
            <div className="mng-ring" style={{ borderColor: "#E76A5A", color: "#E76A5A" }}>
              <Icons.Close style={{ width: 30, height: 30 }} />
            </div>
            <h2 style={{ fontSize: 24, marginBottom: 8 }}>Agendamento cancelado</h2>
            <p style={{ color: "var(--paper-mute)", fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              Sem problemas, {info.customerFirstName}. Quando quiser, é só marcar
              um novo horário.
            </p>
            <a className="btn btn-primary" href={`/${slug}`}>
              Agendar novo horário
              <Icons.ArrowRight style={{ width: 14, height: 14 }} />
            </a>
          </div>
        ) : mode === "rescheduled" ? (
          <div className="mng-card mng-anim" style={{ textAlign: "center" }}>
            <div className="mng-ring">
              <Icons.Check style={{ width: 30, height: 30 }} />
            </div>
            <h2 style={{ fontSize: 24, marginBottom: 8 }}>Horário remarcado</h2>
            <p style={{ color: "var(--paper-mute)", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              Prontinho, {info.customerFirstName}. Seu novo horário:
            </p>
            <div className="conf-card" style={{ textAlign: "left", marginBottom: 24 }}>
              <div className="conf-row">
                <span className="k">Quando</span>
                <span className="v">
                  <span className="big">{fmtHM(info.startsAt)}</span>
                  {`${DOW_PT[new Date(info.startsAt).getDay()]}, ${new Date(info.startsAt).getDate()} de ${MON_FULL[new Date(info.startsAt).getMonth()]}`}
                </span>
              </div>
              <div className="conf-row">
                <span className="k">Profissional</span>
                <span className="v">{info.professionalName}</span>
              </div>
            </div>
            <a className="btn btn-ghost" href={`/${slug}`}>
              Voltar para o site
            </a>
          </div>
        ) : mode === "reschedule" ? (
          <div className="mng-card mng-anim">
            <button
              className="mng-back"
              onClick={() => { setMode("view"); setSelectedDate(null); setSelectedSlot(null); setError(null); }}
            >
              <Icons.ArrowLeft style={{ width: 13, height: 13 }} />
              Voltar
            </button>
            <h2 style={{ fontSize: 22, marginBottom: 6 }}>Escolha o novo horário</h2>
            <p style={{ color: "var(--paper-mute)", fontSize: 13, marginBottom: 20 }}>
              Com {info.professionalName} · {info.serviceName}
            </p>

            <div className="date-rail" style={{ margin: "0 -22px", paddingLeft: 22, paddingRight: 22 }}>
              {dates.map((d) => {
                const k = fmtDateKey(d);
                const isSel = selectedDate && fmtDateKey(selectedDate) === k;
                return (
                  <button
                    key={k}
                    type="button"
                    className={`date-chip ${isSel ? "sel" : ""}`}
                    onClick={() => setSelectedDate(d)}
                  >
                    <div className="dow">{DOW_PT[d.getDay()]}</div>
                    <div className="d">{d.getDate()}</div>
                    <div className="mon">{MON_PT[d.getMonth()]}</div>
                  </button>
                );
              })}
            </div>

            {selectedDate && (
              <div style={{ marginTop: 22, borderTop: "1px solid var(--ink-line)", paddingTop: 20 }}>
                {loadingSlots ? (
                  <div className="loading-row">
                    <div className="spin spin-gold" />
                    <span className="lbl">buscando horários</span>
                  </div>
                ) : slots.length === 0 ? (
                  <div className="empty">
                    <Icons.Clock className="ic" />
                    <div>Nenhum horário livre nesta data.</div>
                  </div>
                ) : (
                  <div className="slots">
                    {slots.map((s) => (
                      <button
                        key={s.startsAt}
                        type="button"
                        className={`slot ${selectedSlot?.startsAt === s.startsAt ? "sel" : ""}`}
                        onClick={() => setSelectedSlot(s)}
                      >
                        {fmtHM(s.startsAt)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && <div className="err-banner" style={{ marginTop: 16 }}>{error}</div>}

            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 20 }}
              disabled={!selectedSlot || busy}
              onClick={handleReschedule}
            >
              {busy ? (
                <>
                  <span className="spin" />
                  Remarcando...
                </>
              ) : (
                <>
                  Confirmar novo horário
                  <Icons.Check style={{ width: 14, height: 14 }} />
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="mng-card mng-anim">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  background: status.color + "1d",
                  color: status.color,
                  border: `1px solid ${status.color}55`,
                }}
              >
                {status.label}
              </span>
            </div>
            <h2 style={{ fontSize: 24, margin: "10px 0 4px" }}>
              Olá, {info.customerFirstName}.
            </h2>
            <p style={{ color: "var(--paper-mute)", fontSize: 14, marginBottom: 22 }}>
              Aqui estão os detalhes do seu horário.
            </p>

            <div className="conf-card" style={{ marginBottom: 20 }}>
              <div className="conf-row">
                <span className="k">Serviço</span>
                <span className="v">
                  <span className="big">{info.serviceName}</span>
                  {fmtPrice(info.price)}
                </span>
              </div>
              <div className="conf-row">
                <span className="k">Profissional</span>
                <span className="v">{info.professionalName}</span>
              </div>
              <div className="conf-row">
                <span className="k">Quando</span>
                <span className="v">
                  <span className="big">{timeStr}</span>
                  {dateStr}
                </span>
              </div>
              <div className="conf-row">
                <span className="k">Endereço</span>
                <span className="v" style={{ fontSize: 12 }}>
                  Travessa Dr. Édson Ribeiro, 10 A
                  <br />
                  Juazeiro · BA
                </span>
              </div>
            </div>

            {error && <div className="err-banner">{error}</div>}

            {info.status === "SCHEDULED" && (canCancel || canReschedule) ? (
              confirmCancel ? (
                <div className="mng-confirm mng-anim">
                  <p style={{ color: "var(--paper)", fontSize: 14, fontWeight: 600, marginBottom: 14, textAlign: "center" }}>
                    Cancelar este agendamento?
                  </p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      className="btn btn-ghost"
                      style={{ flex: 1 }}
                      onClick={() => setConfirmCancel(false)}
                      disabled={busy}
                    >
                      Manter horário
                    </button>
                    <button
                      className="btn"
                      style={{
                        flex: 1,
                        background: "rgba(231,106,90,0.12)",
                        border: "1px solid rgba(231,106,90,0.5)",
                        color: "#E76A5A",
                        fontWeight: 700,
                      }}
                      onClick={handleCancel}
                      disabled={busy}
                    >
                      {busy ? "Cancelando..." : "Sim, cancelar"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {canReschedule && (
                    <button className="btn btn-primary" onClick={() => setMode("reschedule")}>
                      Remarcar horário
                      <Icons.Calendar style={{ width: 15, height: 15 }} />
                    </button>
                  )}
                  {canCancel && (
                    <button
                      className="btn btn-ghost"
                      style={{ color: "#E76A5A", borderColor: "rgba(231,106,90,0.35)" }}
                      onClick={() => setConfirmCancel(true)}
                    >
                      Cancelar agendamento
                    </button>
                  )}
                  <p style={{ color: "var(--paper-mute)", fontSize: 11.5, textAlign: "center", marginTop: 4, lineHeight: 1.5 }}>
                    Alterações online até {minHours}h antes do horário. Depois
                    disso, fale direto com a barbearia.
                  </p>
                </div>
              )
            ) : info.status === "SCHEDULED" ? (
              <p style={{ color: "var(--paper-mute)", fontSize: 13, textAlign: "center", lineHeight: 1.6 }}>
                O prazo para alterações online já passou (até {minHours}h antes).
                <br />
                Precisa mudar? Fale direto com a barbearia.
              </p>
            ) : (
              <a className="btn btn-primary" style={{ width: "100%" }} href={`/${slug}`}>
                Agendar novo horário
                <Icons.ArrowRight style={{ width: 14, height: 14 }} />
              </a>
            )}
          </div>
        )}
      </div>

      <ManageStyles />
    </div>
  );
}

function ManageStyles() {
  return (
    <style>{`
      .mng-bg {
        min-height: 100dvh;
        background: var(--ink, #0B0B0B);
        position: relative;
        overflow-x: hidden;
        display: flex;
        flex-direction: column;
      }
      .mng-aura {
        position: absolute;
        width: 640px;
        height: 420px;
        top: -160px;
        left: 50%;
        transform: translateX(-50%);
        background: radial-gradient(ellipse at center, rgba(201,168,76,0.12), transparent 65%);
        pointer-events: none;
      }
      .mng-wrap {
        width: 100%;
        max-width: 480px;
        margin: 0 auto;
        padding: 28px 20px calc(40px + env(safe-area-inset-bottom));
        position: relative;
        z-index: 1;
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .mng-brand {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        font-family: 'Playfair Display', Georgia, serif;
        font-weight: 700;
        letter-spacing: 0.06em;
        font-size: 15px;
        color: var(--paper);
        margin-bottom: 28px;
      }
      .mng-brand .mark {
        width: 34px;
        height: 34px;
        border: 1px solid var(--gold);
        border-radius: 999px;
        display: grid;
        place-items: center;
        color: var(--gold);
        font-style: italic;
        font-size: 17px;
        box-shadow: 0 0 24px -10px var(--gold);
      }
      .mng-brand .studios {
        font-family: 'JetBrains Mono', monospace;
        font-style: normal;
        color: var(--gold);
        font-size: 10px;
        letter-spacing: 0.32em;
        margin-left: 6px;
      }
      .mng-card {
        background: rgba(19,18,17,0.78);
        backdrop-filter: blur(20px) saturate(1.3);
        -webkit-backdrop-filter: blur(20px) saturate(1.3);
        border: 1px solid var(--ink-line);
        border-radius: 20px;
        padding: 26px 22px;
        box-shadow: 0 40px 80px -40px rgba(0,0,0,0.9), 0 0 0 1px rgba(201,168,76,0.05);
      }
      .mng-anim { animation: mngIn 0.45s cubic-bezier(.2,.7,.2,1); }
      @keyframes mngIn {
        from { opacity: 0; transform: translateY(18px); }
        to { opacity: 1; transform: none; }
      }
      .mng-ring {
        width: 72px;
        height: 72px;
        margin: 6px auto 18px;
        border-radius: 50%;
        border: 1px solid var(--gold);
        background: radial-gradient(circle at 30% 30%, rgba(201,168,76,0.2), transparent 70%);
        display: grid;
        place-items: center;
        color: var(--gold);
        animation: mngRing 0.55s cubic-bezier(.2,.7,.2,1);
      }
      @keyframes mngRing {
        from { transform: scale(0.5); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      .mng-back {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 0;
        margin-bottom: 14px;
        background: none;
        border: none;
        color: var(--paper-mute);
        font-size: 13px;
        cursor: pointer;
        transition: color 0.2s;
        min-height: 44px;
      }
      .mng-back:hover { color: var(--gold); }
      .mng-confirm {
        border: 1px solid rgba(231,106,90,0.3);
        background: rgba(231,106,90,0.05);
        border-radius: 14px;
        padding: 18px 16px;
      }
      @media (prefers-reduced-motion: reduce) {
        .mng-anim, .mng-ring { animation: none !important; }
      }
    `}</style>
  );
}
