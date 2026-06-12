import { z } from "zod";

const uuidList = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(,[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}){0,4}$/i,
    "Expected comma-separated UUIDs (max 5)",
  );

export const availabilityQuerySchema = z
  .object({
    memberId: z.string().min(1),
    serviceId: z.string().uuid().optional(),
    // Multi-serviço: lista de UUIDs separados por vírgula
    serviceIds: uuidList.optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
    unitId: z.string().uuid().optional(),
  })
  .refine((d) => d.serviceId || d.serviceIds, {
    message: "serviceId or serviceIds is required",
    path: ["serviceId"],
  });

export const createAppointmentSchema = z
  .object({
    serviceId: z.string().uuid().optional(),
    // Multi-serviço (Corte + Barba + ...) — ordem define a posição
    serviceIds: z.array(z.string().uuid()).min(1).max(5).optional(),
    memberId: z.string().min(1),
    unitId: z.string().uuid().optional(),
    startsAt: z.string().datetime({ message: "Expected ISO 8601 UTC datetime" }),
    clientName: z.string().min(1).max(200),
    clientPhone: z.string().min(8).max(20),
    notes: z.string().max(500).optional(),
  })
  .refine((d) => d.serviceId || (d.serviceIds && d.serviceIds.length > 0), {
    message: "serviceId or serviceIds is required",
    path: ["serviceId"],
  });
