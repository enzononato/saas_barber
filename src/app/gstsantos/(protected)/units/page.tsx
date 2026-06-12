"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, MapPin, Phone, Plus, Search, Trash2 } from "lucide-react";

interface Unit {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  googleMapsUrl: string | null;
  phone: string | null;
  isActive: boolean;
  position: number;
}

interface FormState {
  name: string;
  googleMapsUrl: string;
  address: string;
  phone: string;
  lat: number | null;
  lng: number | null;
}

const EMPTY_FORM: FormState = {
  name: "",
  googleMapsUrl: "",
  address: "",
  phone: "",
  lat: null,
  lng: null,
};

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(true);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; unit?: Unit } | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [resolving, setResolving] = useState(false);
  const [resolveMsg, setResolveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/gstsantos/units");
    if (res.ok) setUnits(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchUnits();
    void (async () => {
      const res = await fetch("/api/gstsantos/me");
      if (res.ok) {
        const me = await res.json();
        setIsOwner(me.role === "owner");
      }
    })();
  }, [fetchUnits]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setResolveMsg(null);
    setModal({ mode: "create" });
  }

  function openEdit(u: Unit) {
    setForm({
      name: u.name,
      googleMapsUrl: u.googleMapsUrl ?? "",
      address: u.address ?? "",
      phone: u.phone ?? "",
      lat: u.lat,
      lng: u.lng,
    });
    setResolveMsg(
      u.lat != null && u.lng != null
        ? { ok: true, text: `${u.lat.toFixed(5)}, ${u.lng.toFixed(5)}` }
        : null,
    );
    setModal({ mode: "edit", unit: u });
  }

  async function resolveMaps() {
    if (!form.googleMapsUrl.trim()) return;
    setResolving(true);
    setResolveMsg(null);
    const res = await fetch("/api/gstsantos/units/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: form.googleMapsUrl.trim() }),
    });
    setResolving(false);
    if (res.ok) {
      const data = (await res.json()) as { lat: number; lng: number; name: string | null };
      setForm((f) => ({
        ...f,
        lat: data.lat,
        lng: data.lng,
        name: f.name.trim() || data.name || f.name,
      }));
      setResolveMsg({ ok: true, text: `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}` });
    } else {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      setResolveMsg({ ok: false, text: err.message ?? "Não consegui ler esse link." });
    }
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      googleMapsUrl: form.googleMapsUrl.trim() || null,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      lat: form.lat,
      lng: form.lng,
    };
    const res =
      modal?.mode === "create"
        ? await fetch("/api/gstsantos/units", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/gstsantos/units/${modal!.unit!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
    setSaving(false);
    if (res.ok) {
      setModal(null);
      void fetchUnits();
    } else {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      setResolveMsg({ ok: false, text: err.message ?? "Erro ao salvar. Tente novamente." });
    }
  }

  async function toggleActive(u: Unit) {
    await fetch(`/api/gstsantos/units/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    void fetchUnits();
  }

  async function handleDelete(u: Unit) {
    if (!confirm(`Excluir a unidade "${u.name}"?`)) return;
    const res = await fetch(`/api/gstsantos/units/${u.id}`, { method: "DELETE" });
    if (res.status === 409) {
      alert(
        "Essa unidade tem agendamentos no histórico e não pode ser excluída. Desative-a em vez de excluir.",
      );
      return;
    }
    void fetchUnits();
  }

  if (!isOwner) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: "#8A847A" }}>
        Acesso restrito ao dono da barbearia.
      </div>
    );
  }

  return (
    <div className="gst-page" style={{ maxWidth: 820 }}>
      <div className="gst-head">
        <h1 className="gst-title">Unidades</h1>
        <button onClick={openCreate} className="gst-btn gst-btn-gold" style={{ marginLeft: "auto" }}>
          <Plus size={15} strokeWidth={2.5} />
          Nova unidade
        </button>
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="gst-skel" style={{ height: 92 }} />
          <div className="gst-skel" style={{ height: 92, opacity: 0.6 }} />
        </div>
      ) : units.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "#8A847A",
            border: "1px dashed #2A2620",
            borderRadius: 12,
          }}
        >
          <MapPin size={36} strokeWidth={1.2} style={{ opacity: 0.5, marginBottom: 12 }} />
          <p style={{ margin: 0 }}>Nenhuma unidade cadastrada.</p>
          <p style={{ margin: "6px 0 0", fontSize: 12 }}>
            Cadastre suas filiais colando o link do Google Maps de cada uma.
          </p>
        </div>
      ) : (
        <div className="gst-stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {units.map((u) => (
            <div
              key={u.id}
              className="gst-card gst-card-hover"
              style={{
                padding: "16px 20px",
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "center",
                opacity: u.isActive ? 1 : 0.55,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(201,168,76,0.1)",
                  border: "1px solid rgba(201,168,76,0.25)",
                  color: "#C9A84C",
                  flexShrink: 0,
                }}
              >
                <MapPin size={18} strokeWidth={1.8} />
              </div>

              <div style={{ flex: 1, minWidth: 180 }}>
                <p style={{ margin: "0 0 2px", fontWeight: 700, color: "#F4EEDF", fontSize: 15 }}>
                  {u.name}
                </p>
                <p style={{ margin: 0, color: "#8A847A", fontSize: 12 }}>
                  {u.address || "Sem endereço"}
                  {u.lat != null && u.lng != null ? (
                    <span style={{ color: "#C9A84C" }}> · localização ✓</span>
                  ) : (
                    <span style={{ color: "#E57373" }}> · sem localização</span>
                  )}
                </p>
                {u.phone && (
                  <p
                    style={{
                      margin: "4px 0 0",
                      color: "#8A847A",
                      fontSize: 12,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Phone size={11} /> {u.phone}
                  </p>
                )}
              </div>

              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  background: u.isActive ? "rgba(76,175,80,0.12)" : "rgba(229,115,115,0.12)",
                  color: u.isActive ? "#4CAF50" : "#E57373",
                }}
              >
                {u.isActive ? "Ativa" : "Inativa"}
              </span>

              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => openEdit(u)}
                  className="gst-btn gst-btn-ghost"
                  style={{ fontSize: 12, minHeight: 32, padding: "5px 14px" }}
                >
                  Editar
                </button>
                <button
                  onClick={() => void toggleActive(u)}
                  className="gst-btn gst-btn-ghost"
                  style={{ fontSize: 12, minHeight: 32, padding: "5px 14px", color: "#8A847A" }}
                >
                  {u.isActive ? "Desativar" : "Ativar"}
                </button>
                <button
                  onClick={() => void handleDelete(u)}
                  className="gst-btn gst-btn-ghost"
                  style={{ minHeight: 32, padding: "5px 10px", color: "#E57373" }}
                  aria-label="Excluir unidade"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="gst-overlay" onClick={() => setModal(null)}>
          <div
            className="gst-modal"
            style={{ maxWidth: 460, padding: 28 }}
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
              {modal.mode === "create" ? "Nova unidade" : "Editar unidade"}
            </h2>

            <Field label="Link do Google Maps">
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={form.googleMapsUrl}
                  onChange={(e) => setForm((f) => ({ ...f, googleMapsUrl: e.target.value }))}
                  className="gst-input"
                  style={{ flex: 1 }}
                  placeholder="https://maps.app.goo.gl/..."
                />
                <button
                  onClick={() => void resolveMaps()}
                  disabled={resolving || !form.googleMapsUrl.trim()}
                  className="gst-btn gst-btn-ghost"
                  style={{ minHeight: 0, padding: "0 14px", flexShrink: 0 }}
                >
                  {resolving ? "..." : <Search size={15} />}
                </button>
              </div>
              {resolveMsg && (
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    color: resolveMsg.ok ? "#4CAF50" : "#E57373",
                  }}
                >
                  {resolveMsg.ok && <Check size={13} />}
                  {resolveMsg.text}
                </p>
              )}
            </Field>

            <Field label="Nome da unidade">
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="gst-input"
                style={{ width: "100%" }}
                placeholder="Ex: Unidade Centro"
              />
            </Field>
            <Field label="Endereço (opcional)">
              <input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="gst-input"
                style={{ width: "100%" }}
                placeholder="Rua, número — cidade/UF"
              />
            </Field>
            <Field label="Telefone (opcional)">
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="gst-input"
                style={{ width: "100%" }}
                placeholder="(74) 3500-0000"
              />
            </Field>

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={() => setModal(null)} className="gst-btn gst-btn-ghost" style={{ flex: 1 }}>
                Cancelar
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving || !form.name.trim()}
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
