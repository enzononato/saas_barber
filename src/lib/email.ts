import { env } from "./env";

const BRAND_HEADER = `
  <div style="background:linear-gradient(180deg,#131211,#0B0B0B);padding:32px 28px;border-bottom:1px solid #2A2620;text-align:center;">
    <div style="width:48px;height:48px;border:1px solid #C9A84C;border-radius:50%;display:inline-grid;place-items:center;color:#C9A84C;font-size:22px;font-style:italic;font-family:Georgia,serif;">S</div>
    <h1 style="font-family:Georgia,serif;font-size:24px;color:#F4EEDF;margin:16px 0 0;">Santos Studios</h1>
    <p style="color:#8A847A;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin:4px 0 0;">Barbearia</p>
  </div>`;

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(`[EMAIL] Para: ${to}\n  Assunto: ${subject}\n  (configure RESEND_API_KEY para enviar de verdade)`);
    return;
  }
  const { Resend } = await import("resend");
  const resend = new Resend(env.RESEND_API_KEY);
  const from = env.RESEND_FROM ?? "Santos Studios <noreply@seudominio.com>";
  await resend.emails.send({ from, to, subject, html });
}

function emailShell(body: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/></head>
<body style="font-family:sans-serif;background:#0B0B0B;color:#F4EEDF;padding:40px 20px;max-width:480px;margin:0 auto;">
  <div style="border:1px solid #2A2620;border-radius:16px;overflow:hidden;">
    ${BRAND_HEADER}
    <div style="padding:28px;">${body}</div>
  </div>
</body>
</html>`;
}

// Convite para novo barbeiro — link para criar sua própria senha
export async function sendBarberInviteEmail(params: {
  name: string;
  email: string;
  setupUrl: string;
}): Promise<void> {
  const { name, email, setupUrl } = params;

  if (!env.RESEND_API_KEY) {
    console.log(`[EMAIL] Convite para ${name} <${email}>\n  Link de configuração: ${setupUrl}`);
    return;
  }

  await sendEmail(
    email,
    "Você foi convidado para a equipe Santos Studios",
    emailShell(`
      <p style="font-size:16px;margin:0 0 20px;">Olá, <strong>${name}</strong>!</p>
      <p style="color:#C8C2B4;margin:0 0 24px;">Você foi adicionado à equipe Santos Studios. Clique no botão abaixo para criar sua senha e acessar o painel.</p>
      <a href="${setupUrl}" style="display:block;text-align:center;background:linear-gradient(180deg,#E0BE5C,#C9A84C 48%,#8E6A24);color:#1A1408;font-weight:700;padding:14px 24px;border-radius:999px;text-decoration:none;font-size:15px;margin-bottom:20px;">
        Criar minha senha →
      </a>
      <p style="color:#8A847A;font-size:12px;text-align:center;margin:0;">Este link expira em 1 hora. Se você não solicitou este acesso, ignore este e-mail.</p>
    `),
  );
}

// Disparado pelo Better Auth para convite de novo barbeiro E para "Esqueci minha senha"
export async function sendPasswordResetEmail(params: {
  name: string;
  email: string;
  resetUrl: string;
}): Promise<void> {
  const { name, email, resetUrl } = params;

  if (!env.RESEND_API_KEY) {
    console.log(`[EMAIL] Definir senha para ${name} <${email}>\n  Link: ${resetUrl}`);
    return;
  }

  await sendEmail(
    email,
    "Defina sua senha — Santos Studios",
    emailShell(`
      <p style="font-size:16px;margin:0 0 20px;">Olá, <strong>${name}</strong>!</p>
      <p style="color:#C8C2B4;margin:0 0 24px;">Clique no botão abaixo para definir sua senha de acesso ao painel administrativo.</p>
      <a href="${resetUrl}" style="display:block;text-align:center;background:linear-gradient(180deg,#E0BE5C,#C9A84C 48%,#8E6A24);color:#1A1408;font-weight:700;padding:14px 24px;border-radius:999px;text-decoration:none;font-size:15px;margin-bottom:20px;">
        Definir senha →
      </a>
      <p style="color:#8A847A;font-size:12px;text-align:center;margin:0;">Este link expira em 1 hora. Se não reconhece este e-mail, ignore-o com segurança.</p>
    `),
  );
}
