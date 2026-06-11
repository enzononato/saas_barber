"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface WhatsappSettings {
  isEnabled: boolean;
  instanceName: string | null;
  connectionStatus: "disconnected" | "connecting" | "connected" | "error";
  connectedNumber: string | null;
  followUpDays: number;
  bookingTemplate: string;
  followUpTemplate: string;
  reminderEnabled: boolean;
  reminderHoursBefore: number;
  reminderTemplate: string;
}

const DEFAULT_BOOKING =
  "Olá {{nome}}! ✅ Agendamento confirmado para {{data}} às {{hora}} com {{barbeiro}} ({{servico}}). Até lá! ✂️";
const DEFAULT_FOLLOWUP =
  "Olá {{nome}}! Já faz {{dias}} dias desde o seu último corte 😄 Que tal agendar? {{link}}";
const DEFAULT_REMINDER =
  "Olá {{nome}}! Passando para lembrar do seu horário hoje às {{hora}} com {{barbeiro}}. Até já! ✂️";

function formatPhone(raw: string | null): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 13) {
    // 5571999991234
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return raw;
}

export default function WhatsappPage() {
  const [settings, setSettings] = useState<WhatsappSettings>({
    isEnabled: false,
    instanceName: null,
    connectionStatus: "disconnected",
    connectedNumber: null,
    followUpDays: 30,
    bookingTemplate: DEFAULT_BOOKING,
    followUpTemplate: DEFAULT_FOLLOWUP,
    reminderEnabled: true,
    reminderHoursBefore: 2,
    reminderTemplate: DEFAULT_REMINDER,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testNumber, setTestNumber] = useState("");
  const [triggering, setTriggering] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // QR modal
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrExpiresIn, setQrExpiresIn] = useState(60);
  const [refetchingQr, setRefetchingQr] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/gstsantos/whatsapp/settings");
    if (res.ok) {
      const data = (await res.json()) as WhatsappSettings;
      setSettings(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  function stopPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }

  function startPolling() {
    stopPolling();

    // Timer regressivo de 60s
    setQrExpiresIn(60);
    timerIntervalRef.current = setInterval(() => {
      setQrExpiresIn((t) => Math.max(0, t - 1));
    }, 1000);

    // Polling de status a cada 2.5s
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/gstsantos/whatsapp/status");
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: WhatsappSettings["connectionStatus"];
          connectedNumber: string | null;
        };

        if (data.status === "connected") {
          stopPolling();
          setQrModalOpen(false);
          setSettings((s) => ({
            ...s,
            connectionStatus: "connected",
            connectedNumber: data.connectedNumber,
          }));
          showToast("WhatsApp conectado!", true);
        } else {
          setSettings((s) => ({ ...s, connectionStatus: data.status }));
        }
      } catch {
        // silently retry
      }
    }, 2500);
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch("/api/gstsantos/whatsapp/connect", { method: "POST" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        showToast(
          err.error === "evolution_unavailable"
            ? "Servidor Evolution não está respondendo. Verifique a configuração."
            : "Erro ao iniciar conexão.",
          false,
        );
        return;
      }
      const data = (await res.json()) as { qrcode: string | null; instanceName: string };
      setQrCode(data.qrcode);
      setSettings((s) => ({ ...s, instanceName: data.instanceName, connectionStatus: "connecting" }));
      setQrModalOpen(true);
      startPolling();
    } finally {
      setConnecting(false);
    }
  }

  async function refetchQr() {
    setRefetchingQr(true);
    try {
      const res = await fetch("/api/gstsantos/whatsapp/qrcode");
      if (res.ok) {
        const data = (await res.json()) as { qrcode: string | null };
        setQrCode(data.qrcode);
        setQrExpiresIn(60);
      } else {
        showToast("Não foi possível gerar novo QR.", false);
      }
    } finally {
      setRefetchingQr(false);
    }
  }

  function cancelConnect() {
    stopPolling();
    setQrModalOpen(false);
  }

  async function handleDisconnect() {
    if (!confirm("Desconectar o WhatsApp? Mensagens automáticas pararão de ser enviadas.")) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await fetch("/api/gstsantos/whatsapp/disconnect", { method: "POST" });
      if (res.ok) {
        setSettings((s) => ({ ...s, connectionStatus: "disconnected", connectedNumber: null }));
        showToast("Desconectado.", true);
      } else {
        showToast("Erro ao desconectar.", false);
      }
    } finally {
      setDisconnecting(false);
    }
  }

  async function syncStatus() {
    const res = await fetch("/api/gstsantos/whatsapp/status");
    if (res.ok) {
      const data = (await res.json()) as {
        status: WhatsappSettings["connectionStatus"];
        connectedNumber: string | null;
      };
      setSettings((s) => ({
        ...s,
        connectionStatus: data.status,
        connectedNumber: data.connectedNumber,
      }));
      showToast(`Status: ${data.status}`, true);
    }
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/gstsantos/whatsapp/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isEnabled: settings.isEnabled,
        followUpDays: settings.followUpDays,
        bookingTemplate: settings.bookingTemplate,
        followUpTemplate: settings.followUpTemplate,
        reminderEnabled: settings.reminderEnabled,
        reminderHoursBefore: settings.reminderHoursBefore,
        reminderTemplate: settings.reminderTemplate,
      }),
    });
    setSaving(false);
    if (res.ok) showToast("Configurações salvas.", true);
    else showToast("Erro ao salvar.", false);
  }

  async function testConnection() {
    if (settings.connectionStatus !== "connected") {
      showToast("Conecte o WhatsApp antes de testar.", false);
      return;
    }
    if (!testNumber) {
      showToast("Informe um número para receber o teste.", false);
      return;
    }
    setTesting(true);
    const res = await fetch("/api/gstsantos/whatsapp/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: testNumber }),
    });
    setTesting(false);
    if (res.ok) showToast("Mensagem de teste enviada!", true);
    else showToast("Falha ao enviar — verifique o número.", false);
  }

  async function triggerFollowUp() {
    if (!confirm("Disparar mensagens de follow-up agora?")) return;
    setTriggering(true);
    const res = await fetch("/api/gstsantos/whatsapp/trigger-followup", { method: "POST" });
    setTriggering(false);
    if (res.ok) {
      const data = (await res.json()) as { sent: number; skipped: number };
      showToast(`Enviadas: ${data.sent} · Ignoradas: ${data.skipped}`, true);
    } else {
      showToast("Erro ao disparar follow-up.", false);
    }
  }

  if (loading) {
    return <p style={{ color: "#8A847A", padding: 24 }}>Carregando...</p>;
  }

  const isConnected = settings.connectionStatus === "connected";

  return (
    <div style={{ padding: "24px 20px", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F4EEDF", margin: "0 0 24px" }}>
        WhatsApp
      </h1>

      <Section title="Status">
        {isConnected ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#7CB9E8" }} />
              <strong style={{ color: "#F4EEDF", fontSize: 15 }}>Conectado</strong>
            </div>
            <p style={{ margin: "0 0 14px", color: "#8A847A", fontSize: 13 }}>
              {formatPhone(settings.connectedNumber) || "número não disponível"}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => void handleDisconnect()} disabled={disconnecting} style={ghostBtn}>
                {disconnecting ? "Desconectando..." : "Desconectar"}
              </button>
              <button onClick={() => void syncStatus()} style={ghostBtn}>
                Verificar status
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#8A847A" }} />
              <strong style={{ color: "#F4EEDF", fontSize: 15 }}>
                {settings.connectionStatus === "connecting"
                  ? "Aguardando QR"
                  : settings.connectionStatus === "error"
                    ? "Erro de conexão"
                    : "Desconectado"}
              </strong>
            </div>
            <p style={{ margin: "0 0 14px", color: "#8A847A", fontSize: 13 }}>
              Conecte seu WhatsApp para enviar mensagens automáticas aos clientes.
            </p>
            <button onClick={() => void handleConnect()} disabled={connecting} style={primaryBtn}>
              {connecting ? "Iniciando..." : "Conectar WhatsApp"}
            </button>
          </div>
        )}
      </Section>

      <Section title="Automações">
        <div style={rowBetween}>
          <span style={{ color: "#C8C2B4", fontSize: 14 }}>Mensagens habilitadas</span>
          <ToggleSwitch
            checked={settings.isEnabled}
            onChange={() => setSettings((s) => ({ ...s, isEnabled: !s.isEnabled }))}
          />
        </div>
        <div style={{ ...rowBetween, marginTop: 14 }}>
          <span style={{ color: "#C8C2B4", fontSize: 14 }}>Follow-up após (dias)</span>
          <input
            type="number"
            min={1}
            max={365}
            value={settings.followUpDays}
            onChange={(e) =>
              setSettings((s) => ({ ...s, followUpDays: parseInt(e.target.value, 10) || 30 }))
            }
            style={{ ...inputStyle, width: 80, textAlign: "center" }}
          />
        </div>
        <div style={{ ...rowBetween, marginTop: 14 }}>
          <span style={{ color: "#C8C2B4", fontSize: 14 }}>Lembrete antes do horário</span>
          <ToggleSwitch
            checked={settings.reminderEnabled}
            onChange={() => setSettings((s) => ({ ...s, reminderEnabled: !s.reminderEnabled }))}
          />
        </div>
        {settings.reminderEnabled && (
          <div style={{ ...rowBetween, marginTop: 14 }}>
            <span style={{ color: "#C8C2B4", fontSize: 14 }}>Enviar (horas antes)</span>
            <input
              type="number"
              min={1}
              max={48}
              value={settings.reminderHoursBefore}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  reminderHoursBefore: parseInt(e.target.value, 10) || 2,
                }))
              }
              style={{ ...inputStyle, width: 80, textAlign: "center" }}
            />
          </div>
        )}
      </Section>

      <Section title="Templates de mensagem">
        <Field label="Confirmação de agendamento">
          <textarea
            value={settings.bookingTemplate}
            onChange={(e) => setSettings((s) => ({ ...s, bookingTemplate: e.target.value }))}
            rows={4}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
          <Hint>Variáveis: {`{{nome}} {{data}} {{hora}} {{barbeiro}} {{servico}}`}</Hint>
        </Field>
        <Field label="Follow-up de reativação">
          <textarea
            value={settings.followUpTemplate}
            onChange={(e) => setSettings((s) => ({ ...s, followUpTemplate: e.target.value }))}
            rows={4}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
          <Hint>Variáveis: {`{{nome}} {{dias}} {{link}}`}</Hint>
        </Field>
        <Field label="Lembrete pré-agendamento">
          <textarea
            value={settings.reminderTemplate}
            onChange={(e) => setSettings((s) => ({ ...s, reminderTemplate: e.target.value }))}
            rows={3}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
          <Hint>Variáveis: {`{{nome}} {{hora}} {{barbeiro}} {{servico}}`}</Hint>
        </Field>
      </Section>

      {isConnected && (
        <Section title="Testar envio">
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              placeholder="Seu número (com DDD)"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={() => void testConnection()} disabled={testing} style={ghostBtn}>
              {testing ? "Enviando..." : "Enviar teste"}
            </button>
          </div>
        </Section>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
        <button onClick={() => void save()} disabled={saving} style={primaryBtn}>
          {saving ? "Salvando..." : "Salvar configurações"}
        </button>
        {isConnected && (
          <button onClick={() => void triggerFollowUp()} disabled={triggering} style={ghostBtn}>
            {triggering ? "Disparando..." : "Disparar follow-up agora"}
          </button>
        )}
      </div>

      {/* QR Modal */}
      {qrModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 100,
          }}
          onClick={cancelConnect}
        >
          <div
            style={{
              background: "#131211",
              border: "1px solid #2A2620",
              borderRadius: 16,
              padding: 28,
              maxWidth: 380,
              width: "100%",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 6px", color: "#F4EEDF", fontSize: 18 }}>
              Escaneie o QR Code
            </h2>
            <p style={{ margin: "0 0 16px", color: "#8A847A", fontSize: 12 }}>
              No celular: abra WhatsApp → ⋮ → Aparelhos conectados → Conectar um aparelho
            </p>

            {qrCode ? (
              <div
                style={{
                  background: "#fff",
                  padding: 14,
                  borderRadius: 12,
                  display: "inline-block",
                  marginBottom: 14,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${qrCode}`}
                  alt="QR Code"
                  style={{ width: 220, height: 220, display: "block" }}
                />
              </div>
            ) : (
              <div
                style={{
                  width: 220,
                  height: 220,
                  background: "#0B0B0B",
                  border: "1px dashed #2A2620",
                  borderRadius: 12,
                  display: "grid",
                  placeItems: "center",
                  color: "#8A847A",
                  fontSize: 12,
                  margin: "0 auto 14px",
                }}
              >
                Gerando QR...
              </div>
            )}

            <p style={{ margin: "0 0 4px", color: "#C8C2B4", fontSize: 12 }}>
              {qrExpiresIn > 0 ? (
                <>⏱ Expira em {qrExpiresIn}s</>
              ) : (
                <span style={{ color: "#E57373" }}>QR expirado</span>
              )}
            </p>
            <p style={{ margin: "0 0 16px", color: "#8A847A", fontSize: 11 }}>
              Status: {settings.connectionStatus === "connecting" ? "aguardando..." : settings.connectionStatus}
            </p>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={cancelConnect} style={{ ...ghostBtn, flex: 1 }}>
                Cancelar
              </button>
              <button
                onClick={() => void refetchQr()}
                disabled={refetchingQr}
                style={{ ...primaryBtn, flex: 1, marginLeft: 0 }}
              >
                {refetchingQr ? "Gerando..." : "Gerar novo QR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 100,
            left: "50%",
            transform: "translateX(-50%)",
            background: toast.ok ? "rgba(124,185,232,0.15)" : "rgba(229,115,115,0.15)",
            border: `1px solid ${toast.ok ? "#7CB9E8" : "#E57373"}`,
            color: toast.ok ? "#7CB9E8" : "#E57373",
            padding: "10px 18px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            zIndex: 200,
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "#131211",
        border: "1px solid #2A2620",
        borderRadius: 14,
        padding: 18,
        marginBottom: 16,
      }}
    >
      <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 600, color: "#C9A84C" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
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

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "6px 0 0", fontSize: 11, color: "#8A847A", fontFamily: "monospace" }}>
      {children}
    </p>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: 40,
        height: 22,
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
          left: checked ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#F4EEDF",
          transition: "left 0.2s",
        }}
      />
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

const rowBetween: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 22px",
  background: "linear-gradient(180deg,#E0BE5C,#C9A84C 48%,#8E6A24)",
  color: "#1A1408",
  fontWeight: 700,
  fontSize: 13,
  border: "none",
  borderRadius: 999,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  padding: "10px 18px",
  background: "transparent",
  border: "1px solid #2A2620",
  borderRadius: 999,
  color: "#C8C2B4",
  fontSize: 13,
  cursor: "pointer",
};
