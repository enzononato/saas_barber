"use client";

import { useEffect, useMemo, useState } from "react";
import * as Icons from "./Icons";

export interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: string;
}

export interface Member {
  id: string;
  name: string;
}

interface Slot {
  startsAt: string;
  endsAt: string;
}

interface WizardProps {
  slug: string;
  open: boolean;
  onClose: () => void;
  services: Service[];
  members: Member[];
  loadingServices: boolean;
  loadingMembers: boolean;
  presetService: Service | null;
}

const fmtPrice = (price: string | number) =>
  `R$ ${parseFloat(String(price)).toFixed(2).replace(".", ",")}`;

const fmtDuration = (min: number) => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
};

const STEP_TITLES = [
  "Escolha os serviços",
  "Quem corta hoje?",
  "Data e horário",
  "Seus dados",
  "Confirme tudo",
];

const TOTAL_STEPS = 5;

const DOW_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MON_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MON_FULL = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

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

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="wz-progress">
      <span style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
    </div>
  );
}

function StepService({
  services,
  loading,
  selected,
  onToggle,
}: {
  services: Service[];
  loading: boolean;
  selected: Service[];
  onToggle: (s: Service) => void;
}) {
  if (loading) {
    return (
      <div className="loading-row">
        <div className="spin spin-gold" />
        <span className="lbl">carregando serviços</span>
      </div>
    );
  }

  const totalPrice = selected.reduce((sum, s) => sum + parseFloat(s.price), 0);
  const totalDuration = selected.reduce((sum, s) => sum + s.durationMinutes, 0);

  return (
    <div className="wz-step">
      <p style={{ color: "var(--paper-mute)", fontSize: 14, marginBottom: 18 }}>
        Escolha um ou mais serviços — dá pra combinar corte, barba e mais no
        mesmo horário.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {services.map((s) => {
          const isSel = selected.some((x) => x.id === s.id);
          return (
            <button
              key={s.id}
              type="button"
              className={`opt ${isSel ? "sel" : ""}`}
              onClick={() => onToggle(s)}
            >
              <div className="body">
                <div className="ttl">{s.name}</div>
                <div className="sub">{s.description}</div>
              </div>
              <div className="right">
                <div className="price">{fmtPrice(s.price)}</div>
                <div className="dur">{fmtDuration(s.durationMinutes)}</div>
              </div>
              <div className="check">
                <Icons.Check />
              </div>
            </button>
          );
        })}
      </div>

      {selected.length > 1 && (
        <div className="wz-combo-bar">
          <span className="n">{selected.length} serviços</span>
          <span className="t">
            {fmtDuration(totalDuration)} · <strong>{fmtPrice(totalPrice)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}

function StepMember({
  members,
  loading,
  selected,
  onSelect,
}: {
  members: Member[];
  loading: boolean;
  selected: Member | null;
  onSelect: (m: Member) => void;
}) {
  if (loading) {
    return (
      <div className="loading-row">
        <div className="spin spin-gold" />
        <span className="lbl">carregando profissionais</span>
      </div>
    );
  }
  return (
    <div className="wz-step">
      <p style={{ color: "var(--paper-mute)", fontSize: 14, marginBottom: 18 }}>
        Escolha um profissional ou deixe que a casa decida.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`opt ${selected?.id === m.id ? "sel" : ""}`}
            onClick={() => onSelect(m)}
          >
            <div className="avatar">
              {m.id === "any" ? (
                <Icons.Star style={{ width: 18, height: 18, color: "var(--gold)" }} />
              ) : (
                <span>{m.name[0]}</span>
              )}
            </div>
            <div className="body">
              <div className="ttl">{m.name}</div>
              <div className="sub">
                {m.id === "any"
                  ? "Primeiro horário disponível com qualquer barbeiro"
                  : "Barbeiro"}
              </div>
            </div>
            <div className="check">
              <Icons.Check />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepDateAndTime({
  slug,
  memberId,
  serviceIds,
  selectedDate,
  selectedSlot,
  onSelectDate,
  onSelectSlot,
}: {
  slug: string;
  memberId: string;
  serviceIds: string;
  selectedDate: Date | null;
  selectedSlot: Slot | null;
  onSelectDate: (d: Date) => void;
  onSelectSlot: (s: Slot | null) => void;
}) {
  const dates = useMemo(() => next14Days(), []);
  const [availMap, setAvailMap] = useState<Record<string, boolean>>({});
  const [loadingDates, setLoadingDates] = useState(true);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingDates(true);
    (async () => {
      const entries = await Promise.all(
        dates.map(async (d) => {
          const k = fmtDateKey(d);
          try {
            const r = await fetch(
              `/api/${slug}/availability?memberId=${memberId}&serviceIds=${serviceIds}&date=${k}`,
            );
            const json = await r.json();
            return [k, (json.slots?.length ?? 0) > 0] as [string, boolean];
          } catch {
            return [k, false] as [string, boolean];
          }
        }),
      );
      if (!cancelled) {
        setAvailMap(Object.fromEntries(entries));
        setLoadingDates(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, memberId, serviceIds]);

  useEffect(() => {
    if (!selectedDate) { setSlots([]); return; }
    let cancelled = false;
    setLoadingSlots(true);
    (async () => {
      try {
        const r = await fetch(
          `/api/${slug}/availability?memberId=${memberId}&serviceIds=${serviceIds}&date=${fmtDateKey(selectedDate)}`,
        );
        const json = await r.json();
        if (!cancelled) setSlots(json.slots ?? []);
      } catch {
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, memberId, serviceIds, selectedDate]);

  const groups = useMemo(() => {
    const m: Slot[] = [], t: Slot[] = [], n: Slot[] = [];
    slots.forEach((s) => {
      const h = new Date(s.startsAt).getHours();
      if (h < 12) m.push(s);
      else if (h < 18) t.push(s);
      else n.push(s);
    });
    return { m, t, n };
  }, [slots]);

  const fmtHM = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const handleDateSelect = (d: Date) => {
    onSelectDate(d);
    onSelectSlot(null);
  };

  const renderSlotGroup = (label: string, arr: Slot[]) =>
    arr.length > 0 && (
      <div className="slot-group">
        <h5>
          {label} <span style={{ color: "var(--paper-mute)" }}>· {arr.length}</span>
        </h5>
        <div className="slots">
          {arr.map((s) => (
            <button
              key={s.startsAt}
              type="button"
              className={`slot ${selectedSlot?.startsAt === s.startsAt ? "sel" : ""}`}
              onClick={() => onSelectSlot(s)}
            >
              {fmtHM(s.startsAt)}
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <div className="wz-step">
      <p style={{ color: "var(--paper-mute)", fontSize: 14, marginBottom: 18 }}>
        Próximos 14 dias. Dias sem espaço aparecem desabilitados.
      </p>

      {loadingDates ? (
        <div className="loading-row">
          <div className="spin spin-gold" />
          <span className="lbl">verificando disponibilidade</span>
        </div>
      ) : (
        <div className="date-rail">
          {dates.map((d) => {
            const k = fmtDateKey(d);
            const has = availMap[k];
            const isSel = selectedDate && fmtDateKey(selectedDate) === k;
            return (
              <button
                key={k}
                type="button"
                className={`date-chip ${isSel ? "sel" : ""}`}
                disabled={!has}
                onClick={() => handleDateSelect(d)}
              >
                <div className="dow">{DOW_PT[d.getDay()]}</div>
                <div className="d">{d.getDate()}</div>
                <div className="mon">{MON_PT[d.getMonth()]}</div>
              </button>
            );
          })}
        </div>
      )}

      {!loadingDates && Object.values(availMap).every((v) => !v) && (
        <div className="empty" style={{ marginTop: 20 }}>
          <Icons.Calendar className="ic" />
          <div>Sem disponibilidade nos próximos 14 dias.</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Tente outro profissional.</div>
        </div>
      )}

      {selectedDate && (
        <div style={{ marginTop: 28, borderTop: "1px solid var(--ink-line)", paddingTop: 24 }}>
          {loadingSlots ? (
            <div className="loading-row">
              <div className="spin spin-gold" />
              <span className="lbl">buscando horários</span>
            </div>
          ) : slots.length === 0 ? (
            <div className="empty">
              <Icons.Clock className="ic" />
              <div>Nenhum horário disponível nesta data.</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Tente outro dia.</div>
            </div>
          ) : (
            <>
              <p style={{ color: "var(--paper-mute)", fontSize: 14, marginBottom: 18 }}>
                {DOW_PT[selectedDate.getDay()]}, {selectedDate.getDate()} de {MON_FULL[selectedDate.getMonth()]}
                {" · "}
                <span style={{ color: "var(--gold)" }}>{slots.length} horários</span>
              </p>
              {renderSlotGroup("Manhã", groups.m)}
              {renderSlotGroup("Tarde", groups.t)}
              {renderSlotGroup("Noite", groups.n)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function formatPhoneBR(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  // Remove "55" country code prefix if present (collado from formats like +55 ou 0055)
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

interface FormState {
  clientName: string;
  clientPhone: string;
  notes: string;
}

function StepDetails({
  form,
  setForm,
  errors,
}: {
  form: FormState;
  setForm: (patch: Partial<FormState>) => void;
  errors: Partial<Record<keyof FormState, string>>;
}) {
  return (
    <div className="wz-step">
      <p style={{ color: "var(--paper-mute)", fontSize: 14, marginBottom: 18 }}>
        Precisamos só do essencial. Nada de senha ou cadastro.
      </p>
      <div className="field">
        <label>
          Nome completo <span className="req">*</span>
        </label>
        <input
          type="text"
          placeholder="Como devemos te chamar?"
          value={form.clientName}
          onChange={(e) => setForm({ clientName: e.target.value })}
          autoFocus
        />
        {errors.clientName && <div className="err">{errors.clientName}</div>}
      </div>
      <div className="field">
        <label>
          Telefone (WhatsApp) <span className="req">*</span>
        </label>
        <input
          type="tel"
          inputMode="numeric"
          placeholder="(11) 98765-4321"
          value={form.clientPhone}
          onChange={(e) => setForm({ clientPhone: formatPhoneBR(e.target.value) })}
        />
        {errors.clientPhone && <div className="err">{errors.clientPhone}</div>}
      </div>
      <div className="field">
        <label>
          Observações <span style={{ opacity: 0.5 }}>(opcional)</span>
        </label>
        <textarea
          placeholder="Ex: mais curto nos lados, manter o topo, barba só aparar…"
          value={form.notes}
          onChange={(e) => setForm({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}

function StepConfirm({
  payload,
  errorMsg,
}: {
  payload: { services: Service[]; member: Member; slot: Slot; clientName: string; clientPhone: string; notes: string };
  errorMsg: string | null;
}) {
  const { services, member, slot, clientName, clientPhone, notes } = payload;
  const start = new Date(slot.startsAt);
  const end = new Date(slot.endsAt);
  const dateStr = `${DOW_PT[start.getDay()]}, ${start.getDate()} de ${MON_FULL[start.getMonth()]}`;
  const timeStr = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")} – ${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
  const totalPrice = services.reduce((sum, s) => sum + parseFloat(s.price), 0);
  const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);
  return (
    <div className="wz-step">
      {errorMsg && <div className="err-banner">{errorMsg}</div>}
      <p style={{ color: "var(--paper-mute)", fontSize: 14, marginBottom: 18 }}>
        Tudo certo? Confirme abaixo e te esperamos na cadeira.
      </p>
      <div className="conf-card">
        <div className="conf-row">
          <span className="k">{services.length > 1 ? "Serviços" : "Serviço"}</span>
          <span className="v">
            <span className="big">{services.map((s) => s.name).join(" + ")}</span>
            {fmtDuration(totalDuration)} · {fmtPrice(totalPrice)}
          </span>
        </div>
        <div className="conf-row">
          <span className="k">Profissional</span>
          <span className="v">{member.name}</span>
        </div>
        <div className="conf-row">
          <span className="k">Quando</span>
          <span className="v">
            <span className="big">{timeStr}</span>
            {dateStr}
          </span>
        </div>
        <div className="conf-row">
          <span className="k">Cliente</span>
          <span className="v">
            {clientName}
            <br />
            {clientPhone}
          </span>
        </div>
        {notes && (
          <div className="conf-row">
            <span className="k">Obs.</span>
            <span className="v" style={{ fontStyle: "italic", color: "var(--paper-dim)" }}>
              "{notes}"
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function StepSuccess({
  appt,
  payload,
  onAgain,
  onClose,
}: {
  appt: { id: string; startsAt: string; endsAt: string; manageUrl?: string };
  payload: { services: Service[]; member: Member; clientName: string };
  onAgain: () => void;
  onClose: () => void;
}) {
  const start = new Date(appt.startsAt);
  const dateStr = `${DOW_PT[start.getDay()]}, ${start.getDate()}/${String(start.getMonth() + 1).padStart(2, "0")}`;
  const timeStr = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
  return (
    <div className="wz-step success">
      <div className="ring">
        <Icons.Check />
      </div>
      <h3>Agendamento confirmado.</h3>
      <p className="lead">
        Te enviamos um lembrete por WhatsApp. Até logo, {payload.clientName.split(" ")[0]}.
      </p>
      <div className="conf-card" style={{ textAlign: "left", marginTop: 24 }}>
        <div className="conf-row">
          <span className="k">Código</span>
          <span className="v mono" style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--gold)", fontSize: 11 }}>
            {appt.id.slice(0, 8).toUpperCase()}
          </span>
        </div>
        <div className="conf-row">
          <span className="k">{payload.services.length > 1 ? "Serviços" : "Serviço"}</span>
          <span className="v">{payload.services.map((s) => s.name).join(" + ")}</span>
        </div>
        <div className="conf-row">
          <span className="k">Profissional</span>
          <span className="v">{payload.member.name}</span>
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
      {appt.manageUrl && (
        <p style={{ marginTop: 16, fontSize: 12, color: "var(--paper-mute)", lineHeight: 1.5 }}>
          Precisa remarcar ou cancelar?{" "}
          <a
            href={appt.manageUrl}
            style={{ color: "var(--gold)", textDecoration: "underline" }}
          >
            Gerencie seu agendamento aqui
          </a>
          .
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
        <button className="btn btn-primary" onClick={onAgain}>
          Agendar outro horário
        </button>
        <button className="btn btn-link" onClick={onClose}>
          Voltar para o site
        </button>
      </div>
    </div>
  );
}

export function Wizard({
  slug,
  open,
  onClose,
  services,
  members,
  loadingServices,
  loadingMembers,
  presetService,
}: WizardProps) {
  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setFormState] = useState<FormState>({ clientName: "", clientPhone: "", notes: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; startsAt: string; endsAt: string; manageUrl?: string } | null>(null);

  const setForm = (patch: Partial<FormState>) => setFormState((f) => ({ ...f, ...patch }));

  const serviceIdsKey = useMemo(
    () => selectedServices.map((s) => s.id).join(","),
    [selectedServices],
  );

  useEffect(() => {
    // Só aplica o preset quando o wizard ABRE com um preset definido
    if (open && presetService && selectedServices.length === 0) {
      setSelectedServices([presetService]);
      setStep(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetService]);

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep(1);
        setSelectedServices([]);
        setMember(null);
        setDate(null);
        setSlot(null);
        setFormState({ clientName: "", clientPhone: "", notes: "" });
        setErrors({});
        setSubmitting(false);
        setErrorMsg(null);
        setSuccess(null);
      }, 400);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => { setDate(null); setSlot(null); }, [member?.id, serviceIdsKey]);

  function toggleService(s: Service) {
    setSelectedServices((sel) =>
      sel.some((x) => x.id === s.id)
        ? sel.filter((x) => x.id !== s.id)
        : sel.length >= 5
          ? sel
          : [...sel, s],
    );
  }

  const validate = () => {
    if (step === 1) return selectedServices.length > 0;
    if (step === 2) return !!member;
    if (step === 3) return !!date && !!slot;
    if (step === 4) {
      const errs: Partial<Record<keyof FormState, string>> = {};
      if (!form.clientName.trim() || form.clientName.trim().length < 2)
        errs.clientName = "Informe seu nome completo.";
      const digits = form.clientPhone.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 11)
        errs.clientPhone = "Telefone inválido. Use DDD + número.";
      setErrors(errs);
      return Object.keys(errs).length === 0;
    }
    return true;
  };

  const handleNext = async () => {
    if (!validate()) return;
    if (step < 5) {
      setStep((s) => s + 1);
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/${slug}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceIds: selectedServices.map((s) => s.id),
          memberId: member!.id,
          startsAt: slot!.startsAt,
          clientName: form.clientName.trim(),
          clientPhone: form.clientPhone,
          notes: form.notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setErrorMsg("Esse horário acabou de ser preenchido. Escolha outro horário para continuar.");
        } else if (res.status === 503) {
          setErrorMsg("Nenhum profissional disponível para este horário. Tente outro horário.");
        } else {
          setErrorMsg("Algo deu errado. Tente novamente em instantes.");
        }
        return;
      }
      setSuccess(json.appointment);
    } catch {
      setErrorMsg("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (errorMsg) setErrorMsg(null);
    if (step > 1) setStep((s) => s - 1);
  };

  const handleErrorBackToTime = () => {
    setErrorMsg(null);
    setSlot(null);
    setStep(3);
  };

  const handleAgain = () => {
    setSuccess(null);
    setStep(1);
    setSelectedServices([]);
    setMember(null);
    setDate(null);
    setSlot(null);
    setFormState({ clientName: "", clientPhone: "", notes: "" });
    setErrors({});
    setErrorMsg(null);
  };

  const canNext = useMemo(() => {
    if (step === 1) return selectedServices.length > 0;
    if (step === 2) return !!member;
    if (step === 3) return !!date && !!slot;
    if (step === 4) {
      const digits = form.clientPhone.replace(/\D/g, "");
      return form.clientName.trim().length >= 2 && digits.length >= 10;
    }
    return true;
  }, [step, selectedServices, member, date, slot, form]);

  return (
    <>
      <div className={`wz-overlay ${open ? "open" : ""}`} onClick={onClose} />
      <aside className={`wz-sheet ${open ? "open" : ""}`} role="dialog" aria-modal="true">
        <div className="wz-top">
          <div className="row">
            <div>
              <div className="step">
                {success ? (
                  "Pronto"
                ) : (
                  <>
                    Etapa <span className="cur">{step}</span> de {TOTAL_STEPS}
                  </>
                )}
              </div>
              <div className="title">{success ? "Confirmado" : STEP_TITLES[step - 1]}</div>
            </div>
            <button className="close" onClick={onClose} aria-label="Fechar">
              <Icons.Close style={{ width: 16, height: 16 }} />
            </button>
          </div>
          {!success && <ProgressBar step={step} />}
        </div>

        <div className="wz-body">
          {success ? (
            <StepSuccess
              appt={success}
              payload={{ services: selectedServices, member: member!, clientName: form.clientName }}
              onAgain={handleAgain}
              onClose={onClose}
            />
          ) : (
            <>
              {step === 1 && (
                <StepService
                  services={services}
                  loading={loadingServices}
                  selected={selectedServices}
                  onToggle={toggleService}
                />
              )}
              {step === 2 && (
                <StepMember
                  members={members}
                  loading={loadingMembers}
                  selected={member}
                  onSelect={setMember}
                />
              )}
              {step === 3 && member && selectedServices.length > 0 && (
                <StepDateAndTime
                  slug={slug}
                  memberId={member.id}
                  serviceIds={serviceIdsKey}
                  selectedDate={date}
                  selectedSlot={slot}
                  onSelectDate={(d) => { setDate(d); setSlot(null); }}
                  onSelectSlot={(s) => setSlot(s)}
                />
              )}
              {step === 4 && (
                <StepDetails form={form} setForm={setForm} errors={errors} />
              )}
              {step === 5 && selectedServices.length > 0 && member && slot && (
                <StepConfirm
                  payload={{ services: selectedServices, member, slot, ...form }}
                  errorMsg={errorMsg}
                />
              )}
            </>
          )}
        </div>

        {!success && (
          <div className="wz-foot">
            {step > 1 && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleBack}
                disabled={submitting}
              >
                <Icons.ArrowLeft style={{ width: 14, height: 14 }} />
                Voltar
              </button>
            )}
            {step === 5 && errorMsg ? (
              <button type="button" className="btn btn-primary" onClick={handleErrorBackToTime}>
                Escolher outro horário
                <Icons.ArrowRight style={{ width: 14, height: 14 }} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNext}
                disabled={!canNext || submitting}
              >
                {submitting ? (
                  <>
                    <span className="spin" />
                    Confirmando...
                  </>
                ) : step === 5 ? (
                  <>
                    Confirmar agendamento
                    <Icons.Check style={{ width: 14, height: 14 }} />
                  </>
                ) : (
                  <>
                    Continuar
                    <Icons.ArrowRight style={{ width: 14, height: 14 }} />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
