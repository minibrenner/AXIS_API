import { FormEvent, useState } from "react";

import "./axis-pos.css";

type AxisPosCloseCashModalProps = {
  isOpen: boolean;
  isSubmitting?: boolean;
  cashSessionId: string | null;
  registerNumber?: string | null;
  feedback?: { type: "error" | "success"; message: string } | null;
  requireSupervisor?: boolean;
  onCancel?: () => void;
  onConfirm?: (payload: { closingAmount: string; supervisorSecret: string; notes?: string }) => void;
};

export function AxisPosCloseCashModal({
  isOpen,
  isSubmitting = false,
  cashSessionId,
  registerNumber,
  feedback = null,
  onCancel,
  onConfirm,
  requireSupervisor = false,
}: AxisPosCloseCashModalProps) {
  const [closingAmount, setClosingAmount] = useState("");
  const [supervisorSecret, setSupervisorSecret] = useState("");
  const [notes, setNotes] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cashSessionId || !onConfirm) return;
    onConfirm({
      closingAmount,
      supervisorSecret,
      notes,
    });
  };

  const registerLabel =
    registerNumber && registerNumber.trim().length > 0
      ? `Caixa ${registerNumber.trim()}`
      : "Caixa aberto";

  return (
    <div className="axis-modal-backdrop">
      <form className="axis-modal" onSubmit={handleSubmit}>
        <header className="axis-modal-header">
          <div className="axis-modal-title-group">
            <h1 className="axis-modal-title">Fechar caixa</h1>
            <p className="axis-modal-subtitle">
              Informe o valor em dinheiro no caixa agora e confirme com o supervisor.
            </p>
          </div>
          <span className="axis-modal-badge">Sessão: {registerLabel}</span>
        </header>

        <section className="axis-modal-body">
          <label className="axis-label">
            Valor em dinheiro no fechamento (R$)
            <input
              className="axis-input"
              placeholder="Ex.: 250,00"
              value={closingAmount}
              onChange={(event) => setClosingAmount(event.target.value)}
              required
            />
          </label>

          <label className="axis-label">
            Supervisor (PIN ou senha{requireSupervisor ? "" : " - opcional"})
            <input
              className="axis-input"
              type="password"
              placeholder="PIN ou senha do supervisor"
              value={supervisorSecret}
              onChange={(event) => setSupervisorSecret(event.target.value)}
              minLength={requireSupervisor ? 4 : undefined}
              required={requireSupervisor}
            />
          </label>

          <label className="axis-label">
            Observações (opcional)
            <textarea
              className="axis-input"
              style={{ minHeight: "84px" }}
              placeholder="Anotações do fechamento"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          {feedback && (
            <div
              className={`axis-pos-modal-feedback ${
                feedback.type === "error"
                  ? "axis-pos-modal-feedback--error"
                  : "axis-pos-modal-feedback--success"
              }`}
            >
              {feedback.message}
            </div>
          )}
        </section>

        <footer className="axis-modal-footer">
          <button
            type="button"
            className="axis-button axis-button-secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="axis-button axis-button-primary"
            disabled={isSubmitting || !cashSessionId}
          >
            {isSubmitting ? "Fechando..." : "Fechar caixa"}
          </button>
        </footer>
      </form>
    </div>
  );
}
