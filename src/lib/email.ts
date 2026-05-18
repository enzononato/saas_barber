import { env } from "./env";

interface WelcomeEmailParams {
  name: string;
  email: string;
  password: string;
  loginUrl: string;
}

export async function sendBarberWelcomeEmail(params: WelcomeEmailParams): Promise<void> {
  const { name, email, password, loginUrl } = params;

  if (!env.RESEND_API_KEY) {
    console.log(
      `[EMAIL] Bem-vindo a ${name} <${email}>\n  Login: ${loginUrl}\n  Senha: ${password}`,
    );
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(env.RESEND_API_KEY);
  const from = env.RESEND_FROM ?? "Santos Studios <noreply@seudominio.com>";

  await resend.emails.send({
    from,
    to: email,
    subject: "Bem-vindo ao Santos Studios — Suas credenciais de acesso",
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/></head>
<body style="font-family:sans-serif;background:#0B0B0B;color:#F4EEDF;padding:40px 20px;max-width:480px;margin:0 auto;">
  <div style="border:1px solid #2A2620;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(180deg,#131211,#0B0B0B);padding:32px 28px;border-bottom:1px solid #2A2620;text-align:center;">
      <div style="width:48px;height:48px;border:1px solid #C9A84C;border-radius:50%;display:inline-grid;place-items:center;color:#C9A84C;font-size:22px;font-style:italic;font-family:Georgia,serif;">S</div>
      <h1 style="font-family:Georgia,serif;font-size:24px;color:#F4EEDF;margin:16px 0 0;">Santos Studios</h1>
      <p style="color:#8A847A;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin:4px 0 0;">Barbearia</p>
    </div>
    <div style="padding:28px;">
      <p style="font-size:16px;margin:0 0 20px;">Olá, <strong>${name}</strong>!</p>
      <p style="color:#C8C2B4;margin:0 0 24px;">Você foi adicionado à equipe Santos Studios. Aqui estão suas credenciais de acesso ao painel administrativo:</p>
      <div style="background:#131211;border:1px solid #2A2620;border-radius:10px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:12px;color:#8A847A;text-transform:uppercase;letter-spacing:0.2em;">E-mail</p>
        <p style="margin:0 0 16px;font-family:monospace;font-size:15px;">${email}</p>
        <p style="margin:0 0 8px;font-size:12px;color:#8A847A;text-transform:uppercase;letter-spacing:0.2em;">Senha temporária</p>
        <p style="margin:0;font-family:monospace;font-size:15px;color:#C9A84C;">${password}</p>
      </div>
      <a href="${loginUrl}" style="display:block;text-align:center;background:linear-gradient(180deg,#E0BE5C,#C9A84C 48%,#8E6A24);color:#1A1408;font-weight:700;padding:14px 24px;border-radius:999px;text-decoration:none;font-size:15px;">
        Acessar painel →
      </a>
      <p style="color:#8A847A;font-size:12px;text-align:center;margin:20px 0 0;">Altere sua senha após o primeiro acesso.</p>
    </div>
  </div>
</body>
</html>`,
  });
}
