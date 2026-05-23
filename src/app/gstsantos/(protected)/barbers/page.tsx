"use client";

import { useEffect, useState, useCallback } from "react";

interface Barber {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  canCreateServices: boolean;
  createdAt: string;
}

interface Me {
  id: string;
  role: "owner" | "member";
  canCreateServices: boolean;
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function BarbersPage() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", isAdmin: false });
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [bRes, mRes] = await Promise.all([
      fetch("/api/gstsantos/barbers"),
      fetch("/api/gstsantos/me"),
    ]);
    if (bRes.ok) setBarbers(await bRes.json());
    if (mRes.ok) setMe(await mRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  async function handleCreate() {
    setSaving(true);
    const res = await fetch("/api/gstsantos/barbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, email: form.email, isAdmin: form.isAdmin }),
    });
    setSaving(false);

    if (res.ok) {
      setShowModal(false);
      setForm({ name: "", email: "", isAdmin: false });
      await fetchAll();
    } else {
      const err = await res.json() as { error: string };
      alert(err.error ?? "Erro ao criar barbeiro.");
    }
  }

  async function handleDelete(memberId: string) {
    if (!confirm("Remover este barbeiro? Esta ação é irreversível.")) return;
    const res = await fetch(`/api/gstsantos/barbers/${memberId}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json() as { error: string; count?: number };
      if (err.error === "has_appointments") {
        alert(`Este barbeiro tem ${err.count ?? ""} agendamento(s) no histórico e não pode ser removido.`);
      } else {
        alert(err.error ?? "Erro ao remover.");
      }
      return;
    }
    await fetchAll();
  }

  async function toggleAdmin(b: Barber) {
    await fetch(`/api/gstsantos/barbers/${b.memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin: !b.canCreateServices }),
    });
    await fetchAll();
  }

  const canManage = me?.role === "owner" || me?.canCreateServices;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F4EEDF", margin: 0 }}>
          Barbeiros
        </h1>
        {canManage && (
          <button onClick={() => setShowModal(true)} style={primaryBtn}>
            + Adicionar
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: "#8A847A" }}>Carregando...</p>
      ) : barbers.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "#8A847A",
            border: "1px solid #2A2620",
            borderRadius: 12,
          }}
        >
          Nenhum barbeiro cadastrado.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {barbers.map((b) => {
            const isOwner = b.role === "owner";
            const isMe = b.userId === me?.id;
            const isAdminBarber = isOwner || b.canCreateServices;

            return (
              <div
                key={b.memberId}
                style={{
                  background: "#131211",
                  border: "1px solid #2A2620",
                  borderRadius: 12,
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "rgba(201,168,76,0.15)",
                    border: "1px solid rgba(201,168,76,0.3)",
                    display: "grid",
                    placeItems: "center",
                    color: "#C9A84C",
                    fontWeight: 700,
                    fontSize: 15,
                    flexShrink: 0,
                  }}
                >
                  {initials(b.name)}
                </div>

                {/* Info + badge */}
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <p style={{ margin: 0, fontWeight: 600, color: "#F4EEDF", fontSize: 14 }}>
                      {b.name}
                    </p>
                    {isOwner ? (
                      <span style={badgeStyle("#C9A84C", "rgba(201,168,76,0.15)")}>Dono</span>
                    ) : isAdminBarber ? (
                      <span style={badgeStyle("#7CB9E8", "rgba(124,185,232,0.12)")}>Admin</span>
                    ) : null}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#8A847A" }}>{b.email}</p>
                </div>

                {/* "Barbeiro Admin" toggle — owner can toggle members only */}
                {me?.role === "owner" && !isOwner && (
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      fontSize: 12,
                      color: "#C8C2B4",
                    }}
                  >
                    <ToggleSwitch
                      checked={b.canCreateServices}
                      onChange={() => void toggleAdmin(b)}
                    />
                    Barbeiro Admin
                  </label>
                )}

                {/* Delete — owner only, not on self or other owners */}
                {me?.role === "owner" && !isOwner && !isMe && (
                  <button
                    onClick={() => void handleDelete(b.memberId)}
                    style={{
                      padding: "5px 12px",
                      border: "1px solid #E5737344",
                      borderRadius: 999,
                      background: "#E5737311",
                      color: "#E57373",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Remover
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
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
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: "#131211",
              border: "1px solid #2A2620",
              borderRadius: 16,
              padding: 28,
              width: "100%",
              maxWidth: 400,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 6px", color: "#F4EEDF", fontSize: 18 }}>
              Adicionar barbeiro
            </h2>
            <p style={{ margin: "0 0 20px", color: "#8A847A", fontSize: 13 }}>
              Um link de acesso será enviado por e-mail.
            </p>

            <Field label="Nome">
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                style={inputStyle}
                placeholder="Nome completo"
              />
            </Field>
            <Field label="E-mail">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                style={inputStyle}
                placeholder="email@exemplo.com"
              />
            </Field>

            <Field label="Perfil">
              <div style={{ display: "flex", gap: 8 }}>
                <ProfileOption
                  selected={!form.isAdmin}
                  onClick={() => setForm((f) => ({ ...f, isAdmin: false }))}
                  title="Barbeiro"
                  description="Acessa apenas a própria agenda"
                />
                <ProfileOption
                  selected={form.isAdmin}
                  onClick={() => setForm((f) => ({ ...f, isAdmin: true }))}
                  title="Barbeiro Admin"
                  description="Gerencia serviços e barbeiros"
                />
              </div>
            </Field>

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowModal(false)} style={{ ...ghostBtn, flex: 1 }}>
                Cancelar
              </button>
              <button
                onClick={() => void handleCreate()}
                disabled={saving || !form.name || !form.email}
                style={{ ...primaryBtn, flex: 1, marginLeft: 0 }}
              >
                {saving ? "Criando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileOption({
  selected,
  onClick,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        padding: "10px 12px",
        border: selected ? "1.5px solid #C9A84C" : "1.5px solid #2A2620",
        borderRadius: 10,
        background: selected ? "rgba(201,168,76,0.08)" : "transparent",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: selected ? "#C9A84C" : "#C8C2B4" }}>
        {title}
      </p>
      <p style={{ margin: 0, fontSize: 11, color: "#8A847A" }}>{description}</p>
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

function badgeStyle(color: string, bg: string): React.CSSProperties {
  return {
    padding: "1px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    color,
    background: bg,
    border: `1px solid ${color}44`,
  };
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
  padding: "8px 14px",
  background: "transparent",
  border: "1px solid #2A2620",
  borderRadius: 999,
  color: "#C8C2B4",
  fontSize: 13,
  cursor: "pointer",
};
