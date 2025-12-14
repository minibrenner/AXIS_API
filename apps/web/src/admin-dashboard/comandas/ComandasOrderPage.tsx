import { useEffect, useMemo, useState } from "react";
import {
  Category,
  Comanda,
  addItemsToComanda,
  listCategories,
  listComandas,
  listProducts,
  Product,
} from "../../services/api";

type Feedback =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | null;

type SelectedItem = {
  product: Product;
  qty: number;
};

const toNumber = (value?: string | number | null) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.replace(",", "."));
  return 0;
};

export function ComandasOrderPage() {
  const [searchComanda, setSearchComanda] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [comanda, setComanda] = useState<Comanda | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [items, setItems] = useState<SelectedItem[]>([]);

  useEffect(() => {
    void loadCategories();
    void loadProducts();
  }, []);

  const loadCategories = async () => {
    try {
      const list = await listCategories();
      setCategories(list);
    } catch (err) {
      setFeedback({
        kind: "error",
        message: err instanceof Error ? err.message : "Falha ao carregar categorias.",
      });
    }
  };

  const loadProducts = async () => {
    try {
      const list = await listProducts();
      setProducts(list);
    } catch (err) {
      setFeedback({
        kind: "error",
        message: err instanceof Error ? err.message : "Falha ao carregar produtos.",
      });
    }
  };

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    return products
      .filter((p) =>
        selectedCategory ? p.categoryId === selectedCategory : true,
      )
      .filter((p) => {
        if (!term) return true;
        return (
          p.name.toLowerCase().includes(term) ||
          (p.barcode ?? "").toLowerCase().includes(term) ||
          (p.sku ?? "").toLowerCase().includes(term)
        );
      });
  }, [products, productSearch, selectedCategory]);

  const addItem = (product: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i,
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const updateQty = (productId: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.product.id === productId ? { ...i, qty: Math.max(0, qty) } : i,
        )
        .filter((i) => i.qty > 0),
    );
  };

  const totalItems = useMemo(
    () => items.reduce((sum, i) => sum + i.qty, 0),
    [items],
  );

  const totalValue = useMemo(
    () => items.reduce((sum, i) => sum + toNumber(i.product.price) * i.qty, 0),
    [items],
  );

  const handleSearchComanda = async () => {
    if (!searchComanda.trim()) {
      setFeedback({ kind: "error", message: "Informe numero de comanda, CPF ou celular para buscar." });
      return;
    }
    setIsSearching(true);
    setFeedback(null);
    try {
      const list = await listComandas({ q: searchComanda.trim() });
      const found = list[0] ?? null;
      if (!found) {
        setComanda(null);
        setFeedback({ kind: "error", message: "Comanda nao encontrada." });
      } else {
        setComanda(found);
        setFeedback(null);
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

  const handleCancel = () => {
    const confirm = window.confirm("Cancelar o pedido? Isso limpará todos os itens selecionados.");
    if (!confirm) return;
    setItems([]);
    setTableNumber("");
    setNotes("");
    setFeedback(null);
  };

  const handleSubmit = async () => {
    if (!comanda || !tableNumber.trim()) {
      setFeedback({
        kind: "error",
        message: "Selecione o numero da comanda e mesa para enviar pedido.",
      });
      return;
    }
    if (items.length === 0) {
      setFeedback({ kind: "error", message: "Adicione ao menos um item ao pedido." });
      return;
    }

    try {
      await addItemsToComanda(comanda.id, {
        items: items.map((i) => ({ productId: i.product.id, qty: i.qty })),
        tableNumber: tableNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      setFeedback({
        kind: "success",
        message: `Pedido enviado para a comanda ${comanda.number}.`,
      });
      setItems([]);
      setComanda(null);
      setSearchComanda("");
      setTableNumber("");
      setNotes("");
      setProductSearch("");
      setSelectedCategory(null);
    } catch (err) {
      setFeedback({
        kind: "error",
        message: err instanceof Error ? err.message : "Falha ao enviar o pedido.",
      });
    }
  };

  return (
    <div className="axis-panels-grid" style={{ gridTemplateColumns: "1fr" }}>
      <div className="axis-panel">
        <div className="axis-panel-header">
          <div>
            <div className="axis-panel-title">Registrar pedido</div>
            <div className="axis-panel-subtitle">
              Localize a comanda, selecione itens e finalize o envio.
            </div>
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
              border: "1px solid rgba(148,163,184,0.4)",
              padding: "0.65rem 0.8rem",
              borderRadius: "0.75rem",
              marginBottom: "0.6rem",
            }}
          >
            {feedback.message}
          </div>
        )}

        <div className="axis-form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <label className="axis-label">
            Nº Comanda / CPF / Celular
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <input
                className="axis-input"
                placeholder="Busque por numero, CPF ou celular"
                value={searchComanda}
                onChange={(e) => setSearchComanda(e.target.value)}
              />
              <button
                type="button"
                className="axis-button-secondary"
                onClick={handleSearchComanda}
                disabled={isSearching}
              >
                {isSearching ? "Buscando..." : "Buscar"}
              </button>
            </div>
          </label>

          <label className="axis-label">
            Nº Mesa
            <input
              className="axis-input"
              placeholder="Opcional"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
            />
          </label>

          <label className="axis-label" style={{ gridColumn: "1 / -1" }}>
            Nome do cliente
            <input
              className="axis-input"
              value={comanda?.customerName ?? ""}
              placeholder="Preencha ao localizar a comanda"
              disabled
            />
          </label>
        </div>

        <div style={{ marginTop: "0.6rem" }}>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              overflowX: "auto",
              paddingBottom: "0.2rem",
              scrollbarWidth: "thin",
            }}
          >
            <button
              type="button"
              className={`axis-button-secondary${selectedCategory ? "" : " axis-button-secondary-active"}`}
              onClick={() => setSelectedCategory(null)}
              style={{ flex: "0 0 auto" }}
            >
              Tudo
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`axis-button-secondary${selectedCategory === cat.id ? " axis-button-secondary-active" : ""}`}
                onClick={() => setSelectedCategory(cat.id)}
                style={{ flex: "0 0 auto" }}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div style={{ marginTop: "0.5rem" }}>
            <input
              className="axis-input"
              placeholder="Buscar produto pelo nome, barcode ou SKU"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: "0.5rem",
            marginTop: "0.8rem",
            maxHeight: "320px",
            overflow: "auto",
          }}
        >
          {filteredProducts.slice(0, 4).map((product) => {
            const price = toNumber(product.price);
            return (
              <div
                key={product.id}
                className="axis-list-item"
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: "0.5rem",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "0.6rem",
                    background: "rgba(148,163,184,0.25)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.8)",
                  }}
                >
                  FOTO
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <strong>{product.name}</strong>
                  <span style={{ opacity: 0.75 }}>R$ {price.toFixed(2)}</span>
                </div>
                <button
                  type="button"
                  className="axis-admin-button-primary"
                  onClick={() => addItem(product)}
                  style={{ padding: "0.4rem 0.8rem" }}
                >
                  Adicionar
                </button>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: "1rem",
            borderRadius: "0.9rem",
            border: "1px solid rgba(148,163,184,0.35)",
            padding: "0.8rem",
            background: "rgba(15,23,42,0.4)",
          }}
        >
          <div style={{ marginBottom: "0.6rem", fontWeight: 600 }}>Pedido</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {items.length === 0 && <div style={{ opacity: 0.7 }}>Nenhum item adicionado.</div>}
            {items.map((item) => {
              const price = toNumber(item.product.price);
              return (
                <div
                  key={item.product.id}
                  className="axis-list-item"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "0.6rem",
                      background: "rgba(248,113,113,0.2)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: "0.7rem",
                    }}
                  >
                    FOTO
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <strong>{item.product.name}</strong>
                    <span style={{ opacity: 0.75 }}>R$ {price.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <button
                      type="button"
                      className="axis-button-secondary"
                      onClick={() => updateQty(item.product.id, item.qty - 1)}
                      style={{ padding: "0.35rem 0.6rem" }}
                    >
                      -
                    </button>
                    <span>{item.qty}</span>
                    <button
                      type="button"
                      className="axis-button-secondary"
                      onClick={() => updateQty(item.product.id, item.qty + 1)}
                      style={{ padding: "0.35rem 0.6rem" }}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <label className="axis-label" style={{ marginTop: "0.8rem" }}>
          Observações
          <textarea
            className="axis-input"
            rows={2}
            placeholder="Alguma nota para a cozinha ou bar..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <div
          className="axis-form-grid"
          style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", marginTop: "0.8rem" }}
        >
          <div className="axis-label">
            Qtd itens:
            <div style={{ fontWeight: 700 }}>{totalItems}</div>
          </div>
          <div className="axis-label">
            Total do pedido:
            <div style={{ fontWeight: 700 }}>R$ {totalValue.toFixed(2)}</div>
          </div>
        </div>

        <div className="axis-form-actions" style={{ gap: "0.5rem" }}>
          <button type="button" className="axis-button-secondary" onClick={handleCancel}>
            Cancelar pedido
          </button>
          <button type="button" className="axis-admin-button-primary" onClick={handleSubmit}>
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ComandasOrderPage;
