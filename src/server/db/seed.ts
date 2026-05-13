import "dotenv/config";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";

import { db, pool } from "./index";
import { member, organization, user } from "./schema/auth";
import { services } from "./schema/services";
import { workingHours } from "./schema/availability";

const ORG = {
  name: "Santos Studios Barbearia",
  slug: "santos-studios",
};

const USERS = [
  {
    name: "Dono Santos",
    email: "dono@santos.com",
    password: "senha123",
    role: "owner" as const,
  },
  {
    name: "João Silva",
    email: "joao@santos.com",
    password: "senha123",
    role: "member" as const,
  },
  {
    name: "Pedro Souza",
    email: "pedro@santos.com",
    password: "senha123",
    role: "member" as const,
  },
];

const SERVICES = [
  { name: "Corte", price: "35.00", durationMinutes: 30 },
  { name: "Barba", price: "25.00", durationMinutes: 20 },
  { name: "Combo Corte + Barba", price: "55.00", durationMinutes: 45 },
];

async function ensureUser(input: { name: string; email: string; password: string }) {
  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, input.email))
    .limit(1);

  if (existing.length > 0) {
    console.log(`  - user exists: ${input.email}`);
    return existing[0].id;
  }

  console.log(`  - creating user: ${input.email}`);
  await auth.api.signUpEmail({
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
    },
  });

  const created = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, input.email))
    .limit(1);

  if (created.length === 0) {
    throw new Error(`User ${input.email} not found after signup`);
  }
  return created[0].id;
}

async function ensureOrganization() {
  const existing = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, ORG.slug))
    .limit(1);

  if (existing.length > 0) {
    console.log(`  - organization exists: ${ORG.slug}`);
    return existing[0].id;
  }

  const id = randomUUID();
  console.log(`  - creating organization: ${ORG.slug}`);
  await db
    .insert(organization)
    .values({
      id,
      name: ORG.name,
      slug: ORG.slug,
      createdAt: new Date(),
    })
    .onConflictDoNothing({ target: organization.slug });

  return id;
}

async function ensureMember(orgId: string, userId: string, role: "owner" | "member") {
  const existing = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
    .limit(1);

  if (existing.length > 0) {
    console.log(`  - member exists: ${userId} (${role})`);
    return;
  }

  console.log(`  - creating member: ${userId} (${role})`);
  await db.insert(member).values({
    id: randomUUID(),
    organizationId: orgId,
    userId,
    role,
    createdAt: new Date(),
  });
}

async function ensureService(orgId: string, data: (typeof SERVICES)[number]) {
  const existing = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.organizationId, orgId), eq(services.name, data.name)))
    .limit(1);

  if (existing.length > 0) {
    console.log(`  - service exists: ${data.name}`);
    return;
  }

  console.log(`  - creating service: ${data.name} (R$ ${data.price} / ${data.durationMinutes}min)`);
  await db.insert(services).values({
    organizationId: orgId,
    name: data.name,
    price: data.price,
    durationMinutes: data.durationMinutes,
  });
}

async function ensureWorkingHours(orgId: string, professionalId: string) {
  let created = 0;
  for (let dayOfWeek = 1; dayOfWeek <= 6; dayOfWeek++) {
    const existing = await db
      .select({ id: workingHours.id })
      .from(workingHours)
      .where(
        and(
          eq(workingHours.professionalId, professionalId),
          eq(workingHours.dayOfWeek, dayOfWeek),
        ),
      )
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(workingHours).values({
      organizationId: orgId,
      professionalId,
      dayOfWeek,
      startTime: "09:00",
      endTime: "19:00",
    });
    created += 1;
  }
  console.log(`  - working hours for ${professionalId}: ${created} row(s) created (Mon-Sat 09:00-19:00)`);
}

async function main() {
  console.log("Seeding Santos Studios...\n");

  console.log("[1/4] Users (via Better Auth)");
  const userIdByEmail: Record<string, string> = {};
  for (const u of USERS) {
    userIdByEmail[u.email] = await ensureUser(u);
  }

  console.log("\n[2/4] Organization");
  const orgId = await ensureOrganization();

  console.log("\n[3/4] Members");
  for (const u of USERS) {
    await ensureMember(orgId, userIdByEmail[u.email], u.role);
  }

  console.log("\n[4/4] Services + Working Hours");
  for (const s of SERVICES) {
    await ensureService(orgId, s);
  }
  for (const u of USERS) {
    await ensureWorkingHours(orgId, userIdByEmail[u.email]);
  }

  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error("\nSeed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
