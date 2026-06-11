"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createAuthClient } from "better-auth/client";
import { Check, Eye, EyeOff, Lock } from "lucide-react";

const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
});

type Step = "form" | "success" | "invalid";

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Fraca", color: "#E57373" };
  if (score <= 3) return { score, label: "Média", color: "#E0BE5C" };
  return { score, label: "Forte", color: "#6FBF8F" };
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [step, setStep] = useState<Step>(token ? "form" : "invalid");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => passwordStrength(password), [password]);
  const confirmMatches = confirm.length > 0 && password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (!token) return;

    setLoading(true);
    try {
      const res = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (res.error) {
        setError("Link inválido ou expirado. Solicite um novo link.");
        setStep("invalid");
      } else {
        setStep("success");
      }
    } catch {
      setError("Erro ao definir senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rp-bg">
      {/* aura dourada de fundo */}
      <div className="rp-aura" aria-hidden="true" />

      <div className="rp-card">
        {/* Header */}
        <div className="rp-head">
          <div className="rp-mark">S</div>
          <h1>Santos Studios</h1>
          <p className="rp-sub">
            {step === "success" ? "Tudo pronto" : "Bem-vindo à equipe"}
          </p>
        </div>

        <div className="rp-body">
          {step === "invalid" && (
            <div className="rp-step">
              <p style={{ color: "#E57373", textAlign: "center", marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
                {error ?? "Link inválido ou expirado. Peça um novo convite ao administrador."}
              </p>
              <button onClick={() => router.replace("/gstsantos/login" as never)} className="rp-btn">
                Voltar ao login
              </button>
            </div>
          )}

          {step === "success" && (
            <div className="rp-step" style={{ textAlign: "center" }}>
              <div className="rp-ring">
                <Check size={36} strokeWidth={2.5} />
              </div>
              <p style={{ color: "#F4EEDF", fontSize: 17, fontWeight: 600, margin: "0 0 6px" }}>
                Senha criada com sucesso
              </p>
              <p style={{ color: "#8A847A", fontSize: 13, margin: "0 0 26px", lineHeight: 1.5 }}>
                Sua conta está pronta. Entre no painel para ver sua agenda.
              </p>
              <button onClick={() => router.replace("/gstsantos/login" as never)} className="rp-btn">
                Ir para o login
              </button>
            </div>
          )}

          {step === "form" && (
            <form onSubmit={handleSubmit} className="rp-step">
              <p style={{ color: "#C8C2B4", fontSize: 13.5, margin: "0 0 22px", lineHeight: 1.55 }}>
                Você foi adicionado à equipe Santos Studios. Crie sua senha para
                acessar o painel.
              </p>

              <div className="rp-field">
                <label>Nova senha</label>
                <div className="rp-input-wrap">
                  <Lock size={15} className="rp-input-icon" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="rp-eye"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="rp-strength">
                    <div className="rp-strength-track">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span
                          key={i}
                          style={{
                            background: i <= strength.score ? strength.color : "#2A2620",
                          }}
                        />
                      ))}
                    </div>
                    <span style={{ color: strength.color, fontSize: 11, fontWeight: 600 }}>
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              <div className="rp-field">
                <label>Confirmar senha</label>
                <div className="rp-input-wrap">
                  <Lock size={15} className="rp-input-icon" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Repita a senha"
                  />
                  {confirmMatches && (
                    <span className="rp-match">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                </div>
              </div>

              {error && <p className="rp-error">{error}</p>}

              <button type="submit" disabled={loading} className="rp-btn" style={{ marginTop: 8 }}>
                {loading ? (
                  <span className="rp-spinner" aria-hidden="true" />
                ) : (
                  "Criar senha e ativar conta"
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      <style>{`
        .rp-bg {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0B0B0B;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }
        .rp-aura {
          position: absolute;
          width: 720px;
          height: 480px;
          top: -180px;
          left: 50%;
          transform: translateX(-50%);
          background: radial-gradient(ellipse at center, rgba(201,168,76,0.13), transparent 65%);
          pointer-events: none;
          animation: rpAura 6s ease-in-out infinite alternate;
        }
        @keyframes rpAura {
          from { opacity: 0.7; transform: translateX(-50%) scale(1); }
          to { opacity: 1; transform: translateX(-50%) scale(1.08); }
        }
        .rp-card {
          width: 100%;
          max-width: 400px;
          background: rgba(19,18,17,0.82);
          backdrop-filter: blur(20px) saturate(1.3);
          -webkit-backdrop-filter: blur(20px) saturate(1.3);
          border: 1px solid #2A2620;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 40px 80px -40px rgba(0,0,0,0.9), 0 0 0 1px rgba(201,168,76,0.06);
          animation: rpCardIn 0.55s cubic-bezier(.2,.7,.2,1);
        }
        @keyframes rpCardIn {
          from { opacity: 0; transform: translateY(24px) scale(0.98); }
          to { opacity: 1; transform: none; }
        }
        .rp-head {
          padding: 34px 28px 24px;
          border-bottom: 1px solid #2A2620;
          text-align: center;
          background: linear-gradient(180deg, rgba(201,168,76,0.05), transparent);
        }
        .rp-mark {
          width: 52px;
          height: 52px;
          border: 1px solid #C9A84C;
          border-radius: 50%;
          display: inline-grid;
          place-items: center;
          color: #C9A84C;
          font-size: 24px;
          font-style: italic;
          font-family: Georgia, serif;
          box-shadow: 0 0 32px -10px rgba(201,168,76,0.6);
          animation: rpMarkIn 0.7s cubic-bezier(.2,.7,.2,1) 0.1s backwards;
        }
        @keyframes rpMarkIn {
          from { opacity: 0; transform: scale(0.6); }
          to { opacity: 1; transform: scale(1); }
        }
        .rp-head h1 {
          font-family: Georgia, serif;
          font-size: 22px;
          color: #F4EEDF;
          margin: 14px 0 4px;
          font-weight: 600;
        }
        .rp-sub {
          color: #C9A84C;
          font-size: 11px;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          margin: 0;
        }
        .rp-body { padding: 28px; }
        .rp-step { animation: rpStepIn 0.4s cubic-bezier(.2,.7,.2,1); }
        @keyframes rpStepIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: none; }
        }
        .rp-field { margin-bottom: 18px; }
        .rp-field label {
          display: block;
          font-size: 11px;
          color: #8A847A;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          margin-bottom: 7px;
        }
        .rp-input-wrap { position: relative; display: flex; align-items: center; }
        .rp-input-icon {
          position: absolute;
          left: 14px;
          color: #8A847A;
          pointer-events: none;
        }
        .rp-input-wrap input {
          width: 100%;
          padding: 13px 44px 13px 40px;
          min-height: 48px;
          background: #0B0B0B;
          border: 1px solid #2A2620;
          border-radius: 12px;
          color: #F4EEDF;
          font-size: 15px;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .rp-input-wrap input:focus {
          border-color: #C9A84C;
          box-shadow: 0 0 0 3px rgba(201,168,76,0.12);
        }
        .rp-eye {
          position: absolute;
          right: 8px;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: none;
          background: transparent;
          color: #8A847A;
          cursor: pointer;
          display: grid;
          place-items: center;
          transition: color 0.2s;
        }
        .rp-eye:hover { color: #C9A84C; }
        .rp-match {
          position: absolute;
          right: 14px;
          color: #6FBF8F;
          display: grid;
          place-items: center;
          animation: rpMatchIn 0.25s cubic-bezier(.2,.7,.2,1);
        }
        @keyframes rpMatchIn {
          from { opacity: 0; transform: scale(0.4); }
          to { opacity: 1; transform: scale(1); }
        }
        .rp-strength {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 9px;
        }
        .rp-strength-track { display: flex; gap: 4px; flex: 1; }
        .rp-strength-track span {
          flex: 1;
          height: 3px;
          border-radius: 999px;
          transition: background 0.3s;
        }
        .rp-error {
          color: #E57373;
          font-size: 13px;
          margin: 0 0 14px;
          text-align: center;
          animation: rpStepIn 0.3s ease;
        }
        .rp-btn {
          width: 100%;
          min-height: 50px;
          padding: 14px 24px;
          background: linear-gradient(180deg,#E0BE5C,#C9A84C 48%,#8E6A24);
          color: #1A1408;
          font-weight: 700;
          font-size: 15px;
          border: none;
          border-radius: 999px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 12px 28px -10px rgba(201,168,76,0.5);
          transition: transform 0.18s, box-shadow 0.18s, opacity 0.18s;
        }
        .rp-btn:hover { transform: translateY(-1px); box-shadow: 0 16px 34px -10px rgba(201,168,76,0.6); }
        .rp-btn:active { transform: translateY(0) scale(0.99); }
        .rp-btn[disabled] { opacity: 0.55; cursor: wait; }
        .rp-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(26,20,8,0.3);
          border-top-color: #1A1408;
          border-radius: 50%;
          animation: rpSpin 0.7s linear infinite;
        }
        @keyframes rpSpin { to { transform: rotate(360deg); } }
        .rp-ring {
          width: 76px;
          height: 76px;
          margin: 4px auto 18px;
          border-radius: 50%;
          border: 1px solid #C9A84C;
          background: radial-gradient(circle at 30% 30%, rgba(201,168,76,0.22), transparent 70%);
          display: grid;
          place-items: center;
          color: #C9A84C;
          animation: rpRingIn 0.6s cubic-bezier(.2,.7,.2,1);
          box-shadow: 0 0 40px -12px rgba(201,168,76,0.55);
        }
        @keyframes rpRingIn {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rp-card, .rp-step, .rp-mark, .rp-ring, .rp-aura, .rp-match { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100dvh", background: "#0B0B0B", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#8A847A" }}>Carregando...</p>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
