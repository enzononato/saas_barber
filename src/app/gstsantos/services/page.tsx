"use client";

import { useEffect, useState, useCallback } from "react";

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
    <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F4EEDF", margin: 0 }}>
          Serviços
        </h1>
        {canManageServices && (
          <button onClick={openCreate} style={primaryBtn}>
            + Novo serviço
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: "#8A847A" }}>Carregando...</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {services.map((svc) => (
            <div
              key={svc.id}
              style={{
                background: "#131211",
                border: `1px solid ${svc.isActive ? "#2A2620" : "#1E1C1A"}`,
                borderRadius: 12,
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
                    style={{
                      ...ghostBtn,
                      borderColor: svc.isAttached ? "#E57373" : "#C9A84C",
                      color: svc.isAttached ? "#E57373" : "#C9A84C",
                    }}
                  >
                    {svc.isAttached ? "Remover" : "Me atrelar"}
                  </button>
                )}
                {canManageServices && (
                  <>
                    <button onClick={() => openEdit(svc)} style={ghostBtn}>
                      Editar
                    </button>
                    <button
                      onClick={() => void toggleActive(svc)}
                      style={{ ...ghostBtn, color: "#8A847A", borderColor: "#3A3630" }}
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
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 100,
          }}
          onClick={() => setModal(null)}
        >
          <div
            style={{
              background: "#131211",
              border: "1px solid #2A2620",
              borderRadius: 16,
              padding: 28,
              width: "100%",
              maxWidth: 420,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 20px", color: "#F4EEDF", fontSize: 18 }}>
              {modal.mode === "create" ? "Novo serviço" : "Editar serviço"}
            </h2>

            <Field label="Nome">
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                style={inputStyle}
                placeholder="Ex: Corte degradê"
              />
            </Field>
            <Field label="Descrição (opcional)">
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                style={inputStyle}
              />
            </Field>
            <Field label="Duração (minutos)">
              <input
                type="number"
                min={5}
                value={form.durationMinutes}
                onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
                style={inputStyle}
              />
            </Field>
            <Field label="Preço (R$)">
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                style={inputStyle}
              />
            </Field>

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={() => setModal(null)} style={{ ...ghostBtn, flex: 1 }}>
                Cancelar
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving || !form.name}
                style={{ ...primaryBtn, flex: 1 }}
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  background: "#0B0B0B",
  border: "1px solid #2A2620",
  borderRadius: 8,
  color: "#F4EEDF",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
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
};

const ghostBtn: React.CSSProperties = {
  padding: "6px 14px",
  background: "transparent",
  border: "1px solid #2A2620",
  borderRadius: 999,
  color: "#C8C2B4",
  fontSize: 12,
  cursor: "pointer",
};
