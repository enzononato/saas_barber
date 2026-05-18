import { redirect } from "next/navigation";

export default function GstRoot() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redirect("/gstsantos/agenda?view=list" as any);
}
