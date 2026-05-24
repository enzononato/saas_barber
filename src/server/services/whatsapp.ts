import { and, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { whatsappSettings, followUpLog } from "@/server/db/schema/whatsapp";
import { appointments } from "@/server/db/schema/appointments";
import { organization } from "@/server/db/schema/auth";
import { env } from "@/lib/env";
import { sendText, instanceNameForSlug } from "./evolution";

/**
 * Normaliza telefone brasileiro para formato internacional sem +.
 * Ex: "(11) 99999-9999" → "5511999999999"
 */
export function normalizePhoneBR(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  // Já tem código de país BR (começa com 55 e tem 12-13 dígitos)
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  // 10-11 dígitos = sem código de país → prefixar 55
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function getWhatsappSettings(orgId: string) {
  const [row] = await db
    .select()
    .from(whatsappSettings)
    .where(eq(whatsappSettings.organizationId, orgId))
    .limit(1);
  return row ?? null;
}

/** Resolve o nome da instância Evolution dada uma org. */
export async function getInstanceNameForOrg(orgId: string): Promise<string | null> {
  // Primeiro: já tem settings com instance_name?
  const settings = await getWhatsappSettings(orgId);
  if (settings?.instanceName) return settings.instanceName;

  // Caso contrário: deriva do slug da org
  const [org] = await db
    .select({ slug: organization.slug })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);
  if (!org?.slug) return null;
  return instanceNameForSlug(org.slug);
}

export function isInstanceConnected(
  settings: NonNullable<Awaited<ReturnType<typeof getWhatsappSettings>>>,
): boolean {
  return Boolean(settings.isEnabled && settings.connectionStatus === "connected" && settings.instanceName);
}

export type BookingNotificationParams = {
  orgId: string;
  customerPhone: string;
  customerName: string;
  startsAt: Date;
  timezone: string;
  serviceNameAtBooking: string;
  professionalName: string;
};

export async function sendBookingConfirmationIfEnabled(
  params: BookingNotificationParams,
): Promise<boolean> {
  const settings = await getWhatsappSettings(params.orgId);
  if (!settings || !isInstanceConnected(settings)) return false;

  const dateStr = new Intl.DateTimeFormat("pt-BR", {
    timeZone: params.timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(params.startsAt);

  const timeStr = new Intl.DateTimeFormat("pt-BR", {
    timeZone: params.timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(params.startsAt);

  const text = applyTemplate(settings.bookingTemplate, {
    nome: params.customerName,
    data: dateStr,
    hora: timeStr,
    barbeiro: params.professionalName,
    servico: params.serviceNameAtBooking,
  });

  return sendText(settings.instanceName!, params.customerPhone, text, randomDelay(3000, 12000));
}

/**
 * Envia mensagem direta via Evolution (usado por endpoint de teste).
 */
export async function sendTestMessage(params: {
  instanceName: string;
  number: string;
  text?: string;
}): Promise<boolean> {
  return sendText(
    params.instanceName,
    normalizePhoneBR(params.number),
    params.text ?? "Mensagem de teste — Santos Studios ✂️",
    5000,
  );
}

/**
 * Executa follow-up para uma org: encontra clientes com último agendamento > followUpDays
 * que não foram contatados nos últimos `followUpDays` dias.
 */
export async function triggerFollowUpForOrg(
  orgId: string,
): Promise<{ sent: number; skipped: number }> {
  const settings = await getWhatsappSettings(orgId);
  if (!settings || !isInstanceConnected(settings)) return { sent: 0, skipped: 0 };

  const days = settings.followUpDays;

  const lastByPhone = await db
    .select({
      phone: appointments.customerPhone,
      name: appointments.customerName,
      lastAt: sql<Date>`MAX(${appointments.startsAt})`.as("last_at"),
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.organizationId, orgId),
        sql`${appointments.status} IN ('SCHEDULED','COMPLETED')`,
      ),
    )
    .groupBy(appointments.customerPhone, appointments.customerName)
    .having(sql`MAX(${appointments.startsAt}) < NOW() - (${days} || ' days')::interval`);

  const recentLogs = await db
    .select({ phone: followUpLog.customerPhone })
    .from(followUpLog)
    .where(
      and(
        eq(followUpLog.organizationId, orgId),
        sql`${followUpLog.sentAt} > NOW() - (${days} || ' days')::interval`,
      ),
    );

  const recentSet = new Set(recentLogs.map((r) => r.phone));

  let sent = 0;
  let skipped = 0;

  const link = (env.BETTER_AUTH_URL ?? "").replace(/\/$/, "");

  for (const row of lastByPhone) {
    if (recentSet.has(row.phone)) {
      skipped++;
      continue;
    }

    const daysSince = Math.floor(
      (Date.now() - new Date(row.lastAt).getTime()) / (1000 * 60 * 60 * 24),
    );

    const text = applyTemplate(settings.followUpTemplate, {
      nome: row.name,
      dias: String(daysSince),
      link,
    });

    const ok = await sendText(settings.instanceName!, row.phone, text, randomDelay(3000, 6000));

    if (ok) {
      await db.insert(followUpLog).values({
        organizationId: orgId,
        customerPhone: row.phone,
      });
      sent++;
    } else {
      skipped++;
    }

    // Pausa entre clientes para evitar envio em rajada (comportamento não-humano)
    await sleep(randomDelay(8000, 20000));
  }

  return { sent, skipped };
}
