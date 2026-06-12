/**
 * Backfill script — introduz o conceito de UNIDADE (filial) nos dados existentes.
 *
 * Idempotente: pode ser rodado N vezes com segurança.
 *
 * Para cada organização:
 *   1. Garante uma unidade "destino" — se a org não tem nenhuma unidade, cria a
 *      "Matriz" (com o endereço/coordenadas que estavam fixos na página pública).
 *   2. Popula unit_id = Matriz em todos os registros operacionais ainda sem unidade
 *      (appointments, working_hours, time_exceptions, expenses, products).
 *   3. Cria os vínculos member_units (todo membro passa a atuar na Matriz).
 *   4. Cria os service_units (todo serviço ganha preço por unidade = preço atual).
 *
 * Uso: `npm run db:backfill-units`
 */

import "dotenv/config";

import { and, eq, sql } from "drizzle-orm";

import { db, pool } from "../index";
import { member, organization } from "../schema/auth";
import { services } from "../schema/services";
import { memberUnits, serviceUnits, units } from "../schema/units";

// Dados da Matriz — espelham o que estava fixo na página pública (Santos Studios).
const MATRIZ_DEFAULTS = {
  name: "Matriz",
  slug: "matriz",
  address: "Travessa Dr. Édson Ribeiro, 10 A — Juazeiro, BA · 48903-560",
  lat: -9.4111,
  lng: -40.5003,
};

const OPERATIONAL_TABLES = [
  "appointments",
  "working_hours",
  "time_exceptions",
  "expenses",
  "products",
] as const;

async function main() {
  console.log("Backfill units — iniciando...");

  const orgs = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization);

  console.log(`Encontradas ${orgs.length} organização(ões)`);

  for (const org of orgs) {
    console.log(`\n── Org ${org.name} (${org.id}) ──`);

    // 1. Determinar a unidade destino do backfill.
    const existing = await db
      .select({ id: units.id, name: units.name })
      .from(units)
      .where(eq(units.organizationId, org.id))
      .orderBy(units.position, units.createdAt);

    let targetUnitId: string;
    if (existing.length === 0) {
      const inserted = await db
        .insert(units)
        .values({
          organizationId: org.id,
          name: MATRIZ_DEFAULTS.name,
          slug: MATRIZ_DEFAULTS.slug,
          address: MATRIZ_DEFAULTS.address,
          lat: MATRIZ_DEFAULTS.lat,
          lng: MATRIZ_DEFAULTS.lng,
          position: 0,
        })
        .returning({ id: units.id });
      targetUnitId = inserted[0].id;
      console.log(`  + Unidade "Matriz" criada (${targetUnitId})`);
    } else {
      targetUnitId = existing[0].id;
      console.log(
        `  = Já existe(m) ${existing.length} unidade(s); usando "${existing[0].name}" como destino`,
      );
    }

    // 2. Popular unit_id nos registros operacionais ainda sem unidade.
    for (const tbl of OPERATIONAL_TABLES) {
      const res = await db.execute(
        sql`UPDATE ${sql.identifier(tbl)}
            SET unit_id = ${targetUnitId}
            WHERE organization_id = ${org.id} AND unit_id IS NULL`,
      );
      const count = res.rowCount ?? 0;
      if (count > 0) console.log(`  · ${tbl}: ${count} registro(s) vinculados`);
    }

    // 3. member_units — todo membro da org passa a atuar na unidade destino.
    const orgMembers = await db
      .select({ id: member.id })
      .from(member)
      .where(eq(member.organizationId, org.id));

    let linkedMembers = 0;
    for (const m of orgMembers) {
      const r = await db
        .insert(memberUnits)
        .values({ memberId: m.id, unitId: targetUnitId })
        .onConflictDoNothing({
          target: [memberUnits.memberId, memberUnits.unitId],
        });
      linkedMembers += r.rowCount ?? 0;
    }
    if (linkedMembers > 0) console.log(`  · member_units: ${linkedMembers} vínculo(s)`);

    // 4. service_units — todo serviço ganha preço por unidade = preço atual.
    const orgServices = await db
      .select({ id: services.id, price: services.price, isActive: services.isActive })
      .from(services)
      .where(eq(services.organizationId, org.id));

    let linkedServices = 0;
    for (const s of orgServices) {
      const r = await db
        .insert(serviceUnits)
        .values({
          serviceId: s.id,
          unitId: targetUnitId,
          price: s.price,
          isActive: s.isActive,
        })
        .onConflictDoNothing({
          target: [serviceUnits.serviceId, serviceUnits.unitId],
        });
      linkedServices += r.rowCount ?? 0;
    }
    if (linkedServices > 0) console.log(`  · service_units: ${linkedServices} preço(s)`);
  }

  void and; // import usado em outras queries do projeto; mantém paridade de estilo

  console.log("\n=== Backfill units concluído ===");
}

main()
  .catch((err) => {
    console.error("Backfill falhou:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
