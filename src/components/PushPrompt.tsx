"use client";

import { useEffect, useState } from "react";

type Status = "loading" | "unsupported" | "default" | "granted" | "denied" | "subscribed";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return view;
}

export function PushPrompt() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("pushPromptDismissed");
    if (stored === "1") setDismissed(true);

    void detectStatus().then(setStatus);
  }, []);

  async function detectStatus(): Promise<Status> {
    if (typeof window === "undefined") return "unsupported";
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return "unsupported";
    }
    const perm = Notification.permission;
    if (perm === "denied") return "denied";
    if (perm === "default") return "default";
    // permission === "granted"
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      return sub ? "subscribed" : "granted";
    } catch {
      return "granted";
    }
  }

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "denied" : "default");
        return;
      }

      const keyRes = await fetch("/api/gstsantos/push/vapid-key");
      if (!keyRes.ok) {
        alert("Servidor não configurou notificações push.");
        return;
      }
      const { publicKey } = (await keyRes.json()) as { publicKey: string };

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = sub.toJSON();
      await fetch("/api/gstsantos/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      });

      setStatus("subscribed");
    } catch (err) {
      console.error("Failed to subscribe to push:", err);
      alert("Não foi possível ativar as notificações.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/gstsantos/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("granted");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    localStorage.setItem("pushPromptDismissed", "1");
    setDismissed(true);
  }

  // Auto-subscribe se permission já é granted mas não há subscription (multi-device)
  useEffect(() => {
    if (status === "granted" && !busy) {
      void enable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (status === "loading" || status === "unsupported" || status === "subscribed" || status === "granted") {
    return null;
  }
  if (dismissed) return null;
  if (status === "denied") return null;

  // status === "default" → mostra banner
  return (
    <div
      style={{
        position: "fixed",
        bottom: 90,
        left: 12,
        right: 12,
        zIndex: 50,
        background: "#131211",
        border: "1px solid #2A2620",
        borderRadius: 14,
        padding: "14px 16px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        maxWidth: 420,
        marginInline: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ fontSize: 22, lineHeight: 1 }}>🔔</div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#F4EEDF" }}>
            Receba notificações de novos agendamentos
          </p>
          <p style={{ margin: 0, fontSize: 11, color: "#8A847A" }}>
            Você é avisado no celular sempre que um cliente agendar com você.
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={dismiss}
          style={{
            flex: 1,
            padding: "8px 12px",
            background: "transparent",
            border: "1px solid #2A2620",
            borderRadius: 999,
            color: "#C8C2B4",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Agora não
        </button>
        <button
          onClick={() => void enable()}
          disabled={busy}
          style={{
            flex: 1,
            padding: "8px 12px",
            background: "linear-gradient(180deg,#E0BE5C,#C9A84C 48%,#8E6A24)",
            color: "#1A1408",
            fontWeight: 700,
            fontSize: 12,
            border: "none",
            borderRadius: 999,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Ativando..." : "Ativar"}
        </button>
      </div>
    </div>
  );
}
