import { useEffect, useMemo, useState } from "react";
import { type Category, type Product, listCategories, listProducts } from "../../services/api";
import "./comandas-order-page.css";

type Feedback = { kind: "error"; message: string } | null;

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const toNumber = (value?: string | number | null) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

export function ComandasOrderPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("__all");
  const [query, setQuery] = useState<string>("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const categoryOptions = useMemo(
    () => [{ id: "__all", name: "Todas" }, ...categories],
    [categories],
  );

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products
      .filter((p) => (selectedCategory === "__all" ? true : p.categoryId === selectedCategory))
      .filter((p) => {
        if (!term) return true;
        return (
          p.name.toLowerCase().includes(term) ||
          (p.barcode ?? "").toLowerCase().includes(term) ||
          (p.sku ?? "").toLowerCase().includes(term)
        );
      });
  }, [products, selectedCategory, query]);

  const totals = useMemo(() => {
    let totalItems = 0;
    let totalPrice = 0;
    for (const [productId, qty] of Object.entries(cart)) {
      const product = productMap.get(productId);
      if (!product) continue;
      const price = toNumber(product.price);
      totalItems += qty;
      totalPrice += qty * price;
    }
    return { totalItems, totalPrice };
  }, [cart, productMap]);

  const loadData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [cats, prods] = await Promise.all([listCategories(), listProducts()]);
      setCategories(cats);
      setProducts(prods);
    } catch (err) {
      setFeedback({
        kind: "error",
        message: err instanceof Error ? err.message : "Falha ao carregar categorias e produtos.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const addToCart = (productId: string, qty = 1) => {
    setCart((prev) => {
      const nextQty = (prev[productId] ?? 0) + qty;
      const next = { ...prev };
      if (nextQty <= 0) {
        delete next[productId];
      } else {
        next[productId] = nextQty;
      }
      return next;
    });
  };

  const clearCart = () => setCart({});

  const activeCategory = useMemo(
    () => categoryOptions.find((c) => c.id === selectedCategory),
    [categoryOptions, selectedCategory],
  );

  return (
    <div className="comandas-shell">
      <div className="comandas-app">
        <div className="comandas-topbar">
          <div className="comandas-title">
            <div className="comandas-badge">PDV</div>
            <div>
              <div style={{ fontSize: 14, lineHeight: 1.05 }}>Registrar pedido</div>
              <div style={{ fontSize: 12, color: "var(--cmd-muted)", fontWeight: 600 }}>Comandas</div>
            </div>
          </div>

          <div className="comandas-actions">
            <button className="comandas-icon-btn" onClick={() => void loadData()} disabled={loading} title="Recarregar">
              ⟳
            </button>
            <button className="comandas-icon-btn" onClick={clearCart} title="Limpar carrinho">
              ⟲
            </button>
          </div>
        </div>

        <div className="comandas-cats-wrap">
          <div className="comandas-cats">
            {categoryOptions.map((cat) => (
              <button
                key={cat.id}
                className={`comandas-chip${cat.id === selectedCategory ? " active" : ""}`}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setQuery("");
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="comandas-search-row">
          <div className="comandas-search" role="search">
            <span style={{ color: "var(--cmd-muted)" }}>🔎</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar produtos pelo nome, código de barras ou SKU..."
            />
          </div>
          <div className="comandas-pill">Categoria: {activeCategory?.name ?? "Todas"}</div>
          <button className="comandas-icon-btn" onClick={clearCart} title="Limpar carrinho">
            ✕
          </button>
        </div>

        {feedback && <div className="comandas-status error">{feedback.message}</div>}

        <div className="comandas-content">
          {loading ? (
            <div className="comandas-loading">Carregando produtos...</div>
          ) : (
            <div className="comandas-grid">
              {visibleProducts.length === 0 && (
                <div className="comandas-empty">
                  Nenhum produto encontrado para esta categoria e pesquisa.
                </div>
              )}

              {visibleProducts.map((p) => {
                const qty = cart[p.id] ?? 0;
                const price = money.format(toNumber(p.price));
                const categoryLabel = categoryNameById.get(p.categoryId ?? "") ?? "Sem categoria";

                return (
                  <div key={p.id} className="comandas-card" onClick={() => addToCart(p.id, 1)}>
                    <div className="comandas-card-thumb" />
                    <div className="comandas-card-tag">{categoryLabel}</div>

                    <button
                      className="comandas-add-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(p.id, 1);
                      }}
                      aria-label="Adicionar"
                      title="Adicionar"
                    >
                      +
                    </button>

                    <div className="comandas-card-meta">
                      <div className="comandas-card-name">{p.name}</div>
                      <div className="comandas-card-price-row">
                        <div className="comandas-card-price">{price}</div>
                        <div className="comandas-card-qty">
                          {qty > 0 ? `No carrinho: ${qty}` : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="comandas-hint">
            Dica: clique em um card para adicionar 1 item. Clique no “+” para adicionar também.
          </div>
        </div>

        <div className="comandas-bottombar">
          <div className="comandas-totals">
            <div className="line1">
              {totals.totalItems} {totals.totalItems === 1 ? "item" : "itens"}
            </div>
            <div className="line2">Total: {money.format(totals.totalPrice)}</div>
          </div>

          <div className="comandas-bar-actions">
            <button className="comandas-btn" onClick={clearCart}>
              Limpar
            </button>
            <button
              className="comandas-btn primary"
              onClick={() => {
                if (totals.totalItems === 0) {
                  setFeedback({ kind: "error", message: "Carrinho vazio. Adicione itens antes de avançar." });
                  return;
                }
                window.alert("Próxima etapa de pagamento/fechamento não implementada nesta tela.");
              }}
              disabled={totals.totalItems === 0}
            >
              Próximo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ComandasOrderPage;
