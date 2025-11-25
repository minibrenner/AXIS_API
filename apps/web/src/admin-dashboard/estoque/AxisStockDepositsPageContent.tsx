import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { AxisSearchInput } from "../../components/elements/AxisSearchInput";
import {
  adjustStock,
  createStockLocation,
  deleteStockLocation,
  initInventoryBulk,
  listCategories,
  listInventory,
  listProducts,
  listStockLocations,
  updateStockLocation,
  type Category,
  type InventoryItem,
  type Product,
  type StockLocation,
} from "../../services/api";

type Feedback = { kind: "error" | "success"; message: string } | null;
type Mode = "create" | "edit";
type QuantitiesMap = Record<string, number>;
type ExistingItem = { productId: string; productName: string; quantity: number; sku?: string | null };
type SelectedItem = { product: Product; quantity: number };

const INITIAL_REASON = "Estoque inicial do deposito";
const REMOVE_REASON = "Remocao de produto do deposito";
const DELETE_REASON = "Exclusao do deposito";

const mapExistingItems = (inventory: InventoryItem[], products: Product[], locationId: string): ExistingItem[] =>
  inventory
    .filter((inv) => inv.locationId === locationId && Number(inv.quantity ?? 0) > 0)
    .map((inv) => {
      const product = products.find((p) => p.id === inv.productId);
      return {
        productId: inv.productId,
        productName: product?.name ?? inv.productId,
        sku: product?.sku,
        quantity: Number(inv.quantity ?? 0) || 0,
      };
    })
    .sort((a, b) => a.productName.localeCompare(b.productName, "pt-BR"));

export function AxisStockDepositsPageContent() {
  const [deposits, setDeposits] = useState<StockLocation[]>([]);
  const [inventories, setInventories] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [centerMessage, setCenterMessage] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<Mode>("create");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingDeposit, setEditingDeposit] = useState<StockLocation | null>(null);

  const [name, setName] = useState("");
  const [isSaleSource, setIsSaleSource] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productsSearch, setProductsSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [quantities, setQuantities] = useState<QuantitiesMap>({});
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [existingItems, setExistingItems] = useState<ExistingItem[]>([]);
  const [removingProductId, setRemovingProductId] = useState<string | null>(null);
  const [togglingSaleSourceId, setTogglingSaleSourceId] = useState<string | null>(null);

  const loadDeposits = async () => {
    try {
      setIsLoading(true);
      const [items, invs] = await Promise.all([listStockLocations(), listInventory()]);
      setDeposits(items);
      setInventories(invs);
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha ao carregar depositos.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDeposits();
  }, []);

  const filteredDeposits = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return deposits;
    return deposits.filter((dep) => dep.name.toLowerCase().includes(term));
  }, [deposits, search]);

  const getTotals = (locationId: string) => {
    const items = inventories.filter((it) => it.locationId === locationId);
    const totalSkus = items.length;
    const totalQuantity = items.reduce((acc, it) => acc + Number(it.quantity ?? 0), 0);
    return { totalSkus, totalQuantity };
  };

  const resetForm = () => {
    setName("");
    setIsSaleSource(false);
    setIsSubmitting(false);
    setEditingDeposit(null);
    setExistingItems([]);
    setRemovingProductId(null);
    setProducts([]);
    setCategories([]);
    setProductsSearch("");
    setSelectedCategoryId("all");
    setQuantities({});
    setIsLoadingProducts(false);
  };

  const openCreateModal = () => {
    setModalMode("create");
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (dep: StockLocation) => {
    resetForm();
    setModalMode("edit");
    setEditingDeposit(dep);
    setName(dep.name);
    setIsSaleSource(dep.isSaleSource);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  useEffect(() => {
    if (!modalOpen) return;
    const loadProductsAndCategories = async () => {
      try {
        setIsLoadingProducts(true);
        const [prods, cats, invs] = await Promise.all([listProducts(), listCategories(), listInventory()]);
        setProducts(prods);
        setCategories(cats);
        setInventories(invs);

        if (modalMode === "edit" && editingDeposit) {
          setExistingItems(mapExistingItems(invs, prods, editingDeposit.id));
        }
      } catch (error) {
        setFeedback({
          kind: "error",
          message: error instanceof Error ? error.message : "Falha ao carregar produtos ou categorias.",
        });
      } finally {
        setIsLoadingProducts(false);
      }
    };
    void loadProductsAndCategories();
  }, [modalOpen, modalMode, editingDeposit]);

  const filteredProducts = useMemo(() => {
    const term = productsSearch.trim().toLowerCase();
    const filtered = products.filter((prod) => {
      const sku = prod.sku?.toLowerCase() ?? "";
      const barcode = prod.barcode?.toLowerCase() ?? "";
      const matchesSearch =
        !term ||
        prod.name.toLowerCase().includes(term) ||
        (sku && sku.includes(term)) ||
        (barcode && barcode.includes(term));
      const matchesCategory = selectedCategoryId === "all" || prod.categoryId === selectedCategoryId;
      return matchesSearch && matchesCategory;
    });
    return filtered.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [products, productsSearch, selectedCategoryId]);

  const handleQuantityChange = (productId: string, event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(",", ".");
    const numeric = Number(value);

    setQuantities((prev) => {
      const next: QuantitiesMap = { ...prev };
      if (!value || Number.isNaN(numeric) || numeric <= 0) {
        delete next[productId];
      } else {
        next[productId] = numeric;
      }
      return next;
    });
  };

  const selectedItems = useMemo(() => {
    const entries = Object.entries(quantities).filter(([, qty]) => qty > 0);
    return entries
      .map(([productId, qty]) => {
        const product = products.find((p) => p.id === productId);
        if (!product) return null;
        return { product, quantity: qty };
      })
      .filter(Boolean) as SelectedItem[];
  }, [quantities, products]);

  const hasAnyItem = selectedItems.length > 0;

  const applyInitialQuantities = async (locationId: string, items: SelectedItem[]) => {
    const adjustments = items
      .filter((item) => item.quantity > 0)
      .map((item) =>
        adjustStock({
          productId: item.product.id,
          locationId,
          qty: item.quantity,
          reason: INITIAL_REASON,
        }),
      );

    if (adjustments.length) {
      await Promise.all(adjustments);
    }
  };

  const handleRemoveExistingItem = async (item: ExistingItem) => {
    if (!editingDeposit) return;
    const quantity = Number(item.quantity ?? 0);
    const confirmRemove = window.confirm(
      `Remover o produto "${item.productName}" deste deposito? O estoque sera zerado aqui.`,
    );
    if (!confirmRemove) return;

    setRemovingProductId(item.productId);
    setFeedback(null);

    try {
      await adjustStock({
        productId: item.productId,
        locationId: editingDeposit.id,
        qty: -quantity,
        reason: REMOVE_REASON,
      });

      setExistingItems((prev) => prev.filter((it) => it.productId !== item.productId));
      const refreshedInventory = await listInventory();
      setInventories(refreshedInventory);

      setFeedback({
        kind: "success",
        message: "Produto removido do deposito e estoque debitado.",
      });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha ao remover produto do deposito.",
      });
    } finally {
      setRemovingProductId(null);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFeedback({ kind: "error", message: "Informe o nome do deposito." });
      return;
    }
    if (modalMode === "create" && !hasAnyItem) {
      setFeedback({
        kind: "error",
        message: "Adicione pelo menos um produto com quantidade inicial maior que zero.",
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      if (modalMode === "create") {
        const created = await createStockLocation({ name: trimmedName, isSaleSource });
        const items = selectedItems.map((item) => ({
          productId: item.product.id,
          locationId: created.id,
        }));

        if (items.length) {
          await initInventoryBulk(items);
          await applyInitialQuantities(created.id, selectedItems);
        }

        setFeedback({
          kind: "success",
          message: "Deposito criado e estoque inicial configurado.",
        });
      } else if (editingDeposit) {
        const updated = await updateStockLocation(editingDeposit.id, {
          name: trimmedName,
          isSaleSource,
        });

        const newItems = selectedItems.map((item) => ({
          productId: item.product.id,
          locationId: editingDeposit.id,
        }));

        if (newItems.length) {
          await initInventoryBulk(newItems);
          await applyInitialQuantities(editingDeposit.id, selectedItems);
        }

        setFeedback({ kind: "success", message: "Deposito atualizado." });
        setDeposits((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      }

      closeModal();
      await loadDeposits();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha ao salvar deposito.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleSaleSource = async (dep: StockLocation) => {
    if (togglingSaleSourceId) return;
    setTogglingSaleSourceId(dep.id);
    try {
      const updated = await updateStockLocation(dep.id, {
        name: dep.name,
        isSaleSource: !dep.isSaleSource,
      });
      setDeposits((prev) => prev.map((d) => (d.id === dep.id ? updated : d)));
      setFeedback({
        kind: "success",
        message: updated.isSaleSource
          ? "Deposito marcado para debitar vendas."
          : "Deposito removido como fonte de vendas.",
      });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha ao atualizar deposito.",
      });
    } finally {
      setTogglingSaleSourceId(null);
    }
  };

  const handleDelete = async (dep: StockLocation) => {
    const confirmDelete = window.confirm(
      `Deseja remover o deposito "${dep.name}"? O estoque deste deposito sera debitado.`,
    );
    if (!confirmDelete) return;

    setIsLoading(true);
    setFeedback(null);

    try {
      const itemsFromLocation = inventories.filter((inv) => inv.locationId === dep.id);

      if (itemsFromLocation.length) {
        await Promise.all(
          itemsFromLocation
            .filter((inv) => Number(inv.quantity ?? 0) !== 0)
            .map((inv) =>
              adjustStock({
                productId: inv.productId,
                locationId: dep.id,
                qty: -Number(inv.quantity ?? 0),
                reason: DELETE_REASON,
              }),
            ),
        );
      }

      await deleteStockLocation(dep.id);
      setDeposits((prev) => prev.filter((d) => d.id !== dep.id));
      setInventories((prev) => prev.filter((inv) => inv.locationId !== dep.id));
      setFeedback({ kind: "success", message: "Deposito removido e estoque debitado." });
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Falha ao remover deposito. Verifique se ele nao esta vinculado a compras.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="axis-categories-header">
        <div className="axis-categories-title-block">
          <div className="axis-categories-title">Depositos</div>
          <div className="axis-categories-subtitle">
            Pesquise, crie e defina o deposito padrao que debita vendas.
          </div>
        </div>

        <div className="axis-categories-actions">
          <AxisSearchInput value={search} onChange={setSearch} placeholder="Buscar deposito..." />
          <button type="button" className="axis-admin-button-icon" onClick={openCreateModal}>
            <span aria-hidden="true">+</span>
            <span>Criar deposito</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="axis-category-empty">Carregando depositos...</p>
      ) : filteredDeposits.length === 0 ? (
        <p className="axis-category-empty">Nenhum deposito encontrado. Crie um novo deposito para comecar.</p>
      ) : (
        <section className="axis-categories-grid">
          {filteredDeposits.map((deposit) => {
            const updatedAt = new Date(deposit.updatedAt);
            const totals = getTotals(deposit.id);
            const subtitle = `${totals.totalSkus} produtos - ${totals.totalQuantity} itens`;
            return (
              <article key={deposit.id} className="axis-category-card">
                <div
                  className="axis-category-image"
                  style={{ borderRadius: "50%", height: "64px", width: "64px" }}
                >
                  <span>{deposit.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="axis-category-name" style={{ marginTop: "0.2rem" }}>
                  {deposit.name}
                </div>
                <div className="axis-category-meta" style={{ gap: "0.15rem" }}>
                  <span style={{ fontWeight: 700 }}>{subtitle}</span>
                  <span>
                    Atualizado em {Number.isNaN(updatedAt.getTime()) ? "-" : updatedAt.toLocaleDateString("pt-BR")}
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr 1fr",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginTop: "0.4rem",
                  }}
                >
                  <button
                    type="button"
                    className={"axis-toggle-pill" + (deposit.isSaleSource ? " axis-toggle-pill--active" : "")}
                    onClick={() => handleToggleSaleSource(deposit)}
                    disabled={togglingSaleSourceId === deposit.id}
                    title="Marcar como fonte padrao de vendas"
                  >
                    <div className="axis-toggle-pill-dot" />
                  </button>
                  <button
                    type="button"
                    className="axis-admin-button-secondary"
                    onClick={() => openEditModal(deposit)}
                    style={{ minWidth: 0 }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="axis-admin-button-secondary"
                    onClick={() => handleDelete(deposit)}
                    style={{ minWidth: 0 }}
                  >
                    Excluir
                  </button>
                </div>

                <div className="axis-category-meta" style={{ marginTop: "0.3rem" }}>
                  <span className="axis-badge-soft">{deposit.isSaleSource ? "Debita vendas" : "Nao debita vendas"}</span>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {feedback && (
        <p className={`axis-feedback ${feedback.kind === "error" ? "axis-error" : "axis-success"}`}>{feedback.message}</p>
      )}

      {modalOpen && (
        <div className="axis-modal-backdrop">
          <div className="axis-modal">
            <div className="axis-modal-header">
              <div className="axis-modal-title">
                {modalMode === "create" ? "Criar novo deposito" : `Editar deposito: ${editingDeposit?.name ?? ""}`}
              </div>
              <button type="button" className="axis-modal-close" onClick={closeModal} disabled={isSubmitting}>
                x
              </button>
            </div>

            <div className="axis-modal-body">
              <form onSubmit={handleSubmit}>
                <label className="axis-label">
                  Nome do deposito
                  <input
                    type="text"
                    className="axis-input"
                    placeholder="Ex.: Deposito principal, Loja 1, Estoque balcao..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isSubmitting}
                  />
                </label>

                <label className="axis-label">
                  Debitar vendas do deposito
                  <div
                    className={"axis-toggle-pill" + (isSaleSource ? " axis-toggle-pill--active" : "")}
                    onClick={() => setIsSaleSource((prev) => !prev)}
                    style={{ cursor: "pointer", width: "72px" }}
                  >
                    <div className="axis-toggle-pill-dot" />
                  </div>
                </label>

                {modalMode === "create" && (
                  <>
                    <div
                      style={{
                        marginTop: "1rem",
                        borderRadius: "1rem",
                        padding: "0.85rem 0.9rem",
                        border: "1px dashed rgba(148,163,184,0.8)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.6rem",
                      }}
                    >
                      <div className="axis-panel-header">
                        <div>
                          <div className="axis-panel-title">Selecionar produtos do deposito</div>
                          <div className="axis-panel-subtitle">
                            Defina os produtos e as quantidades iniciais que farao parte deste deposito.
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                        <div className="axis-search-wrapper" style={{ flex: "1 1 240px" }}>
                          <div className="axis-search-bar">
                            <AxisSearchInput
                              value={productsSearch}
                              onChange={setProductsSearch}
                              placeholder="Buscar produto por nome, SKU ou codigo de barras..."
                            />
                          </div>
                        </div>

                        <select
                          className="axis-select"
                          value={selectedCategoryId}
                          onChange={(e) => setSelectedCategoryId(e.target.value)}
                          disabled={isSubmitting || isLoadingProducts}
                          style={{ flex: "0 0 220px" }}
                        >
                          <option value="all">Todas categorias</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {isLoadingProducts ? (
                        <p className="axis-category-empty">Carregando produtos...</p>
                      ) : filteredProducts.length === 0 ? (
                        <p className="axis-category-empty">Nenhum produto encontrado com esses filtros.</p>
                      ) : (
                        <div className="axis-products-list-body">
                          {filteredProducts.map((product) => {
                            const qty = quantities[product.id] ?? 0;
                            const category = categories.find((c) => c.id === product.categoryId);
                            return (
                              <div key={product.id} className="axis-prodcard" style={{ alignItems: "center" }}>
                                <div className="axis-prodcard-info">
                                  <div className="axis-prodcard-name">{product.name}</div>
                                  <div className="axis-prodcard-price">{product.sku && <span>SKU: {product.sku}</span>}</div>
                                </div>

                                <div className="axis-prodcard-category">
                                  <div className="axis-prodcard-category-label">Categoria</div>
                                  <div className="axis-prodcard-category-value">{category?.name ?? "-"}</div>
                                </div>

                                <div className="axis-prodcard-toggle">
                                  <div style={{ textAlign: "right" }}>
                                    <div
                                      style={{
                                        fontSize: "0.75rem",
                                        opacity: 0.8,
                                        marginBottom: "0.2rem",
                                      }}
                                    >
                                      Qtd. inicial
                                    </div>
                                    <input
                                      type="number"
                                      min={0}
                                      step={1}
                                      value={qty === 0 ? "" : qty}
                                      onChange={(ev) => handleQuantityChange(product.id, ev)}
                                      disabled={isSubmitting}
                                      className="axis-input"
                                      style={{ width: "96px" }}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="axis-panel" style={{ marginTop: "0.8rem" }}>
                      <div className="axis-panel-header">
                        <div>
                          <div className="axis-panel-title">Produtos que serao inicializados</div>
                          <div className="axis-panel-subtitle">
                            {hasAnyItem
                              ? `${selectedItems.length} produto(s) com quantidade inicial > 0.`
                              : "Nenhum produto selecionado ainda."}
                          </div>
                        </div>
                      </div>

                      {hasAnyItem && (
                        <ul className="axis-list">
                          {selectedItems.map(({ product, quantity }) => (
                            <li key={product.id} className="axis-list-item">
                              <span>{product.name}</span>
                              <span className="axis-badge-soft">Qtd: {quantity}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {!hasAnyItem && (
                        <p className="axis-footer-note">
                          Comece digitando quantidades nos produtos acima para montar o estoque inicial.
                        </p>
                      )}
                    </div>
                  </>
                )}

                {modalMode === "edit" && (
                  <div className="axis-panel" style={{ marginTop: "0.8rem" }}>
                    <div className="axis-panel-header">
                      <div>
                        <div className="axis-panel-title">Produtos vinculados ao deposito</div>
                        <div className="axis-panel-subtitle">Remova um produto para zerar o estoque deste deposito.</div>
                      </div>
                    </div>

                    {existingItems.length === 0 ? (
                      <p className="axis-category-empty">Nenhum produto vinculado.</p>
                    ) : (
                      <ul className="axis-list">
                        {existingItems.map((item) => (
                          <li key={item.productId} className="axis-list-item">
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                              <span>{item.productName}</span>
                              {item.sku ? <small style={{ opacity: 0.7 }}>SKU: {item.sku}</small> : null}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                              <span className="axis-badge-soft">Qtd: {item.quantity}</span>
                              <button
                                type="button"
                                className="axis-admin-button-secondary"
                                style={{ minWidth: 0, padding: "0.2rem 0.6rem" }}
                                title="Remover produto deste deposito (zerar estoque)"
                                disabled={removingProductId === item.productId || isSubmitting}
                                onClick={() => void handleRemoveExistingItem(item)}
                              >
                                {removingProductId === item.productId ? "Removendo..." : "Excluir"}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <p className="axis-footer-note" style={{ marginTop: "0.6rem" }}>
                      PARA ACRESCENTAR PRODUTOS E ALTERAR QUANTIDADE, POR FAVOR VA PARA ABA ESTOQUE &gt; SALDOS
                    </p>
                  </div>
                )}

                <div className="axis-form-actions" style={{ marginTop: "1rem", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="axis-admin-button-secondary"
                    onClick={closeModal}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="axis-admin-button-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Salvando..." : modalMode === "create" ? "Criar" : "Salvar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {centerMessage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
            zIndex: 100,
          }}
          onClick={() => setCenterMessage(null)}
        >
          <div
            className="axis-panel"
            style={{
              maxWidth: "520px",
              width: "90%",
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            <div className="axis-panel-title" style={{ marginBottom: "0.4rem" }}>
              Aviso
            </div>
            <div className="axis-panel-subtitle">{centerMessage}</div>
          </div>
        </div>
      )}
    </>
  );
}

export default AxisStockDepositsPageContent;
