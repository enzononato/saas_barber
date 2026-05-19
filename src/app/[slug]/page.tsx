import { and, eq, exists } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/server/db";
import { member, user } from "@/server/db/schema/auth";
import { workingHours } from "@/server/db/schema/availability";
import { services } from "@/server/db/schema/services";
import { getOrgBySlug } from "@/server/services/tenant";
import { BookingPage } from "./_components/BookingPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) return { title: "Não encontrado" };
  return {
    title: `${org.name} — Agende seu horário`,
    description: `Agende seu horário na ${org.name} em segundos. Sem cadastro.`,
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  const [servicesRows, membersRows] = await Promise.all([
    db
      .select({
        id: services.id,
        name: services.name,
        description: services.description,
        durationMinutes: services.durationMinutes,
        price: services.price,
      })
      .from(services)
      .where(and(eq(services.organizationId, org.id), eq(services.isActive, true)))
      .orderBy(services.name),
    db
      .select({ id: user.id, name: user.name })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(
        and(
          eq(member.organizationId, org.id),
          exists(
            db
              .select({ id: workingHours.id })
              .from(workingHours)
              .where(
                and(
                  eq(workingHours.organizationId, org.id),
                  eq(workingHours.professionalId, user.id),
                ),
              )
              .limit(1),
          ),
        ),
      )
      .orderBy(user.name),
  ]);

  const allMembers = [{ id: "any", name: "Sem preferência" }, ...membersRows];

  return (
    <BookingPage
      slug={slug}
      orgName={org.name}
      initialServices={servicesRows}
      initialMembers={allMembers}
    />
  );
}
