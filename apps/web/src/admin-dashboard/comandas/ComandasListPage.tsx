import { useEffect, useMemo, useState } from "react";
import { type Comanda, listComandas } from "../../services/api";

type Feedback =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | null;

export function ComandasListPage() {
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [items, setItems] = useState<Comanda[]>([]);

  const load = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const data = await listComandas({
        q: search.trim() || undefined,
        status: "ABERTO",
      });
      setItems(data);
      if (!data.length) {
        setFeedback({ kind: "error", message: "Nenhuma comanda aberta encontrada." });
      }
    } catch (err) {
      setFeedback({
        kind: "error",
        message: err instanceof Error ? err.message : "Falha ao carregar comandas.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const totalAbertas = useMemo(() => items.length, [items]);

  return (
    <div className="axis-panels-grid" style={{ gridTemplateColumns: "1fr" }}>
      <div className="axis-panel">
        <div className="axis-panel-header">
          <div>
            <div className="axis-panel-title">Comandas em andamento</div>
            <div className="axis-panel-subtitle">
              Consulte e filtre comandas abertas (nome, CPF, celular ou número).
            </div>
          </div>
          <div className="axis-panel-chip">Abertas: {totalAbertas}</div>
        </div>

        <div className="axis-form-grid" style={{ gridTemplateColumns: "1fr auto" }}>
          <input
            className="axis-input"
            placeholder="Buscar por nome, CPF, celular ou nº da comanda"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className="axis-button-secondary"
            onClick={load}
            disabled={isLoading}
          >
            {isLoading ? "Buscando..." : "Pesquisar"}
          </button>
        </div>

        {feedback && (
          <div
            className="axis-alert"
            style={{
              background:
                feedback.kind === "success"
                  ? "rgba(34,197,94,0.12)"
                  : "rgba(248,113,113,0.12)",
              border: "1px solid rgba(148,163,184,0.35)",
              padding: "0.65rem 0.8rem",
              borderRadius: "0.75rem",
              marginTop: "0.6rem",
            }}
          >
            {feedback.message}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.8rem" }}>
          {items.map((c) => {
            const totalValue = c.totalValue ?? 0;
            const totalItems = c.totalItems ?? 0;
            return (
              <div key={c.id} className="axis-list-item" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.5rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <strong>{c.customerName || "Sem nome"}</strong>
                  <span style={{ opacity: 0.8 }}>Nº Comanda: {c.number}</span>
                  <span style={{ opacity: 0.75 }}>Itens: {totalItems}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700 }}>R$ {totalValue.toFixed(2)}</div>
                  <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>
                    Mesa: {c.tableNumber || "-"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ComandasListPage;
