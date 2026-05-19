"use client";

import { useState } from "react";
import Link from "next/link";

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
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0B0B0B",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#131211",
          border: "1px solid #2A2620",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "32px 28px 24px",
            borderBottom: "1px solid #2A2620",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              border: "1px solid #C9A84C",
              borderRadius: "50%",
              display: "inline-grid",
              placeItems: "center",
              color: "#C9A84C",
              fontSize: 22,
              fontStyle: "italic",
              fontFamily: "Georgia, serif",
            }}
          >
            S
          </div>
          <h1
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 22,
              color: "#F4EEDF",
              margin: "12px 0 4px",
            }}
          >
            Santos Studios
          </h1>
          <p
            style={{
              color: "#8A847A",
              fontSize: 11,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Recuperar acesso
          </p>
        </div>

        <div style={{ padding: "28px" }}>
          {sent ? (
            <>
              <div
                style={{
                  textAlign: "center",
                  padding: "12px 0 20px",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "#4CAF5022",
                    border: "1px solid #4CAF5044",
                    display: "inline-grid",
                    placeItems: "center",
                    fontSize: 22,
                    marginBottom: 16,
                  }}
                >
                  ✓
                </div>
                <p style={{ color: "#F4EEDF", fontWeight: 600, margin: "0 0 8px" }}>
                  E-mail enviado!
                </p>
                <p style={{ color: "#8A847A", fontSize: 13, margin: 0 }}>
                  Se este e-mail está cadastrado, você receberá um link para definir sua senha.
                </p>
              </div>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Link
                href={"/gstsantos/login" as any}
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "13px 24px",
                  background: "linear-gradient(180deg,#E0BE5C,#C9A84C 48%,#8E6A24)",
                  color: "#1A1408",
                  fontWeight: 700,
                  fontSize: 15,
                  borderRadius: 999,
                  textDecoration: "none",
                }}
              >
                Voltar ao login
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <p style={{ color: "#C8C2B4", fontSize: 13, margin: "0 0 20px" }}>
                Informe seu e-mail e enviaremos um link para você definir uma nova senha.
              </p>

              <div style={{ marginBottom: 24 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "#8A847A",
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    marginBottom: 6,
                  }}
                >
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "#0B0B0B",
                    border: "1px solid #2A2620",
                    borderRadius: 8,
                    color: "#F4EEDF",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {error && (
                <p style={{ color: "#E57373", fontSize: 13, marginBottom: 16, textAlign: "center" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "13px 24px",
                  background: loading
                    ? "#2A2620"
                    : "linear-gradient(180deg,#E0BE5C,#C9A84C 48%,#8E6A24)",
                  color: loading ? "#8A847A" : "#1A1408",
                  fontWeight: 700,
                  fontSize: 15,
                  border: "none",
                  borderRadius: 999,
                  cursor: loading ? "not-allowed" : "pointer",
                  marginBottom: 16,
                }}
              >
                {loading ? "Enviando..." : "Enviar link"}
              </button>

              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Link
                href={"/gstsantos/login" as any}
                style={{
                  display: "block",
                  textAlign: "center",
                  color: "#8A847A",
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                ← Voltar ao login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
