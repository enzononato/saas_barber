"use client";

import { useEffect, useState, useCallback } from "react";

interface Barber {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  role: "owner" | "member" | "receptionist";
  isBarber: boolean;
  hasWorkingHours: boolean;
  createdAt: string;
}

interface Me {
  id: string;
  role: "owner" | "member" | "receptionist";
  isBarber: boolean;
}

interface CreatedInvite {
  name: string;
  email: string;
}

interface CommissionRow {
  serviceId: string;
  serviceName: string;
  servicePrice: string;
  attached: boolean;
  commissionPct: string;
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
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "member" as "owner" | "member" | "receptionist",
  });
  const [saving, setSaving] = useState(false);
  const [invited, setInvited] = useState<CreatedInvite | null>(null);
  const [commissionsBarber, setCommissionsBarber] = useState<Barber | null>(null);
  const [commissionRows, setCommissionRows] = useState<CommissionRow[]>([]);
  const [commissionsLoading, setCommissionsLoading] = useState(false);
  const [commissionsSaving, setCommissionsSaving] = useState(false);

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
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        role: form.role,
        isBarber: form.role !== "receptionist",
      }),
    });
    setSaving(false);

    if (res.ok) {
      const data = await res.json() as { name: string; email: string };
      setShowModal(false);
      setForm({ name: "", email: "", role: "member" });
      setInvited({ name: data.name, email: data.email });
      await fetchAll();
    } else {
      const err = await res.json() as { error: string };
      alert(err.error === "email_already_exists" ? "Este e-mail já está cadastrado." : (err.error ?? "Erro ao criar membro."));
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

  async function toggleIsBarber(b: Barber) {
    await fetch(`/api/gstsantos/barbers/${b.memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBarber: !b.isBarber }),
    });
    await fetchAll();
  }

  async function toggleRole(b: Barber) {
    const newRole = b.role === "owner" ? "member" : "owner";
    await fetch(`/api/gstsantos/barbers/${b.memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    await fetchAll();
  }

  async function openCommissions(b: Barber) {
    setCommissionsBarber(b);
    setCommissionsLoading(true);
    setCommissionRows([]);
    const res = await fetch(`/api/gstsantos/barbers/${b.memberId}/commissions`);
    if (res.ok) setCommissionRows(await res.json());
    setCommissionsLoading(false);
  }

  async function saveCommissions() {
    if (!commissionsBarber) return;
    setCommissionsSaving(true);
    const payload = {
      commissions: commissionRows.map((r) => ({
        serviceId: r.serviceId,
        commissionPct: parseFloat(r.commissionPct) || 0,
      })),
    };
    const res = await fetch(
      `/api/gstsantos/barbers/${commissionsBarber.memberId}/commissions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setCommissionsSaving(false);
    if (res.ok) {
      setCommissionsBarber(null);
      setCommissionRows([]);
    } else {
      alert("Erro ao salvar comissões.");
    }
  }

  function updateCommissionRow(serviceId: string, pct: string) {
    setCommissionRows((rows) =>
      rows.map((r) => (r.serviceId === serviceId ? { ...r, commissionPct: pct } : r)),
    );
  }

  const canManage = me?.role === "owner";

  return (
    <div style={{ padding: "24px 20px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F4EEDF", margin: 0, flex: 1 }}>
          Equipe
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
          Nenhum membro cadastrado.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {barbers.map((b) => {
            const isMe = b.userId === me?.id;
            const isOwnerBarber = b.role === "owner" && b.isBarber;
            const isAdminOnly = b.role === "owner" && !b.isBarber;

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

                {/* Info + badges */}
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <p style={{ margin: 0, fontWeight: 600, color: "#F4EEDF", fontSize: 14 }}>
                      {b.name}
                      {isMe && (
                        <span style={{ marginLeft: 4, fontWeight: 400, color: "#8A847A", fontSize: 12 }}>
                          (você)
                        </span>
                      )}
                    </p>
                    {isAdminOnly && (
                      <span style={badgeStyle("#A78BFA", "rgba(167,139,250,0.12)")}>Admin</span>
                    )}
                    {isOwnerBarber && (
                      <span style={badgeStyle("#C9A84C", "rgba(201,168,76,0.15)")}>Dono</span>
                    )}
                    {b.role === "member" && (
                      <span style={badgeStyle("#C8C2B4", "rgba(200,194,180,0.1)")}>Barbeiro</span>
                    )}
                    {b.role === "receptionist" && (
                      <span style={badgeStyle("#7DD3FC", "rgba(125,211,252,0.1)")}>Recepcionista</span>
                    )}
                    {b.isBarber && !b.hasWorkingHours && (
                      <span
                        title="Configure os horários em Minha Agenda para este barbeiro aparecer no booking"
                        style={badgeStyle("#F59E0B", "rgba(245,158,11,0.1)")}
                      >
                        Sem horários
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#8A847A" }}>{b.email}</p>
                </div>

                {/* Controls — owner only, not on self */}
                {me?.role === "owner" && !isMe && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {/* Recepcionista não tem toggles de barbeiro/acesso */}
                    {b.role !== "receptionist" && (
                      <>
                        {/* Toggle role */}
                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "#C8C2B4" }}>
                          <ToggleSwitch checked={b.role === "owner"} onChange={() => void toggleRole(b)} />
                          Acesso total
                        </label>

                        {/* Toggle isBarber */}
                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "#C8C2B4" }}>
                          <ToggleSwitch checked={b.isBarber} onChange={() => void toggleIsBarber(b)} />
                          É barbeiro
                        </label>
                      </>
                    )}

                    {b.isBarber && (
                      <button
                        onClick={() => void openCommissions(b)}
                        style={{
                          padding: "5px 12px",
                          border: "1px solid #C9A84C44",
                          borderRadius: 999,
                          background: "rgba(201,168,76,0.08)",
                          color: "#C9A84C",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Comissões
                      </button>
                    )}

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
                  </div>
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
              Adicionar membro da equipe
            </h2>
            <p style={{ margin: "0 0 20px", color: "#8A847A", fontSize: 13 }}>
              A pessoa recebe um e-mail de boas-vindas com link para criar a própria senha.
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
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <ProfileOption
                  selected={form.role === "member"}
                  onClick={() => setForm((f) => ({ ...f, role: "member" }))}
                  title="Barbeiro"
                  description="Acessa apenas a própria agenda e clientes"
                />
                <ProfileOption
                  selected={form.role === "receptionist"}
                  onClick={() => setForm((f) => ({ ...f, role: "receptionist" }))}
                  title="Recepcionista"
                  description="Gerencia agenda de todos, clientes e caixa — sem métricas avançadas"
                />
                <ProfileOption
                  selected={form.role === "owner"}
                  onClick={() => setForm((f) => ({ ...f, role: "owner" }))}
                  title="Barbeiro Dono"
                  description="Acesso total ao sistema"
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
                style={{ ...primaryBtn, flex: 1, marginLeft: 0, opacity: saving || !form.name || !form.email ? 0.5 : 1 }}
              >
                {saving ? "Criando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Commissions modal */}
      {commissionsBarber && (
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
          onClick={() => setCommissionsBarber(null)}
        >
          <div
            style={{
              background: "#131211",
              border: "1px solid #2A2620",
              borderRadius: 16,
              padding: 24,
              width: "100%",
              maxWidth: 520,
              maxHeight: "85vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 4px", color: "#F4EEDF", fontSize: 18 }}>
              Comissões de {commissionsBarber.name}
            </h2>
            <p style={{ margin: "0 0 18px", color: "#8A847A", fontSize: 12 }}>
              Defina a comissão (% sobre o preço) para cada serviço. O barbeiro fica atrelado
              automaticamente aos serviços com comissão configurada.
            </p>

            {commissionsLoading ? (
              <p style={{ color: "#8A847A" }}>Carregando...</p>
            ) : commissionRows.length === 0 ? (
              <p style={{ color: "#8A847A", textAlign: "center", padding: "20px 0" }}>
                Nenhum serviço cadastrado.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {commissionRows.map((r) => (
                  <div
                    key={r.serviceId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      background: "#0B0B0B",
                      border: "1px solid #2A2620",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, color: "#F4EEDF", fontSize: 13, fontWeight: 600 }}>
                        {r.serviceName}
                      </p>
                      <p style={{ margin: 0, color: "#8A847A", fontSize: 11 }}>
                        R$ {parseFloat(r.servicePrice).toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={r.commissionPct}
                        onChange={(e) => updateCommissionRow(r.serviceId, e.target.value)}
                        style={{
                          width: 70,
                          padding: "6px 10px",
                          background: "#131211",
                          border: "1px solid #2A2620",
                          borderRadius: 6,
                          color: "#F4EEDF",
                          fontSize: 13,
                          textAlign: "right",
                          outline: "none",
                        }}
                      />
                      <span style={{ color: "#8A847A", fontSize: 13 }}>%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setCommissionsBarber(null)}
                style={{ ...ghostBtn, flex: 1 }}
              >
                Cancelar
              </button>
              <button
                onClick={() => void saveCommissions()}
                disabled={commissionsSaving || commissionsLoading}
                style={{
                  ...primaryBtn,
                  flex: 1,
                  marginLeft: 0,
                  opacity: commissionsSaving || commissionsLoading ? 0.5 : 1,
                }}
              >
                {commissionsSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite sent modal */}
      {invited && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 100,
          }}
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
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "rgba(74,222,128,0.15)",
                  display: "grid",
                  placeItems: "center",
                  color: "#4ADE80",
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                ✓
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: "#F4EEDF", fontSize: 16 }}>
                  Convite enviado!
                </p>
                <p style={{ margin: 0, color: "#8A847A", fontSize: 12 }}>
                  {invited.name} foi adicionado à equipe
                </p>
              </div>
            </div>

            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#C8C2B4", lineHeight: 1.5 }}>
              Enviamos um e-mail de boas-vindas para{" "}
              <span style={{ color: "#C9A84C" }}>{invited.email}</span> com um link
              para criar a senha de acesso ao painel. O link expira em 1 hora.
            </p>

            <button
              onClick={() => setInvited(null)}
              style={{ ...primaryBtn, width: "100%", marginLeft: 0 }}
            >
              Entendi
            </button>
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
