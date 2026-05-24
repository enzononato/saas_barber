import { env } from "@/lib/env";

/**
 * Wrapper da Evolution API v2.
 *
 * Credenciais globais via env (EVOLUTION_API_URL + EVOLUTION_API_KEY).
 * Cada barbearia tem uma instância nomeada com seu slug.
 *
 * Todas as funções são resilientes: em caso de erro, logam e retornam um valor
 * neutro (false/null/"unknown") ao invés de lançar — o caller decide.
 */

export type ConnectionState = "open" | "close" | "connecting" | "unknown";

function isConfigured(): boolean {
  return Boolean(env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY);
}

function baseUrl(): string {
  return (env.EVOLUTION_API_URL ?? "").replace(/\/$/, "");
}

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    apikey: env.EVOLUTION_API_KEY ?? "",
  };
}

/** Converte slug numa string segura pra Evolution (alfanumérico + hífen, lowercase). */
export function instanceNameForSlug(slug: string): string {
  return (slug || "")
    .replace(/[^a-z0-9-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "default";
}

type FetchInstancesItem = {
  instance?: {
    instanceName?: string;
    state?: string;
    owner?: string;
    profileName?: string;
  };
  // Algumas versões retornam direto na raiz:
  instanceName?: string;
  state?: string;
  owner?: string;
  profileName?: string;
};

async function fetchInstance(instanceName: string): Promise<FetchInstancesItem | null> {
  if (!isConfigured()) return null;
  try {
    const url = `${baseUrl()}/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`;
    const res = await fetch(url, { headers: headers(), cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as FetchInstancesItem | FetchInstancesItem[];
    const arr = Array.isArray(data) ? data : [data];
    return arr[0] ?? null;
  } catch (err) {
    console.error("[evolution] fetchInstance error:", err);
    return null;
  }
}

/**
 * Garante que a instância existe na Evolution. Idempotente.
 * Retorna `{ created: true }` se foi criada agora, ou `{ created: false }` se já existia.
 */
export async function ensureInstance(
  instanceName: string,
): Promise<{ created: boolean; ok: boolean }> {
  if (!isConfigured()) return { created: false, ok: false };

  const existing = await fetchInstance(instanceName);
  if (existing) return { created: false, ok: true };

  try {
    const res = await fetch(`${baseUrl()}/instance/create`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });
    if (!res.ok) {
      // Em caso de "already exists" também tratamos como sucesso idempotente
      const txt = await res.text().catch(() => "");
      if (res.status === 403 || /exist/i.test(txt)) {
        return { created: false, ok: true };
      }
      console.error(`[evolution] create error: ${res.status} ${txt}`);
      return { created: false, ok: false };
    }
    return { created: true, ok: true };
  } catch (err) {
    console.error("[evolution] ensureInstance error:", err);
    return { created: false, ok: false };
  }
}

/**
 * Retorna o QR code (base64 sem prefixo) ou null se já conectado / erro.
 */
export async function getQrCode(instanceName: string): Promise<string | null> {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(
      `${baseUrl()}/instance/connect/${encodeURIComponent(instanceName)}`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      base64?: string;
      qrcode?: { base64?: string };
      code?: string;
    };
    const base64 = data.base64 ?? data.qrcode?.base64 ?? null;
    if (!base64) return null;
    return base64.replace(/^data:image\/[a-z]+;base64,/, "");
  } catch (err) {
    console.error("[evolution] getQrCode error:", err);
    return null;
  }
}

export async function getConnectionState(instanceName: string): Promise<ConnectionState> {
  if (!isConfigured()) return "unknown";
  try {
    const res = await fetch(
      `${baseUrl()}/instance/connectionState/${encodeURIComponent(instanceName)}`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) return "unknown";
    const data = (await res.json()) as {
      instance?: { state?: string };
      state?: string;
    };
    const raw = data.instance?.state ?? data.state ?? "unknown";
    if (raw === "open" || raw === "close" || raw === "connecting") return raw;
    return "unknown";
  } catch (err) {
    console.error("[evolution] getConnectionState error:", err);
    return "unknown";
  }
}

export async function getInstanceInfo(
  instanceName: string,
): Promise<{ number: string | null }> {
  const info = await fetchInstance(instanceName);
  if (!info) return { number: null };
  const owner = info.instance?.owner ?? info.owner ?? null;
  // owner geralmente vem como "5511999999999@s.whatsapp.net" — extrair só o número
  const number = owner ? owner.split("@")[0] : null;
  return { number };
}

export async function logoutInstance(instanceName: string): Promise<boolean> {
  if (!isConfigured()) return false;
  try {
    const res = await fetch(
      `${baseUrl()}/instance/logout/${encodeURIComponent(instanceName)}`,
      { method: "DELETE", headers: headers() },
    );
    return res.ok;
  } catch (err) {
    console.error("[evolution] logoutInstance error:", err);
    return false;
  }
}

export async function deleteInstance(instanceName: string): Promise<boolean> {
  if (!isConfigured()) return false;
  try {
    const res = await fetch(
      `${baseUrl()}/instance/delete/${encodeURIComponent(instanceName)}`,
      { method: "DELETE", headers: headers() },
    );
    return res.ok;
  } catch (err) {
    console.error("[evolution] deleteInstance error:", err);
    return false;
  }
}

export async function sendText(
  instanceName: string,
  number: string,
  text: string,
): Promise<boolean> {
  if (!isConfigured()) {
    console.log("[evolution] sendText skipped: not configured");
    return false;
  }
  try {
    const res = await fetch(
      `${baseUrl()}/message/sendText/${encodeURIComponent(instanceName)}`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ number, text }),
      },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(`[evolution] sendText error: ${res.status} ${txt}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[evolution] sendText error:", err);
    return false;
  }
}
