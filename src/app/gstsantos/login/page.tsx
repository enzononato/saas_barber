"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { createAuthClient } = await import("better-auth/client");
      const authClient = createAuthClient({ baseURL: window.location.origin });

      const res = await authClient.signIn.email({ email, password });

      if (res.error) {
        setError("E-mail ou senha incorretos.");
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.replace("/gstsantos/agenda" as any);
      }
    } catch {
      setError("Erro ao conectar. Tente novamente.");
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
            Painel administrativo
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "28px" }}>
          <div style={{ marginBottom: 16 }}>
            <label className="gst-label" htmlFor="login-email">
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
                id="login-email"
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

          <div style={{ marginBottom: 22 }}>
            <label className="gst-label" htmlFor="login-pw">
              Senha
            </label>
            <div style={{ position: "relative" }}>
              <Lock
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
                id="login-pw"
                className="gst-input"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                style={{ width: "100%", paddingLeft: 40, paddingRight: 46, minHeight: 46 }}
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                style={{
                  position: "absolute",
                  right: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 36,
                  height: 36,
                  display: "grid",
                  placeItems: "center",
                  background: "transparent",
                  border: "none",
                  color: "#8A847A",
                  cursor: "pointer",
                  borderRadius: 8,
                  transition: "color 0.2s",
                }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
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
            style={{ width: "100%", minHeight: 48, fontSize: 14.5 }}
          >
            {loading ? (
              <>
                <span className="spin" />
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </button>

          <p style={{ textAlign: "center", margin: "20px 0 0" }}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Link
              href={"/gstsantos/forgot-password" as any}
              style={{
                color: "#8A847A",
                fontSize: 13,
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#C9A84C")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#8A847A")}
            >
              Esqueci minha senha
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
