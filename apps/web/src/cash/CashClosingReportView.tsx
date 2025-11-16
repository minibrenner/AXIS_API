import type { FC } from "react";
import type { CashClosingReport } from "../services/api";

type Props = {
  report: CashClosingReport;
};

const formatCurrency = (value: number) =>
  (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR");

const resolveName = (user: { id: string; name: string | null }) =>
  user.name || `Usuário ${user.id.slice(0, 6)}`;

const CashClosingReportView: FC<Props> = ({ report }) => (
  <div className="cash-report-printable">
    <h2>Fechamento de caixa</h2>
    <p>
      Feito por <strong>{resolveName(report.closedBy)}</strong> (abertura de{" "}
      <strong>{resolveName(report.openedBy)}</strong>)
    </p>
    <p>
      Aberto em {formatDateTime(report.openedAt)} — finalizado em {formatDateTime(report.closedAt)}
    </p>

    <section>
      <h3>Vendas</h3>
      {report.paymentBreakdown.map((payment) => (
        <div key={payment.method} className="report-row">
          <span>{payment.label}</span>
          <span>{formatCurrency(payment.amountCents)}</span>
        </div>
      ))}
      <div className="report-row total">
        <span>Faturamento total</span>
        <strong>{formatCurrency(report.totalPaymentsCents)}</strong>
      </div>
      <div className="report-row">
        <span>Total em dinheiro</span>
        <span>{formatCurrency(report.cashSalesCents)}</span>
      </div>
      <div className="report-row">
        <span>Troco concedido</span>
        <span>{formatCurrency(report.totalChangeCents)}</span>
      </div>
    </section>

    <section>
      <h3>Resumo do caixa</h3>
      <div className="report-row">
        <span>Valor de abertura</span>
        <span>{formatCurrency(report.openingCents)}</span>
      </div>
      <div className="report-row">
        <span>Valor total das sangrias</span>
        <span>{formatCurrency(report.totalWithdrawalsCents)}</span>
      </div>
      <div className="report-row">
        <span>Valor contado no fechamento</span>
        <span>{formatCurrency(report.closingCents)}</span>
      </div>
      <div className="report-row total">
        <span>Valor esperado em dinheiro</span>
        <strong>{formatCurrency(report.expectedCashCents)}</strong>
      </div>
      <div className="report-row">
        <span>Diferença (contado - esperado)</span>
        <span className={report.differenceCents === 0 ? "" : report.differenceCents > 0 ? "positive" : "negative"}>
          {formatCurrency(report.differenceCents)}
        </span>
      </div>
    </section>

    {report.fiado.totalCents > 0 && (
      <section>
        <h3>Fiado</h3>
        <div className="report-row">
          <span>Total</span>
          <span>{formatCurrency(report.fiado.totalCents)}</span>
        </div>
        <div className="fiado-list">
          {report.fiado.entries.map((entry) => (
            <div key={entry.reference} className="fiado-item">
              <strong>{entry.reference}</strong>
              <span>{formatCurrency(entry.amountCents)}</span>
            </div>
          ))}
        </div>
      </section>
    )}

    <section>
      <h3>Sangrias</h3>
      {report.withdrawals.length === 0 && <p>Nenhuma sangria registrada.</p>}
      {report.withdrawals.map((withdrawal) => (
        <div key={withdrawal.id} className="sangria-item">
          <p>
            Sangria de <strong>{formatCurrency(withdrawal.amountCents)}</strong> em {formatDateTime(withdrawal.createdAt)}
          </p>
          <p className="sangria-meta">
            Responsável: {resolveName(withdrawal.createdBy)}
          </p>
          <p>{withdrawal.reason}</p>
        </div>
      ))}
    </section>

    <section>
      <h3>Validações</h3>
      {report.approvedBy ? (
        <p>
          Supervisor ({report.approvedBy.role}) aprovado via {report.approvedBy.via}:{" "}
          <strong>{resolveName(report.approvedBy)}</strong>
        </p>
      ) : (
        <p>Nenhuma aprovação registrada.</p>
      )}
      {report.printJobId && (
        <p className="print-job">
          Job de impressão #{report.printJobId.slice(-6)} — status: {report.printJobStatus ?? "PENDING"}
        </p>
      )}
      {report.closingNotes && (
        <div className="notes">
          <strong>Observações do fechamento</strong>
          <p>{report.closingNotes}</p>
        </div>
      )}
    </section>
  </div>
);

export default CashClosingReportView;
