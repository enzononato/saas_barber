"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
            Painel administrativo
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "28px" }}>
          <div style={{ marginBottom: 16 }}>
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
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
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
            <p
              style={{
                color: "#E57373",
                fontSize: 13,
                marginBottom: 16,
                textAlign: "center",
              }}
            >
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
              transition: "opacity 0.2s",
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
