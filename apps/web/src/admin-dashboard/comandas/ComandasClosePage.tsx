import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Comanda,
  fetchOpenCashSession,
  openCashSession,
  listComandas,
  getComanda,
  updateComanda,
  createSale,
  listStockLocations,
  type PaymentMethod,
} from "../../services/api";

type Feedback =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | null;

type Payment = { method: PaymentMethod; amountCents: number };

const parsePaymentAmount = (value: string): number => {
  const sanitized = value.replace(/\./g, "").replace(",", ".");
  const num = Number(sanitized);
  if (Number.isNaN(num) || num <= 0) return 0;
  return Math.round(num * 100);
};

export function ComandasClosePage() {
  const [cashSessionId, setCashSessionId] = useState<string | null>(null);
  const [openingValue, setOpeningValue] = useState("0");
  const [registerNumber, setRegisterNumber] = useState("");
  const [isOpeningCash, setIsOpeningCash] = useState(false);

  const [search, setSearch] = useState("");
  const [comanda, setComanda] = useState<Comanda | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentFeedback, setPaymentFeedback] = useState<Feedback>(null);
  const [locationId, setLocationId] = useState<string | null>(null);

  useEffect(() => {
    void checkCash();
    void loadDefaultLocation();
  }, []);

  const checkCash = async () => {
    try {
      const session = await fetchOpenCashSession();
      setCashSessionId(session?.id ?? null);
    } catch (err) {
      // feedback apenas na ação de abrir
      console.warn(err);
    }
  };

  const loadDefaultLocation = async () => {
    try {
      const locs = await listStockLocations();
      setLocationId(locs[0]?.id ?? null);
    } catch (err) {
      console.warn("Falha ao carregar locais de estoque para finalização de comanda", err);
    }
  };

  const handleOpenCash = async (evt: FormEvent) => {
    evt.preventDefault();
    setFeedback(null);
    const openingCents = Math.round(Number(openingValue.replace(",", ".")) * 100);
    if (Number.isNaN(openingCents) || openingCents < 0) {
      setFeedback({ kind: "error", message: "Informe um valor de abertura válido." });
      return;
    }
    setIsOpeningCash(true);
    try {
      const session = await openCashSession({
        openingCents,
        registerNumber: registerNumber.trim() || undefined,
      });
      setCashSessionId(session.id);
      setFeedback({ kind: "success", message: "Caixa aberto. Continue para finalizar comandas." });
    } catch (err) {
      setFeedback({
        kind: "error",
        message: err instanceof Error ? err.message : "Falha ao abrir caixa.",
      });
    } finally {
      setIsOpeningCash(false);
    }
  };

  const handleSearch = async () => {
    if (!cashSessionId) {
      setFeedback({ kind: "error", message: "Abra um caixa para finalizar comandas." });
      return;
    }
    if (!search.trim()) {
      setFeedback({ kind: "error", message: "Digite CPF, celular ou número da comanda." });
      return;
    }
    setIsSearching(true);
    setFeedback(null);
    try {
      const list = await listComandas({ q: search.trim() });
      const found = list[0] ?? null;
      if (!found) {
        setComanda(null);
        setFeedback({ kind: "error", message: "Comanda não encontrada." });
      } else {
        const detailed = await getComanda(found.id);
        setComanda(detailed);
      }
    } catch (err) {
      setFeedback({
        kind: "error",
        message: err instanceof Error ? err.message : "Falha ao buscar comanda.",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const totalItems = useMemo(() => comanda?.totalItems ?? 0, [comanda]);
  const totalValue = useMemo(() => comanda?.totalValue ?? 0, [comanda]);
  const totalCents = useMemo(() => Math.round((comanda?.totalValue ?? 0) * 100), [comanda]);
  const totalPaidCents = useMemo(
    () => payments.reduce((acc, p) => acc + p.amountCents, 0),
    [payments],
  );
  const remainingCents = Math.max(totalCents - totalPaidCents, 0);
  const changeCents = Math.max(totalPaidCents - totalCents, 0);

  const handleFinalize = async () => {
    if (!cashSessionId) {
      setFeedback({ kind: "error", message: "Abra um caixa para finalizar comandas." });
      return;
    }
    if (!comanda) {
      setFeedback({ kind: "error", message: "Busque uma comanda antes de finalizar." });
      return;
    }
    setPaymentAmount((totalCents / 100).toFixed(2));
    setShowPaymentModal(true);
  };

  const handleCancel = () => {
    setComanda(null);
    setSearch("");
    setFeedback(null);
  };

  const handleAddPayment = () => {
    setPaymentFeedback(null);
    if (!selectedPaymentMethod) {
      setPaymentFeedback({ kind: "error", message: "Escolha um método de pagamento." });
      return;
    }
    const amountCents = parsePaymentAmount(paymentAmount);
    if (!amountCents) {
      setPaymentFeedback({ kind: "error", message: "Informe um valor válido." });
      return;
    }
    if (selectedPaymentMethod !== "cash" && amountCents > remainingCents) {
      setPaymentFeedback({
        kind: "error",
        message: "Pagamentos não podem exceder o valor restante (troco só em dinheiro).",
      });
      return;
    }
    setPayments((prev) => [...prev, { method: selectedPaymentMethod, amountCents }]);
    setPaymentAmount("");
    setSelectedPaymentMethod(null);
  };

  const handleConfirmFinalize = async () => {
    if (!comanda || !cashSessionId) {
      setPaymentFeedback({ kind: "error", message: "Abra caixa e selecione comanda." });
      return;
    }
    let paymentList = payments;
    // Se não adicionou nada mas escolheu método, usar valor total
    if (!paymentList.length && selectedPaymentMethod) {
      const amountCents = totalCents;
      paymentList = [{ method: selectedPaymentMethod, amountCents }];
    }
    if (!paymentList.length) {
      setPaymentFeedback({ kind: "error", message: "Selecione um método ou adicione um pagamento." });
      return;
    }
    const totalPaid = paymentList.reduce((acc, p) => acc + p.amountCents, 0);
    if (totalPaid < totalCents) {
      setPaymentFeedback({ kind: "error", message: "Valor pago é menor que o total." });
      return;
    }
    if (!locationId) {
      setPaymentFeedback({ kind: "error", message: "Nenhum depósito definido para a venda." });
      return;
    }

    setIsFinalizing(true);
    setPaymentFeedback(null);
    try {
      const items =
        comanda.items?.map((item) => ({
          productId: item.productId,
          name: item.product?.name ?? "Produto",
          qty: Number(item.quantity),
          unitPriceCents: Math.round(Number(item.unitPrice) * 100),
        })) ?? [];

      const saleInput = {
        cashSessionId,
        locationId,
        items,
        payments: paymentList.map((p) => ({ method: p.method, amountCents: p.amountCents })),
        discount: undefined,
        fiscalMode: "none" as const,
      };

      await createSale({
        sale: saleInput,
        idempotencyKey: crypto.randomUUID(),
      });

      await updateComanda(comanda.id, { status: "ENCERRADO" });
      setFeedback({ kind: "success", message: `Comanda ${comanda.number} encerrada.` });
      setComanda(null);
      setSearch("");
      setPayments([]);
      setPaymentAmount("");
      setSelectedPaymentMethod(null);
      setShowPaymentModal(false);
    } catch (err) {
      setPaymentFeedback({
        kind: "error",
        message: err instanceof Error ? err.message : "Falha ao finalizar comanda.",
      });
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <>
    <div className="axis-panels-grid" style={{ gridTemplateColumns: "1fr" }}>
      <div className="axis-panel">
        <div className="axis-panel-header">
          <div>
            <div className="axis-panel-title">Finalizar comanda</div>
            <div className="axis-panel-subtitle">
              Abra o caixa (se necessário), busque a comanda e encerre.
            </div>
          </div>
          <div className="axis-panel-chip">
            Caixa: {cashSessionId ? "Aberto" : "Fechado"}
          </div>
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
              marginBottom: "0.6rem",
            }}
          >
            {feedback.message}
          </div>
        )}

        {!cashSessionId && (
          <form onSubmit={handleOpenCash} className="axis-form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginBottom: "0.8rem" }}>
            <label className="axis-label">
              Nº do caixa (opcional)
              <input
                className="axis-input"
                value={registerNumber}
                onChange={(e) => setRegisterNumber(e.target.value)}
                placeholder="Ex.: PDV 01"
              />
            </label>
            <label className="axis-label">
              Valor de abertura
              <input
                className="axis-input"
                value={openingValue}
                onChange={(e) => setOpeningValue(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </label>
            <div className="axis-form-actions" style={{ gridColumn: "1 / -1", justifyContent: "flex-start" }}>
              <button
                type="submit"
                className="axis-admin-button-primary"
                disabled={isOpeningCash}
              >
                {isOpeningCash ? "Abrindo..." : "Abrir caixa"}
              </button>
            </div>
          </form>
        )}

        <div className="axis-form-grid" style={{ gridTemplateColumns: "1fr auto" }}>
          <input
            className="axis-input"
            placeholder="Buscar comanda por CPF, celular ou número"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSearch();
              }
            }}
          />
          <button
            type="button"
            className="axis-button-secondary"
            onClick={() => void handleSearch()}
            disabled={isSearching}
          >
            {isSearching ? "Buscando..." : "Pesquisar"}
          </button>
        </div>

        {comanda && (
          <div style={{ marginTop: "0.8rem" }}>
          <div style={{ marginBottom: "0.4rem" }}>
            <strong>{comanda.customerName ?? "Cliente"}</strong>
            <div style={{ opacity: 0.75 }}>Comanda Nº {comanda.number}</div>
          </div>

          <div
              style={{
                border: "1px solid rgba(148,163,184,0.35)",
                borderRadius: "0.9rem",
                padding: "0.8rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ fontWeight: 600 }}>Consumo</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                {(comanda.items ?? []).map((item) => {
                  const qty = Number(item.quantity);
                  const total = Number(item.totalPrice ?? 0);
                  const dateStr = item.createdAt
                    ? new Date(item.createdAt).toLocaleString("pt-BR")
                    : "-";
                  return (
                    <div
                      key={item.id}
                      className="axis-list-item"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.3fr 0.6fr",
                        gap: "0.4rem",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <strong>{item.product?.name ?? "Produto"}</strong>
                        <span style={{ opacity: 0.75 }}>Qtd: {qty}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "right" }}>
                        <span style={{ fontWeight: 700 }}>R$ {total.toFixed(2)}</span>
                        <span style={{ opacity: 0.75, fontSize: "0.8rem" }}>{dateStr}</span>
                      </div>
                    </div>
                  );
                })}
                {(comanda.items ?? []).length === 0 && (
                  <div style={{ opacity: 0.7 }}>Nenhum item registrado.</div>
                )}
              </div>

              <div className="axis-form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div className="axis-label">
                  Total de itens:
                  <div style={{ fontWeight: 700 }}>{totalItems}</div>
                </div>
                <div className="axis-label">
                  Valor total:
                  <div style={{ fontWeight: 700 }}>R$ {totalValue.toFixed(2)}</div>
                </div>
              </div>

              <div className="axis-form-actions" style={{ gap: "0.5rem" }}>
                <button type="button" className="axis-button-secondary" onClick={handleCancel}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="axis-admin-button-primary"
                  onClick={() => void handleFinalize()}
                  disabled={isFinalizing}
                >
                  {isFinalizing ? "Finalizando..." : "Finalizar comanda"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

      {showPaymentModal && (
        <div className="axis-modal-backdrop axis-pos-price-modal">
          <div className="axis-modal axis-modal-sm axis-pos-price-card">
            <header className="axis-modal-header">
              <div className="axis-modal-title-group">
                <h1 className="axis-modal-title">Selecionar pagamento</h1>
                <p className="axis-modal-subtitle">Escolha o método para finalizar a venda</p>
              </div>
            </header>

            <section className="axis-modal-body">
              <label className="axis-label">
                Valor do pagamento
                <input
                  className="axis-input axis-pos-input-outline"
                  placeholder="Ex.: 50,00"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                />
              </label>

              <div className="axis-pos-payment-grid">
                {[
                  { id: "cash", label: "Dinheiro" },
                  { id: "debit", label: "Débito" },
                  { id: "credit", label: "Crédito" },
                  { id: "pix", label: "PIX" },
                  { id: "vr", label: "VR" },
                  { id: "va", label: "VA" },
                  { id: "store_credit", label: "Marcar conta" },
                ].map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    className={`axis-pos-payment-btn${
                      selectedPaymentMethod === method.id ? " axis-pos-payment-btn--active" : ""
                    }`}
                    onClick={() =>
                      setSelectedPaymentMethod(
                        method.id as PaymentMethod,
                      )
                    }
                  >
                    {method.label}
                  </button>
                ))}
              </div>

              <div className="axis-pos-payment-summary">
                <div>Valor da venda: R$ {(totalCents / 100).toFixed(2)}</div>
                <div>Pago: R$ {(totalPaidCents / 100).toFixed(2)}</div>
                <div>Restante: R$ {(remainingCents / 100).toFixed(2)}</div>
                {changeCents > 0 && <div>Troco: R$ {(changeCents / 100).toFixed(2)}</div>}
              </div>

              {paymentFeedback && (
                <div
                  className={`axis-pos-modal-feedback ${
                    paymentFeedback.kind === "error"
                      ? "axis-pos-modal-feedback--error"
                      : "axis-pos-modal-feedback--success"
                  }`}
                >
                  {paymentFeedback.message}
                </div>
              )}

              {payments.length > 0 && (
                <div className="axis-pos-payment-list">
                  <div className="axis-pos-payment-list-title">Pagamentos adicionados</div>
                  {payments.map((p, idx) => (
                    <div key={`${p.method}-${idx}`} className="axis-pos-payment-list-row">
                      <span>{p.method}</span>
                      <span>R$ {(p.amountCents / 100).toFixed(2)}</span>
                      <button
                        type="button"
                        className="axis-button axis-button-secondary"
                        onClick={() =>
                          setPayments((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <footer className="axis-modal-footer">
              <button
                type="button"
                className="axis-button axis-button-secondary"
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedPaymentMethod(null);
                  setPaymentFeedback(null);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="axis-button axis-button-secondary"
                onClick={handleAddPayment}
              >
                Adicionar pagamento
              </button>
              <button
                type="button"
                className="axis-button axis-button-primary axis-button-primary--nav"
                onClick={() => void handleConfirmFinalize()}
                disabled={isFinalizing}
              >
                {isFinalizing ? "Finalizando..." : "Confirmar"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

export default ComandasClosePage;
