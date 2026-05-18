import "dotenv/config";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";

import { auth } from "@/lib/auth";

import { db, pool } from "./index";
import { account, member, organization, session, user } from "./schema/auth";
import { services } from "./schema/services";

const ORG = {
  name: "Santos Studios Barbearia",
  slug: "santos-studios",
};

const SUPERADMIN = {
  name: "Enzo Nonato",
  email: "enzononato10@gmail.com",
  password: "Ee123456@",
  role: "owner" as const,
};

const OLD_TEST_EMAILS = ["dono@santos.com", "joao@santos.com", "pedro@santos.com"];

const SERVICES = [
  { name: "Corte", price: "35.00", durationMinutes: 30 },
  { name: "Barba", price: "25.00", durationMinutes: 20 },
  { name: "Combo Corte + Barba", price: "55.00", durationMinutes: 45 },
];

async function cleanOldTestUsers() {
  const oldUsers = await db
    .select({ id: user.id })
    .from(user)
    .where(inArray(user.email, OLD_TEST_EMAILS));

  if (oldUsers.length === 0) {
    console.log("  - no old test users to clean up");
    return;
  }

  const oldIds = oldUsers.map((u) => u.id);
  console.log(`  - removing ${oldIds.length} old test user(s)...`);

  // cascade-friendly order
  await db.delete(session).where(inArray(session.userId, oldIds));
  await db.delete(account).where(inArray(account.userId, oldIds));
  await db.delete(member).where(inArray(member.userId, oldIds));
  await db.delete(user).where(inArray(user.id, oldIds));
}

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
    body: { name: input.name, email: input.email, password: input.password },
  });

  const created = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, input.email))
    .limit(1);

  if (created.length === 0) throw new Error(`User ${input.email} not found after signup`);
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
  await db.insert(organization).values({ id, name: ORG.name, slug: ORG.slug, createdAt: new Date() });
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
    canCreateServices: false,
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
  await db.insert(services).values({ organizationId: orgId, name: data.name, price: data.price, durationMinutes: data.durationMinutes });
}

async function main() {
  console.log("Seeding Santos Studios...\n");

  console.log("[1/4] Cleaning old test users");
  await cleanOldTestUsers();

  console.log("\n[2/4] Superadmin user");
  const adminId = await ensureUser(SUPERADMIN);

  console.log("\n[3/4] Organization + member");
  const orgId = await ensureOrganization();
  await ensureMember(orgId, adminId, SUPERADMIN.role);

  console.log("\n[4/4] Services");
  for (const s of SERVICES) await ensureService(orgId, s);

  console.log("\nDone.");
}

main()
  .catch((err) => { console.error("\nSeed failed:", err); process.exitCode = 1; })
  .finally(async () => { await pool.end(); });
