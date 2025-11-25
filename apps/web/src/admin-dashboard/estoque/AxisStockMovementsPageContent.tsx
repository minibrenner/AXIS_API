import { useEffect, useMemo, useState } from "react";
import { AxisSearchInput } from "../../components/elements/AxisSearchInput";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import {
  listProducts,
  listStockLocations,
  listStockMovements,
  type Product,
  type StockLocation,
  type StockMovement,
} from "../../services/api";

type Feedback = { kind: "error" | "success"; message: string } | null;

type Filters = {
  startDate: string;
  endDate: string;
  locationId: string;
  productId: string;
  type: "" | "IN" | "OUT" | "ADJUST" | "RETURN" | "CANCEL";
  search: string;
};

const PAGE_SIZE = 15;

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

const parseQty = (value: string | number | null | undefined) => {
  const n = Number(value ?? 0);
  return Number.isNaN(n) ? 0 : n;
};

const typeLabel: Record<StockMovement["type"], string> = {
  IN: "Entrada",
  OUT: "Saida",
  ADJUST: "Ajuste",
  CANCEL: "Cancelamento",
  RETURN: "Retorno",
};

export function AxisStockMovementsPageContent() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState<Filters>({
    startDate: "",
    endDate: "",
    locationId: "all",
    productId: "all",
    type: "",
    search: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const [locs, prods, movs] = await Promise.all([
          listStockLocations(),
          listProducts(),
          listStockMovements(),
        ]);
        setLocations(locs);
        setProducts(prods);
        setMovements(movs);
      } catch (err) {
        setFeedback({
          kind: "error",
          message: err instanceof Error ? err.message : "Falha ao carregar movimentos de estoque.",
        });
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const filteredMovements = useMemo(() => {
    const start = filters.startDate ? new Date(filters.startDate) : null;
    const end = filters.endDate ? new Date(filters.endDate) : null;
    const term = filters.search.trim().toLowerCase();

    const filtered = movements
      .filter((mov) => {
        if (filters.locationId !== "all" && mov.locationId !== filters.locationId) return false;
        if (filters.productId !== "all" && mov.productId !== filters.productId) return false;
        if (filters.type && mov.type !== filters.type) return false;

        if (start) {
          const d = new Date(mov.createdAt);
          if (d < start) return false;
        }
        if (end) {
          const d = new Date(mov.createdAt);
          if (d > end) return false;
        }

        if (term) {
          const product = products.find((p) => p.id === mov.productId);
          const location = locations.find((l) => l.id === mov.locationId);
          const reason = mov.reason ?? "";
          const ref = mov.refId ?? "";
          const by = mov.createdByName ?? mov.createdBy ?? "";
          const haystack = `${product?.name ?? mov.productId} ${product?.sku ?? ""} ${location?.name ?? mov.locationId} ${reason} ${ref} ${by}`.toLowerCase();
          if (!haystack.includes(term)) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return filtered;
  }, [movements, filters, products, locations]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredMovements.length / PAGE_SIZE)), [filteredMovements.length]);
  const pagedMovements = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredMovements.slice(start, start + PAGE_SIZE);
  }, [filteredMovements, page]);

  const productLabel = (id: string) => {
    const p = products.find((prod) => prod.id === id);
    return p ? `${p.name}${p.sku ? ` (SKU: ${p.sku})` : ""}` : id;
  };

  const locationLabel = (id: string) => locations.find((l) => l.id === id)?.name ?? id;
  const ellipsis = (value: string, max = 32) => {
    if (value.length <= max) return value;
    return `${value.slice(0, max - 1)}…`;
  };

  const getProduct = (id: string) => products.find((p) => p.id === id);

  return (
    <div className="axis-products-list">
      <div className="axis-categories-header">
        <div className="axis-categories-title-block">
          <div className="axis-categories-title">Historico de movimentacoes</div>
          <div className="axis-categories-subtitle">
            Entradas, saidas e ajustes filtrados por periodo, deposito, produto e tipo.
          </div>
        </div>
      </div>

      <div className="axis-panel" style={{ marginBottom: "0.8rem" }}>
        <div className="axis-panel-header">
          <div>
            <div className="axis-panel-title">Filtros</div>
            <div className="axis-panel-subtitle">Refine por data, deposito, produto e tipo de movimento.</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.6rem" }}>
          <label className="axis-label">
            Data inicial
            <input
              type="date"
              className="axis-input"
              value={filters.startDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </label>
          <label className="axis-label">
            Data final
            <input
              type="date"
              className="axis-input"
              value={filters.endDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </label>
          <label className="axis-label">
            Deposito
            <select
              className="axis-select"
              value={filters.locationId}
              onChange={(e) => setFilters((prev) => ({ ...prev, locationId: e.target.value }))}
            >
              <option value="all">Todos</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </label>
          <label className="axis-label">
            Produto
            <select
              className="axis-select"
              value={filters.productId}
              onChange={(e) => setFilters((prev) => ({ ...prev, productId: e.target.value }))}
            >
              <option value="all">Todos</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="axis-label">
            Tipo
            <select
              className="axis-select"
              value={filters.type}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  type: e.target.value as Filters["type"],
                }))
              }
            >
              <option value="">Todos</option>
              <option value="IN">Entrada</option>
              <option value="OUT">Saida</option>
              <option value="ADJUST">Ajuste</option>
              <option value="RETURN">Retorno</option>
              <option value="CANCEL">Cancelamento</option>
            </select>
          </label>
          <label className="axis-label" style={{ gridColumn: "1 / -1" }}>
            Busca (produto, deposito, motivo, ref)
            <AxisSearchInput
              value={filters.search}
              onChange={(val) => setFilters((prev) => ({ ...prev, search: val }))}
              placeholder="Digite parte do nome, SKU, deposito ou motivo..."
            />
          </label>
        </div>
      </div>

      <section className="axis-products-list">
        <div className="axis-products-list-header">
          <span>Data | </span>
          <span>Tipo | </span>
          <span>Produto | </span>
          <span>Deposito | </span>
          <span>Qtd. | </span>
          <span>Usuario | </span>
          <span>Motivo / Ref.</span>
        </div>

        <div className="axis-products-list-body">
          {isLoading ? (
            <div className="axis-products-empty">Carregando movimentacoes...</div>
          ) : pagedMovements.length === 0 ? (
            <div className="axis-products-empty">Nenhuma movimentacao para os filtros.</div>
          ) : (
            pagedMovements.map((mov) => {
              const qty = parseQty(mov.quantity);
              const isNegative = qty < 0 || mov.type === "OUT";
              const product = getProduct(mov.productId);
              const productName = product ? product.name : mov.productId;
              const productSku = product?.sku ?? null;
              const dateObj = new Date(mov.createdAt);
              const dateStr = Number.isNaN(dateObj.getTime())
                ? "-"
                : dateObj.toLocaleDateString("pt-BR");
              const timeStr = Number.isNaN(dateObj.getTime())
                ? "-"
                : dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

              return (
                <article key={mov.id} className="axis-prodcard-row">
                  <div className="axis-prodcard">
                    <div className="axis-prodcard-info" style={{ minWidth: 160, maxWidth: 200 }}>
                      <div className="axis-prodcard-name">{dateStr}</div>
                      <div className="axis-prodcard-price" style={{ opacity: 0.85, fontSize: "0.85rem" }}>
                        {timeStr} • {typeLabel[mov.type]}
                      </div>
                    </div>

                    <div className="axis-prodcard-category" style={{ minWidth: 180, maxWidth: 240 }}>
                      <div className="axis-prodcard-category-label">Produto</div>
                      <div className="axis-prodcard-category-value" title={productName}>
                        {ellipsis(productName, 36)}
                      </div>
                      {productSku ? (
                        <div style={{ fontSize: "0.82rem", opacity: 0.8 }} title={productSku}>
                          SKU: {ellipsis(productSku, 22)}
                        </div>
                      ) : null}
                    </div>

                    <div className="axis-prodcard-category" style={{ minWidth: 160, maxWidth: 220 }}>
                      <div className="axis-prodcard-category-label">Deposito</div>
                      <div className="axis-prodcard-category-value" title={locationLabel(mov.locationId)}>
                        {ellipsis(locationLabel(mov.locationId), 32)}
                      </div>
                    </div>

                    <div className="axis-prodcard-category" style={{ minWidth: 90 }}>
                      <div className="axis-prodcard-category-label">Qtd.</div>
                      <div
                        className={isNegative ? "axis-row-badge axis-row-badge--low" : "axis-row-badge"}
                        style={{ justifyContent: "center", minWidth: "72px" }}
                      >
                        {qty} un
                      </div>
                    </div>

                    <div className="axis-prodcard-category" style={{ minWidth: 120, maxWidth: 100 }}>
                      <div className="axis-prodcard-category-label">Usuario</div>
                      <div className="axis-prodcard-category-value" title={mov.createdByName ?? mov.createdBy ?? "-"}>
                        {mov.createdByName
                          ? ellipsis(mov.createdByName, 22)
                          : mov.createdBy
                            ? ellipsis(mov.createdBy, 22)
                            : "-"}
                      </div>
                    </div>

                    <div className="axis-prodcard-category" style={{ minWidth: 160, maxWidth: 240 }}>
                      <div className="axis-prodcard-category-label">Motivo / Ref.</div>
                      <div className="axis-prodcard-category-value">
                        <span title={mov.reason ?? "-"}>
                          {mov.reason ? ellipsis(mov.reason, 32) : "-"}
                        </span>
                        {mov.refId ? (
                          <small style={{ opacity: 0.75 }} title={mov.refId}>
                            Ref: {ellipsis(mov.refId, 30)}
                          </small>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="center"
        sx={{
          marginTop: "0.8rem",
          "& .MuiPaginationItem-root": {
            color: "inherit",
          },
          "& .MuiPaginationItem-root.Mui-selected": {
            backgroundColor: "rgba(59,130,246,0.12)",
            color: "inherit",
            borderColor: "rgba(59,130,246,0.7)",
          },
          "& .MuiPaginationItem-previousNext": {
            color: "inherit",
          },
        }}
      >
        <Pagination
          count={totalPages}
          page={page}
          onChange={(_, value) => setPage(value)}
          variant="outlined"
          color="primary"
          siblingCount={1}
          boundaryCount={1}
          disabled={isLoading}
        />
      </Stack>

      {feedback && (
        <p className={`axis-feedback ${feedback.kind === "error" ? "axis-error" : "axis-success"}`}>{feedback.message}</p>
      )}
    </div>
  );
}

export default AxisStockMovementsPageContent;
