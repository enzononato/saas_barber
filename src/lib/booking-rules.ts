/** Antecedência mínima (horas) para o cliente cancelar/reagendar sozinho. */
export const SELF_SERVICE_MIN_HOURS = 2;

export function canSelfManage(startsAt: Date | string, status: string): boolean {
  const msUntil = new Date(startsAt).getTime() - Date.now();
  return status === "SCHEDULED" && msUntil > SELF_SERVICE_MIN_HOURS * 3_600_000;
}
