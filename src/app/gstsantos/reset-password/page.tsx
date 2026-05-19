"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
});

type Step = "form" | "success" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [step, setStep] = useState<Step>(token ? "form" : "invalid");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
            {step === "success" ? "Senha definida" : "Definir senha"}
          </p>
        </div>

        <div style={{ padding: "28px" }}>
          {/* Invalid token */}
          {step === "invalid" && (
            <>
              <p style={{ color: "#E57373", textAlign: "center", marginBottom: 20, fontSize: 14 }}>
                {error ?? "Link inválido ou expirado."}
              </p>
              <button
                onClick={() => router.replace("/gstsantos/login" as never)}
                style={btnStyle}
              >
                Voltar ao login
              </button>
            </>
          )}

          {/* Success */}
          {step === "success" && (
            <>
              <p
                style={{
                  color: "#4CAF50",
                  textAlign: "center",
                  marginBottom: 8,
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                Senha definida com sucesso!
              </p>
              <p
                style={{
                  color: "#8A847A",
                  textAlign: "center",
                  marginBottom: 24,
                  fontSize: 13,
                }}
              >
                Agora você pode entrar no painel.
              </p>
              <button
                onClick={() => router.replace("/gstsantos/login" as never)}
                style={btnStyle}
              >
                Ir para o login
              </button>
            </>
          )}

          {/* Form */}
          {step === "form" && (
            <form onSubmit={handleSubmit}>
              <p style={{ color: "#C8C2B4", fontSize: 13, margin: "0 0 20px" }}>
                Escolha uma senha para acessar o painel da Santos Studios.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Nova senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  style={inputStyle}
                  placeholder="Mínimo 8 caracteres"
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Confirmar senha</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  style={inputStyle}
                />
              </div>

              {error && (
                <p style={{ color: "#E57373", fontSize: 13, marginBottom: 16, textAlign: "center" }}>
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} style={btnStyle}>
                {loading ? "Salvando..." : "Definir senha"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#8A847A",
  textTransform: "uppercase",
  letterSpacing: "0.15em",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "#0B0B0B",
  border: "1px solid #2A2620",
  borderRadius: 8,
  color: "#F4EEDF",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const btnStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 24px",
  background: "linear-gradient(180deg,#E0BE5C,#C9A84C 48%,#8E6A24)",
  color: "#1A1408",
  fontWeight: 700,
  fontSize: 15,
  border: "none",
  borderRadius: 999,
  cursor: "pointer",
};
