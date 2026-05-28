import { z } from "zod";

const emptyToUndef = (val: unknown) => (val === "" ? undefined : val);

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // email (opcional — sem quebrar se não configurado)
  RESEND_API_KEY: z.preprocess(emptyToUndef, z.string().optional()),
  RESEND_FROM: z.preprocess(emptyToUndef, z.string().optional()),
  // Push Notifications (VAPID) — opcionais para não quebrar dev sem configurar
  VAPID_PUBLIC_KEY: z.preprocess(emptyToUndef, z.string().optional()),
  VAPID_PRIVATE_KEY: z.preprocess(emptyToUndef, z.string().optional()),
  VAPID_SUBJECT: z.preprocess(emptyToUndef, z.string().optional()),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.preprocess(emptyToUndef, z.string().optional()),
  // Cron secret — protege endpoint de follow-up
  CRON_SECRET: z.preprocess(emptyToUndef, z.string().optional()),
  // Evolution API (global do sistema, usada pra provisionar instâncias WhatsApp)
  EVOLUTION_API_URL: z.preprocess(emptyToUndef, z.string().url().optional()),
  EVOLUTION_API_KEY: z.preprocess(emptyToUndef, z.string().min(1).optional()),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
