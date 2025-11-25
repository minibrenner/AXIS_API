import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import axios, { type AxiosError } from "axios";
import { apiClient } from "../../services/http";
import { SearchBarWithCategoryFilter } from "./SearchBarWithCategoryFilter";

const assetsBaseUrl =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_ASSETS_BASE_URL
    ? String(import.meta.env.VITE_ASSETS_BASE_URL)
    : "";

const buildImageUrl = (path?: string | null): string | null => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;

  if (!assetsBaseUrl) {
    return path;
  }

  const base = assetsBaseUrl.replace(/\/$/, "");
  const cleanPath = path.replace(/^\//, "");
  return `${base}/${cleanPath}`;
};

type Category = {
  id: string;
  name: string;
  imagePath?: string | null;
};

export type Product = {
  id: string;
  tenantId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: "UN" | "CX" | "KG" | "LT" | "GR" | "ML" | "PC";
  price: string;
  cost: string | null;
  minStock: string | null;
  categoryId: string | null;
  ncm: string | null;
  cest: string | null;
  csosn: string | null;
  cfop: string | null;
  imagePath: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type Feedback = { kind: "error" | "success"; message: string } | null;
type Mode = "create" | "edit";

type ApiErrorPayload =
  | {
      error?: {
        code?: string;
        message?: string;
        errors?: Array<{ field: string; message: string }>;
        details?: unknown;
      };
      message?: string;
    }
  | {
      error?: string;
      message?: string;
    }
  | undefined;

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorPayload>;
    const status = axiosError.response?.status;
    const data = axiosError.response?.data;

    const bodyMessage =
      (typeof data?.error === "object" && typeof data.error?.message === "string"
        ? data.error.message
        : undefined) ??
      (typeof data?.message === "string" ? data.message : undefined) ??
      (typeof data?.error === "string" ? data.error : undefined);

    if (bodyMessage) {
      const code =
        typeof data?.error === "object" ? data.error?.code : undefined;
      const fieldErrors =
        typeof data?.error === "object" ? data.error?.errors : undefined;

      if (code === "VALIDATION_ERROR" && fieldErrors && fieldErrors.length) {
        const first = fieldErrors[0];
        return `${bodyMessage} Campo: ${first.field} - ${first.message}.`;
      }

      return bodyMessage;
    }

    if (status === 400) {
      return "Dados invalidos. Verifique os campos e tente novamente.";
    }
    if (status === 401) {
      return "Sua sessao expirou. Faca login novamente.";
    }
    if (status === 403) {
      return "Voce nao tem permissao para executar esta acao.";
    }
    if (status === 404) {
      return "Recurso nao encontrado.";
    }
    if (status === 500) {
      return "Erro interno ao processar o produto. Tente novamente em instantes.";
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

async function apiGetCategories(): Promise<Category[]> {
  const res = await apiClient.get<Category[]>("/categories");
  return res.data;
}

async function apiGetProducts(): Promise<Product[]> {
  const res = await apiClient.get<Product[]>("/products");
  return res.data;
}

async function apiCreateProduct(
  data: Partial<Product>,
  imageFile?: File | null,
): Promise<Product> {
  const formData = new FormData();

  if (data.name) formData.append("name", data.name);
  if (data.sku) formData.append("sku", data.sku);
  if (data.barcode) formData.append("barcode", data.barcode);
  if (data.unit) formData.append("unit", data.unit);
  if (data.price) formData.append("price", data.price);
  if (data.cost) formData.append("cost", data.cost);
  if (data.categoryId) formData.append("categoryId", data.categoryId);
  if (data.minStock) formData.append("minStock", data.minStock);
  if (data.ncm) formData.append("ncm", data.ncm);
  if (data.cest) formData.append("cest", data.cest);
  if (data.csosn) formData.append("csosn", data.csosn);
  if (data.cfop) formData.append("cfop", data.cfop);

  if (imageFile) {
    formData.append("image", imageFile);
  }

  const res = await apiClient.post<Product>("/products", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

async function apiUpdateProduct(
  id: string,
  data: Partial<Product>,
  imageFile?: File | null,
): Promise<Product> {
  const formData = new FormData();

  if (data.name !== undefined) formData.append("name", data.name ?? "");
  if (data.sku !== undefined) formData.append("sku", data.sku ?? "");
  if (data.barcode !== undefined)
    formData.append("barcode", data.barcode ?? "");
  if (data.unit !== undefined) formData.append("unit", data.unit);
  if (data.price !== undefined) formData.append("price", data.price ?? "");
  if (data.cost !== undefined) formData.append("cost", data.cost ?? "");
  if (data.categoryId !== undefined)
    formData.append("categoryId", data.categoryId ?? "");
  if (data.minStock !== undefined)
    formData.append("minStock", data.minStock ?? "");
  if (data.ncm !== undefined) formData.append("ncm", data.ncm ?? "");
  if (data.cest !== undefined) formData.append("cest", data.cest ?? "");
  if (data.csosn !== undefined) formData.append("csosn", data.csosn ?? "");
  if (data.cfop !== undefined) formData.append("cfop", data.cfop ?? "");

  if (imageFile) {
    formData.append("image", imageFile);
  }

  const res = await apiClient.patch<Product>(`/products/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

async function apiSoftDeleteProduct(id: string): Promise<void> {
  await apiClient.delete(`/products/${id}`);
}

async function apiSetProductActive(id: string, active: boolean): Promise<Product> {
  const res = await apiClient.patch<Product>(`/products/${id}/active`, { active });
  return res.data;
}

function formatPriceBRL(value: string | null | undefined): string {
  if (!value) return "-";
  const num = Number(String(value).replace(",", "."));
  if (Number.isNaN(num)) return value;
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function AxisProductsPageContent() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [modalFeedback, setModalFeedback] = useState<Feedback>(null);

  const [search, setSearch] = useState("");
  const [categoryFilterId, setCategoryFilterId] = useState<string | "">("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<Mode>("create");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [unit, setUnit] = useState<Product["unit"]>("UN");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [minStock, setMinStock] = useState("");
  const [productCategoryId, setProductCategoryId] = useState<string | "">("");
  const [ncm, setNcm] = useState("");
  const [cest, setCest] = useState("");
  const [csosn, setCsosn] = useState("");
  const [cfop, setCfop] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    let filtered = [...products];

    if (term) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.sku ?? "").toLowerCase().includes(term),
      );
    }

    if (categoryFilterId) {
      filtered = filtered.filter((p) => p.categoryId === categoryFilterId);
    }

    filtered.sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
    );

    return filtered;
  }, [products, search, categoryFilterId]);

  const loadCategoriesAndProducts = async () => {
    try {
      setIsLoading(true);
      setFeedback(null);
      const [cats, prods] = await Promise.all([
        apiGetCategories(),
        apiGetProducts(),
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch (err) {
      setFeedback({
        kind: "error",
        message: getApiErrorMessage(
          err,
          "Falha ao carregar produtos e categorias.",
        ),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCategoriesAndProducts();
  }, []);

  const resetForm = () => {
    setName("");
    setSku("");
    setBarcode("");
    setUnit("UN");
    setPrice("");
    setCost("");
    setMinStock("");
    setProductCategoryId("");
    setNcm("");
    setCest("");
    setCsosn("");
    setCfop("");
    setImageFile(null);
    setImagePreview(null);
    setEditingProduct(null);
    setIsSubmitting(false);
    setModalFeedback(null);
  };

  const openCreateModal = () => {
    setModalMode("create");
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setModalMode("edit");
    setEditingProduct(product);
    setName(product.name ?? "");
    setSku(product.sku ?? "");
    setBarcode(product.barcode ?? "");
    setUnit(product.unit);
    setPrice(product.price ?? "");
    setCost(product.cost ?? "");
    setMinStock(product.minStock ?? "");
    setProductCategoryId(product.categoryId ?? "");
    setNcm(product.ncm ?? "");
    setCest(product.cest ?? "");
    setCsosn(product.csosn ?? "");
    setCfop(product.cfop ?? "");
    setImageFile(null);
    setImagePreview(buildImageUrl(product.imagePath));
    setModalFeedback(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setImageFile(null);
      setImagePreview(buildImageUrl(editingProduct?.imagePath ?? null));
      return;
    }
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      setModalFeedback({
        kind: "error",
        message: "Informe o nome do produto.",
      });
      return;
    }
    if (!price.trim()) {
      setModalFeedback({
        kind: "error",
        message: "Informe o preço de venda do produto.",
      });
      return;
    }

    const payload: Partial<Product> = {
      name: name.trim(),
      sku: sku.trim() || undefined,
      barcode: barcode.trim() || undefined,
      unit,
      price: price.trim(),
      cost: cost.trim() || undefined,
      minStock: minStock.trim() || undefined,
      categoryId: productCategoryId || undefined,
      ncm: ncm.trim() || undefined,
      cest: cest.trim() || undefined,
      csosn: csosn.trim() || undefined,
      cfop: cfop.trim() || undefined,
    };

    setIsSubmitting(true);
    setModalFeedback(null);

    try {
      if (modalMode === "create") {
        await apiCreateProduct(payload, imageFile);
        setFeedback({
          kind: "success",
          message: "Produto criado com sucesso.",
        });
      } else if (modalMode === "edit" && editingProduct) {
        await apiUpdateProduct(editingProduct.id, payload, imageFile);
        setFeedback({
          kind: "success",
          message: "Produto atualizado com sucesso.",
        });
      }

      closeModal();
      await loadCategoriesAndProducts();
    } catch (err) {
      setModalFeedback({
        kind: "error",
        message: getApiErrorMessage(
          err,
          "Falha ao salvar o produto.",
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSoftDelete = async (
    product: Product,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    if (
      !window.confirm(
        `Deseja realmente desativar o produto "${product.name}"?`,
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      await apiSoftDeleteProduct(product.id);
      setFeedback({
        kind: "success",
        message: "Produto desativado com sucesso.",
      });
      await loadCategoriesAndProducts();
    } catch (err) {
      setFeedback({
        kind: "error",
        message: getApiErrorMessage(
          err,
          "Falha ao desativar o produto.",
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFromModal = async () => {
    if (!editingProduct) return;

    const ok = window.confirm(
      "Voce quer realmente excluir esse produto? Nao podera desfazer essa acao em seguida",
    );
    if (!ok) return;

    setIsSubmitting(true);
    setModalFeedback(null);

    try {
      await apiSoftDeleteProduct(editingProduct.id);
      setFeedback({
        kind: "success",
        message: "Produto excluido com sucesso.",
      });
      closeModal();
      await loadCategoriesAndProducts();
    } catch (err) {
      setModalFeedback({
        kind: "error",
        message: getApiErrorMessage(
          err,
          "Falha ao excluir o produto.",
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (
    product: Product,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();

    const nextActive = !product.isActive;

    if (!nextActive) {
      const ok = window.confirm(
        `Deseja realmente desativar o produto "${product.name}"?`,
      );
      if (!ok) return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const updated = await apiSetProductActive(product.id, nextActive);

      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isActive: updated.isActive } : p)),
      );

      setFeedback({
        kind: "success",
        message: nextActive
          ? "Produto ativado com sucesso."
          : "Produto desativado com sucesso.",
      });
    } catch (err) {
      setFeedback({
        kind: "error",
        message: getApiErrorMessage(
          err,
          "Falha ao atualizar status do produto.",
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryNameById = (id: string | null) => {
    if (!id) return "-";
    const cat = categories.find((c) => c.id === id);
    return cat?.name ?? "-";
  };

  const selectedCategoryIds =
    categoryFilterId && categoryFilterId.length > 0 ? [categoryFilterId] : [];

  const handleToggleCategoryFilter = (id: string) => {
    setCategoryFilterId((prev) => (prev === id ? "" : id));
  };

  return (
    <>
      <div className="axis-products-header">
        <div className="axis-products-title-block">
          <div className="axis-products-title">Produtos</div>
          <div className="axis-products-subtitle">
            Pesquise, cadastre e gerencie todos os produtos do seu catálogo.
          </div>
        </div>

        <div className="axis-products-actions">
          <button
            type="button"
            className="axis-admin-button-primary"
            onClick={openCreateModal}
          >
            ＋ Cadastrar produto
          </button>

          <div className="axis-products-search">
            <SearchBarWithCategoryFilter
              value={search}
              onChange={setSearch}
              filters={categories.map((cat) => ({
                id: cat.id,
                label: cat.name,
              }))}
              selectedIds={selectedCategoryIds}
              onToggleFilter={handleToggleCategoryFilter}
            />
          </div>

          {false && (
            <div className="axis-products-filters">
            <div className="axis-input-search-wrapper">
              <span className="axis-input-search-icon">🔍</span>
              <input
                className="axis-input axis-input-search-product"
                placeholder="Buscar por nome ou SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <label className="axis-label" style={{ minWidth: 160 }}>
              Categoria
              <select
                className="axis-select"
                value={categoryFilterId}
                onChange={(e) => setCategoryFilterId(e.target.value)}
              >
                <option value="">Todas</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </label>
            </div>
          )}
        </div>
      </div>

      <section className="axis-products-list">
        <div className="axis-products-list-header">
          <span>Produto | </span>
          <span>Valor | </span>
          <span>Categoria | </span>
          <span>Unidade | </span>
          <span>Status</span>
        </div>

        <div className="axis-products-list-body">
          {isLoading ? (
            <div className="axis-products-empty">Carregando produtos...</div>
          ) : visibleProducts.length === 0 ? (
            <div className="axis-products-empty">
              Nenhum produto encontrado. Ajuste a busca ou cadastre um novo
              produto.
            </div>
          ) : (
            visibleProducts.map((product) => {
              const letter = product.name.charAt(0).toUpperCase();
              const thumbUrl = buildImageUrl(product.imagePath);
              const priceLabel = formatPriceBRL(product.price);
              const categoryLabel = categoryNameById(product.categoryId);

              return (
                <article
                  key={product.id}
                  className="axis-prodcard-row"
                  onClick={() => openEditModal(product)}
                >
                  <div className="axis-prodcard">
                    <div className="axis-prodcard-image">
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={product.name}
                          loading="lazy"
                        />
                      ) : (
                        <span>{letter}</span>
                      )}
                    </div>

                    <div className="axis-prodcard-info">
                      <div className="axis-prodcard-name">
                        {product.name}
                      </div>
                      <div className="axis-prodcard-price">
                        {priceLabel}{" "}
                        <span>(valor do produto)</span>
                      </div>
                    </div>

                    <div className="axis-prodcard-divider" />

                    <div className="axis-prodcard-category">
                      <div className="axis-prodcard-category-label">
                        Categoria:
                      </div>
                      <div className="axis-prodcard-category-value">
                        {categoryLabel}
                      </div>
                    </div>

                    <div className="axis-prodcard-toggle">
                      <button
                        type="button"
                        className="axis-prodcard-toggle-button"
                        onClick={(event) => handleToggleActive(product, event)}
                      >
                        <div
                          className={
                            "axis-toggle-pill" +
                            (product.isActive
                              ? " axis-toggle-pill--active"
                              : "")
                          }
                        >
                          <div className="axis-toggle-pill-dot" />
                        </div>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {feedback && (
        <p
          className={`axis-feedback ${
            feedback.kind === "error" ? "axis-error" : "axis-success"
          }`}
        >
          {feedback.message}
        </p>
      )}

      {modalOpen && (
        <div className="axis-modal-backdrop">
          <div className="axis-modal">
            <div className="axis-modal-header">
              <div>
                <div className="axis-modal-title">
                  {modalMode === "create"
                    ? "Cadastrar produto"
                    : `Editar produto: ${editingProduct?.name}`}
                </div>
                <div className="axis-modal-subtitle">
                  Informe os dados fiscais, de preço e categoria. A imagem é
                  opcional.
                </div>
              </div>
              <button
                className="axis-modal-close"
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
              >
                ×
              </button>
            </div>

            <div className="axis-modal-body">
              {modalFeedback && (
                <div className="axis-modal-alert axis-modal-alert-error">
                  <span className="axis-modal-alert-icon">!</span>
                  <span>{modalFeedback.message}</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="axis-modal-grid">
                  <div className="axis-modal-section">
                    <label className="axis-label">
                      Nome do produto
                      <input
                        type="text"
                        className="axis-input"
                        placeholder="Ex.: Refrigerante Lata 350ml"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </label>

                    <div className="axis-input-row">
                      <label className="axis-label">
                        SKU
                        <input
                          type="text"
                          className="axis-input"
                          placeholder="REF-LATA-350"
                          value={sku}
                          onChange={(e) => setSku(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </label>

                      <label className="axis-label">
                        Código de barras
                        <input
                          type="text"
                          className="axis-input"
                          placeholder="7890000000000"
                          value={barcode}
                          onChange={(e) => setBarcode(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </label>
                    </div>

                    <div className="axis-input-row">
                      <label className="axis-label">
                        Unidade
                        <select
                          className="axis-select"
                          value={unit}
                          onChange={(e) =>
                            setUnit(e.target.value as Product["unit"])
                          }
                          disabled={isSubmitting}
                        >
                          <option value="UN">UN</option>
                          <option value="CX">CX</option>
                          <option value="KG">KG</option>
                          <option value="LT">LT</option>
                          <option value="GR">GR</option>
                          <option value="ML">ML</option>
                          <option value="PC">PC</option>
                        </select>
                      </label>

                      <label className="axis-label">
                        Categoria
                        <select
                          className="axis-select"
                          value={productCategoryId}
                          onChange={(e) =>
                            setProductCategoryId(e.target.value)
                          }
                          disabled={isSubmitting}
                        >
                          <option value="">Selecione...</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="axis-input-row">
                      <label className="axis-label">
                        Preço de venda
                        <input
                          type="text"
                          className="axis-input"
                          placeholder="4,99"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </label>

                      <label className="axis-label">
                        Custo
                        <input
                          type="text"
                          className="axis-input"
                          placeholder="3,10"
                          value={cost}
                          onChange={(e) => setCost(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </label>
                    </div>

                    <div className="axis-input-row">
                      <label className="axis-label">
                        Estoque mínimo
                        <input
                          type="text"
                          className="axis-input"
                          placeholder="10,000"
                          value={minStock}
                          onChange={(e) => setMinStock(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </label>

                      <label className="axis-label">
                        NCM
                        <input
                          type="text"
                          className="axis-input"
                          placeholder="2202.10.00"
                          value={ncm}
                          onChange={(e) => setNcm(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </label>
                    </div>

                    <div className="axis-input-row">
                      <label className="axis-label">
                        CEST
                        <input
                          type="text"
                          className="axis-input"
                          placeholder="03.001.00"
                          value={cest}
                          onChange={(e) => setCest(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </label>

                      <label className="axis-label">
                        CSOSN
                        <input
                          type="text"
                          className="axis-input"
                          placeholder="102"
                          value={csosn}
                          onChange={(e) => setCsosn(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </label>
                    </div>

                    <div className="axis-input-row">
                      <label className="axis-label">
                        CFOP
                        <input
                          type="text"
                          className="axis-input"
                          placeholder="5102"
                          value={cfop}
                          onChange={(e) => setCfop(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </label>
                      <div />
                    </div>
                  </div>

                  <div className="axis-modal-section">
                    <label className="axis-label">
                      Imagem do produto
                      <div className="axis-file-drop">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          disabled={isSubmitting}
                        />
                        <span>
                          Clique para selecionar uma imagem ou arraste um
                          arquivo aqui.
                        </span>
                        <small>Formatos comuns: JPG, PNG.</small>
                      </div>
                    </label>

                    <div className="axis-file-preview-wrapper">
                      <span className="axis-label">Pré-visualização</span>
                      <div className="axis-file-preview">
                        {imagePreview ? (
                          <img
                            src={imagePreview}
                            alt="Preview do produto"
                          />
                        ) : editingProduct?.imagePath ? (
                          <img
                            src={
                              buildImageUrl(editingProduct.imagePath) ??
                              undefined
                            }
                            alt={editingProduct.name}
                          />
                        ) : (
                          <span className="axis-file-preview-placeholder">
                            Nenhuma imagem selecionada.
                            <br />
                            O servidor usará um placeholder genérico.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  </div>

                <div className="axis-form-actions">
                  {modalMode === "edit" && editingProduct && (
                    <button
                      type="button"
                      className="axis-button-secondary axis-button-danger"
                      onClick={handleDeleteFromModal}
                      disabled={isSubmitting}
                    >
                      Excluir
                    </button>
                  )}
                  <button
                    type="button"
                    className="axis-button-secondary"
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
                    {isSubmitting
                      ? "Salvando..."
                      : modalMode === "create"
                        ? "Salvar produto"
                        : "Salvar alteracoes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AxisProductsPageContent;

