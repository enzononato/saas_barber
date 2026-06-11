"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          redirectTo: `${window.location.origin}/gstsantos/reset-password`,
        }),
      });
      // Always show success — don't reveal if email exists
      setSent(true);
    } catch {
      setError("Erro ao enviar e-mail. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-aura" style={{ top: "-15%", left: "-10%" }} />
      <div className="auth-aura" style={{ bottom: "-20%", right: "-12%", animationDelay: "-4s" }} />

      <div className="auth-card">
        {/* Header */}
        <div
          style={{
            padding: "36px 28px 26px",
            borderBottom: "1px solid rgba(201,168,76,0.12)",
            textAlign: "center",
          }}
        >
          <div className="auth-mark">S</div>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 24,
              color: "#F4EEDF",
              margin: "14px 0 4px",
              letterSpacing: "-0.01em",
            }}
          >
            Santos Studios
          </h1>
          <p
            style={{
              color: "#8A847A",
              fontSize: 10.5,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              fontFamily: "'JetBrains Mono', monospace",
              margin: 0,
            }}
          >
            Recuperar acesso
          </p>
        </div>

        <div style={{ padding: "28px" }}>
          {sent ? (
            <>
              <div style={{ textAlign: "center", padding: "12px 0 22px" }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "rgba(111,191,143,0.1)",
                    border: "1px solid rgba(111,191,143,0.4)",
                    display: "inline-grid",
                    placeItems: "center",
                    color: "#6FBF8F",
                    marginBottom: 16,
                    animation: "ringIn .5s cubic-bezier(.2,.7,.2,1)",
                  }}
                >
                  <Check size={26} strokeWidth={2.2} />
                </div>
                <p style={{ color: "#F4EEDF", fontWeight: 600, fontSize: 16, margin: "0 0 8px" }}>
                  E-mail enviado!
                </p>
                <p style={{ color: "#8A847A", fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>
                  Se este e-mail está cadastrado, você receberá um link para definir sua senha.
                </p>
              </div>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Link
                href={"/gstsantos/login" as any}
                className="gst-btn gst-btn-gold"
                style={{ width: "100%", minHeight: 48, fontSize: 14.5, textDecoration: "none" }}
              >
                Voltar ao login
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <p style={{ color: "#C8C2B4", fontSize: 13.5, lineHeight: 1.55, margin: "0 0 22px" }}>
                Informe seu e-mail e enviaremos um link para você definir uma nova senha.
              </p>

              <div style={{ marginBottom: 22 }}>
                <label className="gst-label" htmlFor="fp-email">
                  E-mail
                </label>
                <div style={{ position: "relative" }}>
                  <Mail
                    size={15}
                    strokeWidth={1.8}
                    style={{
                      position: "absolute",
                      left: 14,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#8A847A",
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    id="fp-email"
                    className="gst-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="voce@email.com"
                    style={{ width: "100%", paddingLeft: 40, minHeight: 46 }}
                  />
                </div>
              </div>

              {error && (
                <div className="err-banner" role="alert" style={{ textAlign: "center" }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="gst-btn gst-btn-gold"
                style={{ width: "100%", minHeight: 48, fontSize: 14.5, marginBottom: 16 }}
              >
                {loading ? (
                  <>
                    <span className="spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar link"
                )}
              </button>

              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Link
                href={"/gstsantos/login" as any}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  width: "100%",
                  justifyContent: "center",
                  color: "#8A847A",
                  fontSize: 13,
                  textDecoration: "none",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#C9A84C")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#8A847A")}
              >
                <ArrowLeft size={14} />
                Voltar ao login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
