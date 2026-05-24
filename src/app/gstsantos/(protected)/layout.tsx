import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { SidebarNav } from "../_components/SidebarNav";
import { requireAuth } from "@/server/middleware/requireAuth";
import { PushPrompt } from "@/components/PushPrompt";

export default async function GstLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!session) redirect("/gstsantos/login" as any);

  const ctx = await requireAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!ctx) redirect("/gstsantos/login" as any);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100dvh",
        background: "#0B0B0B",
        color: "#F4EEDF",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <SidebarNav role={ctx.role} canManageBarbers={ctx.role === "owner" || ctx.canCreateServices} />
      <main
        style={{
          flex: 1,
          paddingBottom: 80, // space for mobile bottom nav
          overflowX: "hidden",
        }}
      >
        {children}
      </main>
      <PushPrompt />
    </div>
  );
}
