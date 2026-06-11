"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";

interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: string;
  isActive: boolean;
  isAttached: boolean | null;
}

interface Me {
  role: "owner" | "member";
  canCreateServices: boolean;
}

function fmtR$(v: string) {
  return `R$ ${parseFloat(v).toFixed(2).replace(".", ",")}`;
}

function fmtDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

type ModalMode = "create" | "edit";

interface FormState {
  name: string;
  description: string;
  durationMinutes: string;
  price: string;
}

const DEFAULT_FORM: FormState = { name: "", description: "", durationMinutes: "30", price: "0" };

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: ModalMode; svc?: Service } | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [svcRes, meRes] = await Promise.all([
      fetch("/api/gstsantos/services"),
      fetch("/api/gstsantos/me"),
    ]);
    if (svcRes.ok) setServices(await svcRes.json());
    if (meRes.ok) setMe(await meRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const canManageServices = me?.role === "owner" || me?.canCreateServices;

  function openCreate() {
    setForm(DEFAULT_FORM);
    setModal({ mode: "create" });
  }

  function openEdit(svc: Service) {
    setForm({
      name: svc.name,
      description: svc.description ?? "",
      durationMinutes: String(svc.durationMinutes),
      price: svc.price,
    });
    setModal({ mode: "edit", svc });
  }

  async function handleSave() {
    setSaving(true);
    const body = {
      name: form.name,
      description: form.description || null,
      durationMinutes: parseInt(form.durationMinutes),
      price: parseFloat(form.price).toFixed(2),
    };

    if (modal?.mode === "create") {
      await fetch("/api/gstsantos/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else if (modal?.svc) {
      await fetch(`/api/gstsantos/services/${modal.svc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    setSaving(false);
    setModal(null);
    await fetchAll();
  }

  async function toggleActive(svc: Service) {
    await fetch(`/api/gstsantos/services/${svc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !svc.isActive }),
    });
    await fetchAll();
  }

  async function toggleAttach(svc: Service) {
    if (svc.isAttached) {
      await fetch(`/api/gstsantos/services/${svc.id}/attach`, { method: "DELETE" });
    } else {
      await fetch(`/api/gstsantos/services/${svc.id}/attach`, { method: "POST" });
    }
    await fetchAll();
  }

  return (
    <div className="gst-page" style={{ maxWidth: 900 }}>
      <div className="gst-head">
        <h1 className="gst-title">Serviços</h1>
        {canManageServices && (
          <button onClick={openCreate} className="gst-btn gst-btn-gold" style={{ marginLeft: "auto" }}>
            <Plus size={15} strokeWidth={2.5} />
            Novo serviço
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          <div className="gst-skel" style={{ height: 140 }} />
          <div className="gst-skel" style={{ height: 140, opacity: 0.7 }} />
          <div className="gst-skel" style={{ height: 140, opacity: 0.45 }} />
        </div>
      ) : (
        <div
          className="gst-stagger"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {services.map((svc) => (
            <div
              key={svc.id}
              className="gst-card gst-card-hover"
              style={{
                padding: "16px 18px",
                opacity: svc.isActive ? 1 : 0.55,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <p style={{ margin: 0, fontWeight: 700, color: "#F4EEDF", fontSize: 15 }}>
                  {svc.name}
                </p>
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: svc.isActive ? "#4CAF5022" : "#E5737322",
                    color: svc.isActive ? "#4CAF50" : "#E57373",
                    flexShrink: 0,
                  }}
                >
                  {svc.isActive ? "Ativo" : "Inativo"}
                </span>
              </div>

              {svc.description && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#8A847A" }}>
                  {svc.description}
                </p>
              )}

              <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                <span style={{ color: "#C9A84C", fontWeight: 600, fontSize: 14 }}>
                  {fmtR$(svc.price)}
                </span>
                <span style={{ color: "#8A847A", fontSize: 13 }}>
                  {fmtDuration(svc.durationMinutes)}
                </span>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                {me?.role === "member" && (
                  <button
                    onClick={() => void toggleAttach(svc)}
                    className={`gst-btn ${svc.isAttached ? "gst-btn-danger" : "gst-btn-ghost"}`}
                    style={{
                      fontSize: 12,
                      minHeight: 32,
                      padding: "5px 14px",
                      ...(svc.isAttached ? {} : { borderColor: "#C9A84C", color: "#C9A84C" }),
                    }}
                  >
                    {svc.isAttached ? "Remover" : "Me atrelar"}
                  </button>
                )}
                {canManageServices && (
                  <>
                    <button
                      onClick={() => openEdit(svc)}
                      className="gst-btn gst-btn-ghost"
                      style={{ fontSize: 12, minHeight: 32, padding: "5px 14px" }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => void toggleActive(svc)}
                      className="gst-btn gst-btn-ghost"
                      style={{ fontSize: 12, minHeight: 32, padding: "5px 14px", color: "#8A847A" }}
                    >
                      {svc.isActive ? "Desativar" : "Ativar"}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="gst-overlay" onClick={() => setModal(null)}>
          <div
            className="gst-modal"
            style={{ maxWidth: 420, padding: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                margin: "0 0 20px",
                color: "#F4EEDF",
                fontSize: 19,
                fontFamily: "'Playfair Display', serif",
              }}
            >
              {modal.mode === "create" ? "Novo serviço" : "Editar serviço"}
            </h2>

            <Field label="Nome">
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="gst-input" style={{ width: "100%" }}
                placeholder="Ex: Corte degradê"
              />
            </Field>
            <Field label="Descrição (opcional)">
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="gst-input" style={{ width: "100%" }}
              />
            </Field>
            <Field label="Duração (minutos)">
              <input
                type="number"
                min={5}
                value={form.durationMinutes}
                onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
                className="gst-input" style={{ width: "100%" }}
              />
            </Field>
            <Field label="Preço (R$)">
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="gst-input" style={{ width: "100%" }}
              />
            </Field>

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={() => setModal(null)} className="gst-btn gst-btn-ghost" style={{ flex: 1 }}>
                Cancelar
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving || !form.name}
                className="gst-btn gst-btn-gold"
                style={{ flex: 1 }}
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          color: "#8A847A",
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

