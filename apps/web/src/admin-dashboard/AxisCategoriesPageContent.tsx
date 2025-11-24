import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type Category,
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "../services/api";

type Feedback = { kind: "error" | "success"; message: string } | null;
type Mode = "create" | "edit";

const assetsBaseUrl =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_ASSETS_BASE_URL
    ? String(import.meta.env.VITE_ASSETS_BASE_URL)
    : "";

const buildImageUrl = (path?: string | null): string | null => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;

  if (!assetsBaseUrl) {
    // Sem base configurada, devolve o caminho cru (para debug)
    return path;
  }

  const base = assetsBaseUrl.replace(/\/$/, "");
  const cleanPath = path.replace(/^\//, "");
  return `${base}/${cleanPath}`;
};

export function AxisCategoriesPageContent() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<Mode>("create");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [name, setName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCategories = async () => {
    try {
      setIsLoading(true);
      const data = await listCategories();
      setCategories(data);
    } catch (err) {
      setFeedback({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "Falha ao carregar categorias.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter((cat) =>
      cat.name.toLowerCase().includes(term),
    );
  }, [categories, search]);

  const resetForm = () => {
    setName("");
    setImageFile(null);
    setImagePreview(null);
    setEditingCategory(null);
    setIsSubmitting(false);
  };

  const openCreateModal = () => {
    setModalMode("create");
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setModalMode("edit");
    setEditingCategory(category);
    setName(category.name);
    setImageFile(null);
    setImagePreview(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      const message = "Informe o nome da categoria.";
      setFeedback({
        kind: "error",
        message,
      });
      window.alert(message);
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      if (modalMode === "create") {
        await createCategory(name.trim(), imageFile);
        setFeedback({
          kind: "success",
          message: "Categoria criada com sucesso.",
        });
      } else if (modalMode === "edit" && editingCategory) {
        await updateCategory(editingCategory.id, {
          name: name.trim(),
          imageFile,
        });
        setFeedback({
          kind: "success",
          message: "Categoria atualizada com sucesso.",
        });
      }
      closeModal();
      await loadCategories();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Falha ao salvar a categoria.";
      setFeedback({
        kind: "error",
        message,
      });
      window.alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingCategory) return;
    if (!confirm(`Excluir categoria "${editingCategory.name}"?`)) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      await deleteCategory(editingCategory.id);
      setFeedback({
        kind: "success",
        message: "Categoria excluída com sucesso.",
      });
      closeModal();
      await loadCategories();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Falha ao excluir a categoria.";
      setFeedback({
        kind: "error",
        message,
      });
      window.alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="axis-categories-header">
        <div className="axis-categories-title-block">
          <div className="axis-categories-title">Categorias</div>
          <div className="axis-categories-subtitle">
            Pesquise, crie e gerencie todas as categorias da sua loja.
          </div>
        </div>
        <div className="axis-categories-actions">
          <input
            className="axis-input axis-input-search"
            placeholder="Buscar por nome da categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className="axis-admin-button-icon"
            onClick={openCreateModal}
          >
            <span>＋</span>
            <span>Nova categoria</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="axis-category-empty">Carregando categorias...</p>
      ) : filteredCategories.length === 0 ? (
        <p className="axis-category-empty">
          Nenhuma categoria encontrada. Crie uma nova categoria para começar.
        </p>
      ) : (
        <section className="axis-categories-grid">
          {filteredCategories.map((category) => {
            const letter = category.name.charAt(0).toUpperCase();
            const updatedAt = new Date(category.updatedAt);
            const imageUrl = buildImageUrl(category.imagePath);
            return (
              <article
                key={category.id}
                className="axis-category-card"
                onClick={() => openEditModal(category)}
              >
                <div className="axis-category-image">
                  {imageUrl ? (
                    <img src={imageUrl} alt={category.name} />
                  ) : (
                    <span>{letter}</span>
                  )}
                </div>
                <div className="axis-category-name">{category.name}</div>
                <div className="axis-category-meta">
                
                  <span>
                    Atualizado em{" "}
                    {Number.isNaN(updatedAt.getTime())
                      ? "-"
                      : updatedAt.toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </article>
            );
          })}
        </section>
      )}

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
              <div className="axis-modal-title">
                {modalMode === "create"
                  ? "Nova categoria"
                  : `Editar categoria: ${editingCategory?.name}`}
              </div>
              <button
                type="button"
                className="axis-modal-close"
                onClick={closeModal}
                disabled={isSubmitting}
              >
                ×
              </button>
            </div>

            <div className="axis-modal-body">
              <form onSubmit={handleSubmit}>
                <label className="axis-label">
                  Nome da categoria
                  <input
                    type="text"
                    className="axis-input"
                    placeholder="Ex.: Padaria, Bebidas, Frios..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isSubmitting}
                  />
                </label>

                <div className="axis-form-grid">
                  <div>
                    <label className="axis-label">
                      Imagem (opcional)
                      <div className="axis-file-drop">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          disabled={isSubmitting}
                        />
                        <span>
                          Clique para selecionar uma imagem ou arraste um
                          arquivo aqui.
                        </span>
                        <small>Formatos comuns: JPG, PNG.</small>
                      </div>
                    </label>
                  </div>

                  <div className="axis-file-preview-wrapper">
                    <span className="axis-label">Pré-visualização</span>
                    <div className="axis-file-preview">
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview da categoria" />
                      ) : editingCategory?.imagePath ? (
                        <img
                          src={editingCategory.imagePath}
                          alt={editingCategory.name}
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

                <div className="axis-form-actions">
                  {modalMode === "edit" && (
                    <button
                      type="button"
                      className="axis-admin-button-secondary"
                      onClick={handleDelete}
                      disabled={isSubmitting}
                    >
                      Excluir
                    </button>
                  )}
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
                    {isSubmitting
                      ? "Salvando..."
                      : modalMode === "create"
                        ? "Criar categoria"
                        : "Salvar alterações"}
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

export default AxisCategoriesPageContent;
