export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "40px 22px",
        gap: 20,
      }}
    >
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--gold)",
        }}
      >
        404
      </div>
      <h1
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "clamp(36px, 8vw, 72px)",
          lineHeight: 1,
          letterSpacing: "-0.03em",
          margin: 0,
        }}
      >
        Barbearia não encontrada.
      </h1>
      <p style={{ color: "var(--paper-dim)", maxWidth: 420, fontSize: 15 }}>
        Este link pode estar incorreto ou a barbearia pode não estar disponível ainda.
      </p>
      <a
        href="/"
        style={{
          marginTop: 12,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          letterSpacing: "0.14em",
          color: "var(--gold)",
        }}
      >
        ← Voltar ao início
      </a>
    </div>
  );
}
