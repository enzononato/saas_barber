import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { organization } from "@/server/db/schema";

export type OrgRecord = {
  id: string;
  name: string;
  slug: string | null;
};

export async function getOrgBySlug(slug: string): Promise<OrgRecord | null> {
  const rows = await db
    .select({ id: organization.id, name: organization.name, slug: organization.slug })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}
