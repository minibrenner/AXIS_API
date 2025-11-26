import { FormEvent, useState } from "react";

import "./axis-pos.css";

type AxisPosOpenCashModalProps = {
  userName: string;
  dateTime: string;
  isOpen: boolean;
  isSubmitting?: boolean;
  feedback?: { type: "error" | "success"; message: string } | null;
  onCancel?: () => void;
  onConfirm?: (payload: {
    userName: string;
    dateTime: string;
    cashNumber: string;
    openingAmount: string;
  }) => void;
};

export function AxisPosOpenCashModal({
  isOpen,
  onCancel,
  onConfirm,
  userName,
  dateTime,
  isSubmitting = false,
  feedback = null,
}: AxisPosOpenCashModalProps) {
  const [cashNumber, setCashNumber] = useState("");
  const [openingAmount, setOpeningAmount] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (onConfirm) {
      onConfirm({
        userName,
        dateTime,
        cashNumber,
        openingAmount,
      });
    }
  };

  return (
    <div className="axis-modal-backdrop">
      <form className="axis-modal" onSubmit={handleSubmit}>
        <header className="axis-modal-header">
          <div className="axis-modal-title-group">
            <h1 className="axis-modal-title">Abrir caixa</h1>
            <p className="axis-modal-subtitle">
              Preencha as informações abaixo para iniciar o caixa. Todos os
              campos são obrigatórios.
            </p>
          </div>
          <span className="axis-modal-badge">PREENCHIMENTO OBRIGATÓRIO</span>
        </header>

        <section className="axis-modal-body">
          <label className="axis-label">
            Nome do usuário
            <input
              className="axis-input"
              placeholder="Ex.: Ana Paula - Caixa 01"
              value={userName}
              readOnly
              disabled
            />
          </label>

          <div className="axis-modal-row">
            <label className="axis-label">
              Data e hora
              <input
                className="axis-input"
                type="datetime-local"
                value={dateTime}
                readOnly
                disabled
              />
            </label>

            <label className="axis-label">
              Número do caixa
              <input
                className="axis-input"
                placeholder="Ex.: 01"
                value={cashNumber}
                onChange={(event) => setCashNumber(event.target.value)}
                required
              />
            </label>
          </div>

          <label className="axis-label">
            Valor em dinheiro na abertura (R$)
            <input
              className="axis-input"
              placeholder="Ex.: 150,00"
              value={openingAmount}
              onChange={(event) => setOpeningAmount(event.target.value)}
              required
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
            disabled={isSubmitting}
          >
            {isSubmitting ? "Abrindo caixa..." : "Abrir caixa"}
          </button>
        </footer>
      </form>
    </div>
  );
}
