import { useNavigate } from "react-router-dom";

export default function CashClosingReportPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0b1220",
        color: "#e5e7eb",
        fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          borderRadius: 20,
          padding: "1.5rem",
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid rgba(148, 163, 184, 0.25)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
          textAlign: "center",
        }}
      >
        <p style={{ letterSpacing: "0.2em", textTransform: "uppercase", fontSize: 12, margin: 0 }}>
          Cash closing
        </p>
        <h1 style={{ margin: "0.4rem 0 0.7rem" }}>Relatório de fechamento</h1>
        <p style={{ margin: "0 0 1.2rem", color: "#cbd5e1" }}>
          Esta rota está pronta para receber a UI definitiva do relatório de fechamento de caixa.
          Ajuste aqui quando a API estiver definida.
        </p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            border: "1px solid rgba(148, 163, 184, 0.5)",
            background: "transparent",
            color: "#e5e7eb",
            padding: "0.65rem 1.4rem",
            borderRadius: 12,
            cursor: "pointer",
          }}
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
