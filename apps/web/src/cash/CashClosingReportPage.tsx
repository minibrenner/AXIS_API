import { useCallback, useEffect, useState, type FormEvent } from "react";
import CashClosingReportView from "./CashClosingReportView";
import { fetchCashClosingReport, type CashClosingReport } from "../services/api";

const CashClosingReportPage = () => {
  const [accessToken, setAccessToken] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [report, setReport] = useState<CashClosingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoPrint, setAutoPrint] = useState(true);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!accessToken || !sessionId) {
        setError("Informe o token e o ID da sessão do caixa.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchCashClosingReport(accessToken, sessionId);
        setReport(payload);
      } catch (err) {
        setReport(null);
        setError(err instanceof Error ? err.message : "Erro ao carregar o relatório.");
      } finally {
        setLoading(false);
      }
    },
    [accessToken, sessionId],
  );

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  useEffect(() => {
    if (autoPrint && report) {
      handlePrint();
    }
  }, [autoPrint, report, handlePrint]);

  return (
    <div className="cash-report-page">
      <form className="report-form no-print" onSubmit={handleSubmit}>
        <h1>Relatório de fechamento</h1>
        <label>
          Token de acesso (Bearer)
          <input
            type="text"
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
            placeholder="eyJhbGciOi..."
          />
        </label>
        <label>
          ID da sessão do caixa
          <input
            type="text"
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            placeholder="ckxy123..."
          />
        </label>
        <label className="auto-print">
          <input
            type="checkbox"
            checked={autoPrint}
            onChange={(event) => setAutoPrint(event.target.checked)}
          />
          Imprimir automaticamente após carregar o relatório
        </label>
        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {loading ? "Carregando..." : "Buscar relatório"}
          </button>
          {report && (
            <button type="button" onClick={handlePrint}>
              Imprimir
            </button>
          )}
        </div>
        <p className="hint">
          Use o token obtido no login e o identificador da sessão aberta/fechada. Ao fechar o caixa no PDV, armazene o
          ID retornado para poder imprimir aqui.
        </p>
      </form>
      {error && <p className="error no-print">{error}</p>}
      {report && (
        <div className="report-preview">
          <CashClosingReportView report={report} />
        </div>
      )}
    </div>
  );
};

export default CashClosingReportPage;
