/**
 * Backfill script — popula a tabela `customers` a partir dos appointments existentes.
 *
 * Idempotente: pode ser rodado N vezes.
 *
 * O que faz:
 *   1. Itera todos appointments
 *   2. Normaliza o customer_phone (Brasil → 5511... format)
 *   3. UPDATE appointments SET customer_phone = normalized (se mudou)
 *   4. UPSERT em customers usando ON CONFLICT (org, phone)
 *      - name: pega o último nome usado
 *      - first_seen_at: MIN(starts_at)
 *      - last_seen_at: MAX(starts_at)
 *
 * Uso: `npm run db:backfill-customers`
 */

import "dotenv/config";

import { and, eq } from "drizzle-orm";

import { db, pool } from "../index";
import { appointments } from "../schema/appointments";
import { customers } from "../schema/customers";
import { normalizePhoneBR } from "../../services/whatsapp";

async function main() {
  console.log("Backfill customers — iniciando...");

  // 1. Carregar TODOS appointments
  const all = await db
    .select({
      id: appointments.id,
      orgId: appointments.organizationId,
      phone: appointments.customerPhone,
      name: appointments.customerName,
      startsAt: appointments.startsAt,
    })
    .from(appointments);

  console.log(`Encontrados ${all.length} appointments`);

  let updatedAppointments = 0;
  let upsertedCustomers = 0;

  // 2. Normalizar telefones em appointments
  for (const a of all) {
    const normalized = normalizePhoneBR(a.phone);
    if (normalized && normalized !== a.phone) {
      await db
        .update(appointments)
        .set({ customerPhone: normalized })
        .where(eq(appointments.id, a.id));
      updatedAppointments++;
      a.phone = normalized; // pra usar na etapa seguinte
    }
  }

  console.log(`Telefones normalizados em ${updatedAppointments} appointments`);

  // 3. Agrupar por (orgId, phone) e gerar customers
  type Agg = {
    orgId: string;
    phone: string;
    name: string;
    firstSeen: Date;
    lastSeen: Date;
  };
  const map = new Map<string, Agg>();

  for (const a of all) {
    if (!a.phone) continue; // skipa registros com phone vazio
    const key = `${a.orgId}|${a.phone}`;
    const startsAt = new Date(a.startsAt);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        orgId: a.orgId,
        phone: a.phone,
        name: a.name,
        firstSeen: startsAt,
        lastSeen: startsAt,
      });
    } else {
      if (startsAt < existing.firstSeen) existing.firstSeen = startsAt;
      if (startsAt > existing.lastSeen) {
        existing.lastSeen = startsAt;
        existing.name = a.name; // último nome usado
      }
    }
  }

  console.log(`Agrupados em ${map.size} clientes únicos`);

  // 4. Upsert
  for (const c of map.values()) {
    await db
      .insert(customers)
      .values({
        organizationId: c.orgId,
        phone: c.phone,
        name: c.name,
        firstSeenAt: c.firstSeen,
        lastSeenAt: c.lastSeen,
      })
      .onConflictDoUpdate({
        target: [customers.organizationId, customers.phone],
        set: {
          name: c.name,
          firstSeenAt: c.firstSeen, // será sobrescrito por GREATEST/LEAST? não — drizzle não tem isso em set
          lastSeenAt: c.lastSeen,
        },
      });
    upsertedCustomers++;
  }

  // 5. Garantir que first_seen_at é realmente o mínimo (defensivo) - rodar UPDATE final
  // Não necessário pois o map já agrupou corretamente.

  void and; // suprime warning de import não-usado

  console.log("");
  console.log("=== Backfill concluído ===");
  console.log(JSON.stringify({ updatedAppointments, upsertedCustomers }, null, 2));
}

main()
  .catch((err) => {
    console.error("Backfill falhou:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
