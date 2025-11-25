import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { AxisSearchInput } from "../../components/elements/AxisSearchInput";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import {
  adjustStock,
  deleteInventoryItem,
  listCategories,
  listInventory,
  initInventoryBulk,
  listProducts,
  listStockLocations,
  type Category,
  type InventoryItem,
  type Product,
  type StockLocation,
} from "../../services/api";

type Feedback = { kind: "error" | "success"; message: string } | null;
type QuantitiesMap = Record<string, number>;

type BalanceRow = {
  productId: string;
  productName: string;
  sku?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  totalQuantity: number;
};

const PAGE_SIZE = 10;

const parseQty = (value: string | number | null | undefined) => {
  const n = Number(value ?? 0);
  return Number.isNaN(n) ? 0 : n;
};

export function AxisStockBalancesPageContent() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [activeDepositId, setActiveDepositId] = useState<string>("all");

  const [deposits, setDeposits] = useState<StockLocation[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventories, setInventories] = useState<InventoryItem[]>([]);

  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pendingQuantities, setPendingQuantities] = useState<QuantitiesMap>({});
  const [isSavingChanges, setIsSavingChanges] = useState(false);

  // Modal: adicionar produtos
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [addDepositId, setAddDepositId] = useState<string>("");
  const [addSearch, setAddSearch] = useState("");
  const [addCategoryId, setAddCategoryId] = useState<string>("all");
  const [addQuantities, setAddQuantities] = useState<QuantitiesMap>({});
  const [isLoadingAddProducts, setIsLoadingAddProducts] = useState(false);

  const [page, setPage] = useState(1);

  useEffect(() => {
    const loadBase = async () => {
      try {
        setIsLoadingBalances(true);
        const [deps, cats, prods, invs] = await Promise.all([
          listStockLocations(),
          listCategories(),
          listProducts(),
          listInventory(),
        ]);
        setDeposits(deps);
        setCategories(cats);
        setProducts(prods);
        setInventories(invs);
      } catch (err) {
        setFeedback({
          kind: "error",
          message: err instanceof Error ? err.message : "Falha ao carregar saldos de estoque.",
        });
      } finally {
        setIsLoadingBalances(false);
      }
    };
    void loadBase();
  }, []);

  useEffect(() => {
    setPendingQuantities({});
  }, [activeDepositId]);

  const getInventoryQtyForDeposit = (productId: string) => {
    if (activeDepositId === "all") return 0;
    const inv = inventories.find((i) => i.locationId === activeDepositId && i.productId === productId);
    return parseQty(inv?.quantity);
  };

  const balances = useMemo(() => {
    const term = search.trim().toLowerCase();
    const depositFilter = activeDepositId === "all" ? null : activeDepositId;
    const categoryFilter = categoryId === "all" ? null : categoryId;

    const map = new Map<string, BalanceRow>();

    for (const inv of inventories) {
      if (depositFilter && inv.locationId !== depositFilter) continue;
      const qty = parseQty(inv.quantity);

      const product = products.find((p) => p.id === inv.productId);
      const prodName = product?.name ?? inv.productId;
      const prodSku = product?.sku ?? null;
      const prodCatId = product?.categoryId ?? null;
      const prodCatName = categories.find((c) => c.id === prodCatId)?.name ?? null;

      if (categoryFilter && prodCatId !== categoryFilter) continue;

      const matchesSearch =
        !term ||
        prodName.toLowerCase().includes(term) ||
        (prodSku && prodSku.toLowerCase().includes(term));
      if (!matchesSearch) continue;

      const existing = map.get(inv.productId);
      if (existing) {
        existing.totalQuantity += qty;
      } else {
        map.set(inv.productId, {
          productId: inv.productId,
          productName: prodName,
          sku: prodSku,
          categoryId: prodCatId ?? undefined,
          categoryName: prodCatName ?? undefined,
          totalQuantity: qty,
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => a.totalQuantity - b.totalQuantity || a.productName.localeCompare(b.productName, "pt-BR"),
    );
  }, [inventories, products, categories, search, categoryId, activeDepositId]);

  const totalPages = useMemo(() => {
    if (balances.length === 0) return 1;
    return Math.max(1, Math.ceil(balances.length / PAGE_SIZE));
  }, [balances.length]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryId, activeDepositId]);

  const pagedBalances = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return balances.slice(start, start + PAGE_SIZE);
  }, [balances, page]);

  const handleChangePage = (direction: "prev" | "next") => {
    if (direction === "prev" && page > 1) {
      setPage((prev) => Math.max(1, prev - 1));
    }
    if (direction === "next" && page < totalPages) {
      setPage((prev) => Math.min(totalPages, prev + 1));
    }
  };

  // Modal add products
  const openAddModal = () => {
    setIsAddModalOpen(true);
    setAddDepositId(activeDepositId === "all" ? "" : activeDepositId);
    setAddSearch("");
    setAddCategoryId("all");
    setAddQuantities({});
    setFeedback(null);

    setIsLoadingAddProducts(true);
    void listProducts()
      .then(setProducts)
      .finally(() => setIsLoadingAddProducts(false));
  };

  const closeAddModal = () => {
    if (isSubmittingAdd) return;
    setIsAddModalOpen(false);
  };

  const handleAddQuantityChange = (productId: string, event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(",", ".");
    const numeric = Number(value);
    setAddQuantities((prev) => {
      const next = { ...prev };
      if (!value || Number.isNaN(numeric) || numeric <= 0) {
        delete next[productId];
      } else {
        next[productId] = numeric;
      }
      return next;
    });
  };

  const filteredAddProducts = useMemo(() => {
    const term = addSearch.trim().toLowerCase();
    return products
      .filter((prod) => {
        const matchesSearch =
          !term ||
          prod.name.toLowerCase().includes(term) ||
          (prod.sku && prod.sku.toLowerCase().includes(term));
        const matchesCat = addCategoryId === "all" || prod.categoryId === addCategoryId;
        return matchesSearch && matchesCat;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [products, addSearch, addCategoryId]);

  const addSelectedItems = useMemo(() => {
    return Object.entries(addQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const product = products.find((p) => p.id === productId);
        return product ? { product, quantity: qty } : null;
      })
      .filter(Boolean) as { product: Product; quantity: number }[];
  }, [addQuantities, products]);

  const hasAnyAddItem = addSelectedItems.length > 0;

  const handleSubmitAddProducts = async (event: FormEvent) => {
    event.preventDefault();
    if (!addDepositId) {
      setFeedback({ kind: "error", message: "Selecione um deposito para adicionar produtos." });
      return;
    }
    if (!hasAnyAddItem) {
      setFeedback({ kind: "error", message: "Informe ao menos um produto com quantidade maior que zero." });
      return;
    }

    setIsSubmittingAdd(true);
    setFeedback(null);
    try {
      const missingInventory = addSelectedItems
        .filter((item) => !inventories.some((inv) => inv.locationId === addDepositId && inv.productId === item.product.id))
        .map((item) => ({ productId: item.product.id, locationId: addDepositId }));

      if (missingInventory.length) {
        await initInventoryBulk(missingInventory);
      }

      await Promise.all(
        addSelectedItems.map((item) =>
          adjustStock({
            productId: item.product.id,
            locationId: addDepositId,
            qty: item.quantity,
            reason: "Entrada manual de estoque",
          }),
        ),
      );
      const invs = await listInventory();
      setInventories(invs);
      setIsAddModalOpen(false);
      setFeedback({
        kind: "success",
        message: "Produtos adicionados ao deposito.",
      });
    } catch (err) {
      setFeedback({
        kind: "error",
        message: err instanceof Error ? err.message : "Falha ao adicionar produtos no estoque.",
      });
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const handleRowQuantityChange = (productId: string, value: string) => {
    if (activeDepositId === "all") return;
    const numeric = Number(value.replace(",", "."));
    setPendingQuantities((prev) => {
      const next = { ...prev };
      if (Number.isNaN(numeric) || numeric < 0) {
        delete next[productId];
      } else {
        next[productId] = numeric;
      }
      return next;
    });
  };

  const handleDeleteFromDeposit = async (productId: string) => {
    if (activeDepositId === "all") return;
    const currentQty = getInventoryQtyForDeposit(productId);
    const ok = window.confirm("Remover este produto do deposito? O saldo neste deposito sera zerado e o produto deixara de aparecer neste deposito.");
    if (!ok) return;

    setIsSavingChanges(true);
    setFeedback(null);
    try {
      if (currentQty !== 0) {
        await adjustStock({
          productId,
          locationId: activeDepositId,
          qty: -currentQty,
          reason: "Remocao de produto do deposito (saldos)",
        });
      }

      await deleteInventoryItem(productId, activeDepositId);
      const invs = await listInventory();
      setInventories(invs);
      setPendingQuantities((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      setFeedback({ kind: "success", message: "Produto removido do deposito." });
    } catch (err) {
      setFeedback({
        kind: "error",
        message: err instanceof Error ? err.message : "Falha ao remover produto do deposito.",
      });
    } finally {
      setIsSavingChanges(false);
    }
  };

  const hasPendingChanges = useMemo(() => Object.keys(pendingQuantities).length > 0, [pendingQuantities]);

  const handleSaveChanges = async () => {
    if (activeDepositId === "all" || !hasPendingChanges) return;
    setIsSavingChanges(true);
    setFeedback(null);

    try {
      const updates = Object.entries(pendingQuantities).map(async ([productId, newQty]) => {
        const currentQty = getInventoryQtyForDeposit(productId);
        const delta = newQty - currentQty;
        if (delta === 0) return;
        await adjustStock({
          productId,
          locationId: activeDepositId,
          qty: delta,
          reason: "Ajuste manual de saldo (saldos)",
        });
      });

      await Promise.all(updates);
      const invs = await listInventory();
      setInventories(invs);
      setPendingQuantities({});
      setFeedback({ kind: "success", message: "Saldos atualizados com sucesso." });
    } catch (err) {
      setFeedback({
        kind: "error",
        message: err instanceof Error ? err.message : "Falha ao salvar ajustes de saldo.",
      });
    } finally {
      setIsSavingChanges(false);
    }
  };

  return (
    <>
      <div className="axis-categories-header">
        <div className="axis-categories-title-block">
          <div className="axis-categories-title">Saldos</div>
          <div className="axis-categories-subtitle">
            Visualize e filtre os saldos por produto, somando todos os depositos ou um deposito especifico.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: "280px" }}>
          <div className="axis-search-bar">
            <AxisSearchInput value={search} onChange={setSearch} placeholder="Buscar por nome ou SKU..." />
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
            <select className="axis-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="all">Todas categorias</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <select className="axis-select" value={activeDepositId} onChange={(e) => setActiveDepositId(e.target.value)}>
              <option value="all">Todos os depositos</option>
              {deposits.map((dep) => (
                <option key={dep.id} value={dep.id}>
                  {dep.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <section className="axis-products-list">
        <div className="axis-products-list-header">
          <span>Produto | </span>
          <span>Categoria | </span>
          <span>SKU | </span>
          <span>Saldo total</span>
        </div>

        <div className="axis-products-list-body">
          {isLoadingBalances ? (
            <div className="axis-products-empty">Carregando saldos...</div>
          ) : pagedBalances.length === 0 ? (
            <div className="axis-products-empty">Nenhum produto encontrado para os filtros.</div>
          ) : (
            pagedBalances.map((item) => {
              const isLow = item.totalQuantity <= 20;
              const rowQty =
                activeDepositId === "all"
                  ? item.totalQuantity
                  : pendingQuantities[item.productId] ?? item.totalQuantity;
              return (
                <article key={item.productId} className="axis-prodcard-row">
                  <div className="axis-prodcard">
                    <div className="axis-prodcard-info">
                      <div className="axis-prodcard-name">{item.productName}</div>
                      <div className="axis-prodcard-price">
                        {activeDepositId === "all" ? "Soma de todos os depositos" : "Saldo neste deposito"}
                      </div>
                    </div>

                    <div className="axis-prodcard-category">
                      <div className="axis-prodcard-category-label">Categoria:</div>
                      <div className="axis-prodcard-category-value">{item.categoryName ?? "-"}</div>
                    </div>

                    <div className="axis-prodcard-category">
                      <div className="axis-prodcard-category-label">SKU:</div>
                      <div className="axis-prodcard-category-value">{item.sku ?? "—"}</div>
                    </div>

                    <div className="axis-prodcard-toggle" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {activeDepositId === "all" ? (
                        <div
                          className={
                            isLow
                              ? "axis-row-qty axis-row-badge axis-row-badge--low"
                              : "axis-row-qty axis-row-badge"
                          }
                        >
                          {rowQty} un
                        </div>
                      ) : (
                        <>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={rowQty}
                            onChange={(ev) => handleRowQuantityChange(item.productId, ev.target.value)}
                            className="axis-input"
                            style={{ width: "96px" }}
                            disabled={isSavingChanges}
                          />
                          <button
                            type="button"
                            className="axis-admin-button-secondary"
                            style={{ minWidth: 0, padding: "0.2rem 0.6rem" }}
                            title="Remover produto deste deposito"
                            disabled={isSavingChanges}
                            onClick={() => void handleDeleteFromDeposit(item.productId)}
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={2}
          sx={{ padding: "0.5rem 0" }}
          className="axis-pagination"
        >
          <div>
            {balances.length > 0
              ? `Mostrando ${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, balances.length)} de ${balances.length} produtos.`
              : "Nenhum item para exibir."}
          </div>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, value) => setPage(value)}
            variant="outlined"
            color="primary"
            siblingCount={1}
            boundaryCount={1}
            disabled={isLoadingBalances}
          />
        </Stack>
      </section>

      <div className="axis-footer-actions">
        <button type="button" className="axis-admin-button-primary" onClick={openAddModal}>
          Adicionar produtos
        </button>
        <button
          type="button"
          className="axis-admin-button-secondary"
          onClick={handleSaveChanges}
          disabled={activeDepositId === "all" || !hasPendingChanges || isSavingChanges}
        >
          {isSavingChanges ? "Salvando..." : "Salvar alteracoes"}
        </button>
      </div>

      {feedback && (
        <p className={`axis-feedback ${feedback.kind === "error" ? "axis-error" : "axis-success"}`}>{feedback.message}</p>
      )}

      {isAddModalOpen && (
        <div className="axis-modal-backdrop">
          <div className="axis-modal">
            <div className="axis-modal-header">
              <div className="axis-modal-title">Adicionar produtos</div>
              <button type="button" className="axis-modal-close" onClick={closeAddModal} disabled={isSubmittingAdd}>
                x
              </button>
            </div>

            <form onSubmit={handleSubmitAddProducts}>
              <label className="axis-label">
                Deposito
                <select
                  className="axis-select"
                  value={addDepositId}
                  onChange={(e) => setAddDepositId(e.target.value)}
                  disabled={isSubmittingAdd}
                >
                  <option value="">Selecione o deposito…</option>
                  {deposits.map((dep) => (
                    <option key={dep.id} value={dep.id}>
                      {dep.name}
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)", gap: "0.75rem", marginTop: "0.5rem" }}>
                <div className="axis-panel">
                  <div className="axis-panel-header">
                    <div>
                      <div className="axis-panel-title">Produtos disponiveis</div>
                      <div className="axis-panel-subtitle">Selecione e informe as quantidades de entrada.</div>
                    </div>
                  </div>

                  <div className="axis-modal-row">
                    <div className="axis-search-bar" style={{ flex: "1 1 180px" }}>
                      <AxisSearchInput
                        value={addSearch}
                        onChange={setAddSearch}
                        placeholder="Buscar produto por nome ou SKU..."
                      />
                    </div>
                    <select
                      className="axis-select"
                      value={addCategoryId}
                      onChange={(e) => setAddCategoryId(e.target.value)}
                      disabled={isSubmittingAdd || isLoadingAddProducts}
                    >
                      <option value="all">Todas categorias</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isLoadingAddProducts ? (
                    <p className="axis-category-empty">Carregando produtos...</p>
                  ) : filteredAddProducts.length === 0 ? (
                    <p className="axis-category-empty">Nenhum produto encontrado.</p>
                  ) : (
                    <div className="axis-products-list-body">
                      {filteredAddProducts.map((product) => {
                        const qty = addQuantities[product.id] ?? 0;
                        const category = categories.find((c) => c.id === product.categoryId);
                        return (
                          <div
                            key={product.id}
                            className="axis-prodcard"
                            style={{
                              alignItems: "center",
                              padding: "0.65rem 0.75rem",
                              gap: "0.75rem",
                            }}
                          >
                            <div className="axis-prodcard-info" style={{ flex: "1 1 auto" }}>
                              <div className="axis-prodcard-name">{product.name}</div>
                              <div style={{ fontSize: "0.85rem", opacity: 0.9, marginTop: "0.2rem" }}>
                                <div>Categoria: {category?.name ?? "-"}</div>
                                {product.sku ? <div style={{ fontSize: "0.8rem", opacity: 0.8 }}>SKU: {product.sku}</div> : null}
                              </div>
                            </div>
                            <div className="axis-prodcard-toggle" style={{ minWidth: "96px" }}>
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={qty === 0 ? "" : qty}
                                onChange={(ev) => handleAddQuantityChange(product.id, ev)}
                                disabled={isSubmittingAdd}
                                className="axis-input"
                                style={{ width: "96px" }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="axis-panel">
                  <div className="axis-panel-header">
                    <div>
                      <div className="axis-panel-title">Produtos selecionados</div>
                      <div className="axis-panel-subtitle">Revise as quantidades antes de concluir.</div>
                    </div>
                  </div>

                  {hasAnyAddItem ? (
                    <ul className="axis-list">
                      {addSelectedItems.map(({ product, quantity }) => (
                        <li key={product.id} className="axis-list-item">
                          <span>{product.name}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={quantity}
                              onChange={(ev) => handleAddQuantityChange(product.id, ev)}
                              disabled={isSubmittingAdd}
                              className="axis-input"
                              style={{ width: "90px" }}
                            />
                            <span className="axis-badge-soft">IN</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="axis-footer-note">Nenhum produto selecionado.</p>
                  )}
                </div>
              </div>

              <div className="axis-form-actions">
                <button type="button" className="axis-admin-button-secondary" onClick={closeAddModal} disabled={isSubmittingAdd}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="axis-admin-button-primary"
                  disabled={isSubmittingAdd || !addDepositId || !hasAnyAddItem}
                >
                  {isSubmittingAdd ? "Concluindo..." : "Concluir entrada"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default AxisStockBalancesPageContent;
