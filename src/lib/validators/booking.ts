import { z } from "zod";

export const availabilityQuerySchema = z.object({
  memberId: z.string().min(1),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
});

export const createAppointmentSchema = z.object({
  serviceId: z.string().uuid(),
  memberId: z.string().min(1),
  startsAt: z.string().datetime({ message: "Expected ISO 8601 UTC datetime" }),
  clientName: z.string().min(1).max(200),
  clientPhone: z.string().min(8).max(20),
  notes: z.string().max(500).optional(),
});
