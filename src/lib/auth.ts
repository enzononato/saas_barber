import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

import { db } from "@/server/db";
import * as authSchema from "@/server/db/schema/auth";
import { env } from "@/lib/env";
import {
  consumeInviteFlag,
  sendBarberInviteEmail,
  sendPasswordResetEmail,
} from "@/lib/email";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authSchema.user,
      session: authSchema.session,
      account: authSchema.account,
      verification: authSchema.verification,
      organization: authSchema.organization,
      member: authSchema.member,
      invitation: authSchema.invitation,
    },
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      // Convite de novo profissional → e-mail de boas-vindas;
      // fluxo normal de "esqueci minha senha" → e-mail de redefinição.
      if (consumeInviteFlag(user.email)) {
        await sendBarberInviteEmail({
          name: user.name,
          email: user.email,
          setupUrl: url,
        });
      } else {
        await sendPasswordResetEmail({
          name: user.name,
          email: user.email,
          resetUrl: url,
        });
      }
    },
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 5,
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
