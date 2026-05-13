import { NextRequest, NextResponse } from "next/server";

import { getOrgBySlug } from "@/server/services/tenant";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);

  if (!org) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ id: org.id, name: org.name, slug: org.slug });
}
