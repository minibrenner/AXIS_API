import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { AxisSearchInput } from "../../components/elements/AxisSearchInput";
import "./axis-stock-transfer.css";
import {
  listStockLocations,
  listProducts,
  listInventory,
  stockTransfer,
  initInventoryBulk,
  type StockLocation,
  type Product,
  type InventoryItem,
} from "../../services/api";

type Feedback = { kind: "error" | "success"; message: string } | null;
type MovementMap = Record<string, number>;

const parseQty = (value: string | number | null | undefined) => {
  const n = Number(value ?? 0);
  return Number.isNaN(n) ? 0 : n;
};

const getUnitLabel = (product: Product) => {
  const typed = product as Product & { unit?: string };
  return typed.unit ?? "un";
};

export function AxisStockTransferPageContent() {
  const [stocks, setStocks] = useState<StockLocation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventories, setInventories] = useState<InventoryItem[]>([]);

  const [sourceStockId, setSourceStockId] = useState<string>("");
  const [targetStockId, setTargetStockId] = useState<string>("");

  const [searchSource, setSearchSource] = useState("");
  const [searchTarget, setSearchTarget] = useState("");
  const [movement, setMovement] = useState<MovementMap>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [deps, prods, invs] = await Promise.all([listStockLocations(), listProducts(), listInventory()]);
        setStocks(deps);
        setProducts(prods);
        setInventories(invs);
      } catch (err) {
        setFeedback({
          kind: "error",
          message: err instanceof Error ? err.message : "Falha ao carregar depositos ou produtos.",
        });
      }
    };
    void load();
  }, []);

  const productAvailability = useMemo(() => {
    const map = new Map<string, { sourceQty: number; targetQty: number }>();
    for (const inv of inventories) {
      const qty = parseQty(inv.quantity);
      if (inv.locationId === sourceStockId) {
        const current = map.get(inv.productId) ?? { sourceQty: 0, targetQty: 0 };
        current.sourceQty += qty;
        map.set(inv.productId, current);
      }
      if (inv.locationId === targetStockId) {
        const current = map.get(inv.productId) ?? { sourceQty: 0, targetQty: 0 };
        current.targetQty += qty;
        map.set(inv.productId, current);
      }
    }
    return map;
  }, [inventories, sourceStockId, targetStockId]);

  const filteredSourceProducts = useMemo(() => {
    const term = searchSource.trim().toLowerCase();
    return products
      .filter((p) => {
        const hasEntry = productAvailability.has(p.id);
        if (!hasEntry) return false;
        const matches =
          !term || p.name.toLowerCase().includes(term) || (p.sku ?? "").toLowerCase().includes(term);
        return matches;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [products, productAvailability, searchSource]);

  const filteredTargetProducts = useMemo(() => {
    const term = searchTarget.trim().toLowerCase();
    return products
      .filter((p) => {
        const matches =
          !term || p.name.toLowerCase().includes(term) || (p.sku ?? "").toLowerCase().includes(term);
        const hasMovement = movement[p.id] && movement[p.id] > 0;
        const hasDest = (productAvailability.get(p.id)?.targetQty ?? 0) > 0 || hasMovement;
        return matches && hasDest;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [products, productAvailability, movement, searchTarget]);

  const handleQtyChange = (productId: string, event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value === "") {
      setMovement((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      return;
    }
    const num = Number(value);
    if (Number.isNaN(num) || num < 0) return;
    setMovement((prev) => ({ ...prev, [productId]: num }));
  };

  const handleCancel = () => {
    setMovement({});
    setFeedback(null);
  };

  const handleConfirm = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!sourceStockId || !targetStockId) {
      setFeedback({ kind: "error", message: "Selecione deposito de saida e destino." });
      return;
    }
    if (sourceStockId === targetStockId) {
      setFeedback({ kind: "error", message: "Deposito de saida e destino devem ser diferentes." });
      return;
    }
    const items = Object.entries(movement)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => ({ productId, qty }));

    if (!items.length) {
      setFeedback({ kind: "error", message: "Informe ao menos um produto com quantidade maior que zero." });
      return;
    }

    const negativeItems = items
      .map((item) => {
        const available = productAvailability.get(item.productId)?.sourceQty ?? 0;
        const product = products.find((p) => p.id === item.productId);
        return { ...item, available, productName: product?.name ?? item.productId };
      })
      .filter((item) => item.qty > item.available);

    if (negativeItems.length > 0) {
      const names = negativeItems.map((it) => `${it.productName} (disp.: ${it.available}, transf.: ${it.qty})`).join("\n");
      const ok = window.confirm(
        `Produtos ficarao negativados no deposito de saida:\n${names}\n\nDeseja continuar mesmo assim?`,
      );
      if (!ok) return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const missingDest = items
        .filter(
          (item) => !inventories.some((inv) => inv.locationId === targetStockId && inv.productId === item.productId),
        )
        .map((item) => ({ productId: item.productId, locationId: targetStockId }));

      if (missingDest.length) {
        await initInventoryBulk(missingDest);
      }

      for (const item of items) {
        await stockTransfer({
          productId: item.productId,
          fromLocationId: sourceStockId,
          toLocationId: targetStockId,
          qty: item.qty,
          reason: "Transferencia entre depositos (painel)",
        });
      }
      const invs = await listInventory();
      setInventories(invs);
      setMovement({});
      setFeedback({ kind: "success", message: "Transferencia concluida." });
    } catch (err) {
      setFeedback({
        kind: "error",
        message: err instanceof Error ? err.message : "Falha ao transferir produtos.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="axis-transfer-root">
      <header className="axis-transfer-header">
        <div className="axis-transfer-title-block">
          <div className="axis-transfer-title">Movimentacao entre estoques</div>
          <div className="axis-transfer-subtitle">
            Selecione o deposito de saida e o deposito de destino, defina as quantidades e confirme a transferencia.
          </div>
        </div>
        <div className="axis-transfer-badge">ESTOQUE • TRANSFERENCIA</div>
      </header>

      <form onSubmit={handleConfirm}>
        <section className="axis-transfer-layout">
          <div className="axis-transfer-panel">
            <div className="axis-transfer-panel-header">
              <div className="axis-transfer-panel-title">Deposito de saida</div>
              <label className="axis-label">
                Selecione o deposito
                <select
                  className="axis-select"
                  value={sourceStockId}
                  onChange={(e) => setSourceStockId(e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="">Selecione...</option>
                  {stocks.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="axis-label">
                Pesquisa de produto
                <AxisSearchInput
                  value={searchSource}
                  onChange={setSearchSource}
                  placeholder="Buscar por nome, SKU ou codigo de barras..."
                />
              </label>
            </div>

            <div className="axis-transfer-list">
              <div className="axis-transfer-list-header">
                <span>Produto</span>
                <span>Qtd. a enviar</span>
              </div>
              <div className="axis-transfer-list-body">
                {filteredSourceProducts.length === 0 ? (
                  <div className="axis-transfer-empty">Nenhum produto encontrado neste deposito.</div>
                ) : (
                  filteredSourceProducts.map((p) => {
                    const available = productAvailability.get(p.id)?.sourceQty ?? 0;
                    return (
                      <div key={p.id} className="axis-transfer-row">
                        <div>
                          <div className="axis-transfer-product-name">{p.name}</div>
                          <div className="axis-transfer-product-meta">
                            {p.sku ? `SKU: ${p.sku} • ` : ""}
                            Disponivel: {available} {getUnitLabel(p)}
                          </div>
                        </div>
                        <input
                          className="axis-transfer-qty-input"
                          type="number"
                          min={0}
                          placeholder="0"
                          value={movement[p.id] ?? ""}
                          onChange={(ev) => handleQtyChange(p.id, ev)}
                          disabled={isSubmitting}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="axis-transfer-middle">
            <span>⇄</span>
          </div>

          <div className="axis-transfer-panel">
            <div className="axis-transfer-panel-header">
              <div className="axis-transfer-panel-title">Deposito de destino</div>
              <label className="axis-label">
                Selecione o deposito
                <select
                  className="axis-select"
                  value={targetStockId}
                  onChange={(e) => setTargetStockId(e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="">Selecione...</option>
                  {stocks.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="axis-label">
                Pesquisa de produto
                <AxisSearchInput
                  value={searchTarget}
                  onChange={setSearchTarget}
                  placeholder="Buscar dentro deste deposito..."
                />
              </label>
            </div>

            <div className="axis-transfer-list">
              <div className="axis-transfer-list-header">
                <span>Produto</span>
                <span>Qtd. recebendo</span>
              </div>
              <div className="axis-transfer-list-body">
                {filteredTargetProducts.length === 0 ? (
                  <div className="axis-transfer-empty">Nenhum produto encontrado neste deposito.</div>
                ) : (
                  filteredTargetProducts.map((p) => {
                    const movementQty = Number(movement[p.id] ?? 0) || 0;
                    const currentDest = productAvailability.get(p.id)?.targetQty ?? 0;
                    const after = currentDest + movementQty;
                    const isZero = movementQty <= 0;
                    return (
                      <div key={p.id} className="axis-transfer-row">
                        <div>
                          <div className="axis-transfer-product-name">{p.name}</div>
                          <div className="axis-transfer-product-meta">
                            Estoque atual: {currentDest} {getUnitLabel(p)} • Apos: {after} {getUnitLabel(p)}
                          </div>
                        </div>
                        <div
                          className={
                            "axis-transfer-qty-pill" + (isZero ? " axis-transfer-qty-pill--empty" : "")
                          }
                        >
                          {movementQty} {getUnitLabel(p)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        <footer className="axis-transfer-footer">
          <button type="button" className="axis-admin-button-secondary" onClick={handleCancel} disabled={isSubmitting}>
            Cancelar
          </button>
          <button type="submit" className="axis-admin-button-primary" disabled={isSubmitting}>
            {isSubmitting ? "Transferindo..." : "Confirmar transferencia"}
          </button>
        </footer>
      </form>

      {feedback && (
        <p className={`axis-feedback ${feedback.kind === "error" ? "axis-error" : "axis-success"}`}>
          {feedback.message}
        </p>
      )}
    </div>
  );
}

export default AxisStockTransferPageContent;
