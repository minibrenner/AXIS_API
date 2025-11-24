import type { FormEvent, MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import axios, { type AxiosError } from "axios";
import { apiClient } from "../services/http";
import { AxisSearchInput } from "../components/elements/AxisSearchInput";
import { type AxisRole, getTenantId } from "../auth/session";
import "./search-bar-with-filter.css";

export type TenantUser = {
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  role: AxisRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  passwordUpdatedAt: string;
  hasSupervisorPin: boolean;
  cpf?: string | null;
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
      return "Erro interno ao processar o usuario. Tente novamente em instantes.";
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function getUsersBasePath(): string {
  const tenantId = getTenantId();
  if (!tenantId) {
    throw new Error("Tenant nao identificado. Faca login novamente.");
  }
  return `/t/${tenantId}/users`;
}

async function apiGetUsers(): Promise<TenantUser[]> {
  const basePath = getUsersBasePath();
  const res = await apiClient.get<TenantUser[]>(basePath);
  return res.data;
}

type CreateUserPayload = {
  email: string;
  password: string;
  name?: string;
  role?: AxisRole;
  isActive?: boolean;
  mustChangePassword?: boolean;
  cpf?: string;
};

async function apiCreateUser(data: CreateUserPayload): Promise<TenantUser> {
  const basePath = getUsersBasePath();
  const res = await apiClient.post<TenantUser>(basePath, data);
  return res.data;
}

type UpdateUserPayload = {
  email?: string;
  password?: string;
  name?: string;
  role?: AxisRole;
  isActive?: boolean;
  mustChangePassword?: boolean;
  cpf?: string;
};

async function apiUpdateUser(id: string, data: UpdateUserPayload): Promise<TenantUser> {
  const basePath = getUsersBasePath();
  const res = await apiClient.put<TenantUser>(`${basePath}/${id}`, data);
  return res.data;
}

export function AxisUsersPageContent() {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [modalFeedback, setModalFeedback] = useState<Feedback>(null);

  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<Mode>("create");
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [role, setRole] = useState<AxisRole>("ATTENDANT");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isActiveField, setIsActiveField] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    let filtered = [...users];

    if (term) {
      filtered = filtered.filter((user) => {
        const nameValue = (user.name ?? "").toLowerCase();
        const emailValue = user.email.toLowerCase();
        const idValue = user.id.toLowerCase();
        const cpfValue = (user.cpf ?? "").toLowerCase();
        return (
          nameValue.includes(term) ||
          emailValue.includes(term) ||
          idValue.includes(term) ||
          cpfValue.includes(term)
        );
      });
    }

    filtered.sort((a, b) => {
      const aLabel = (a.name || a.email).toLowerCase();
      const bLabel = (b.name || b.email).toLowerCase();
      return aLabel.localeCompare(bLabel, "pt-BR", { sensitivity: "base" });
    });

    return filtered;
  }, [users, search]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      setFeedback(null);
      const list = await apiGetUsers();
      setUsers(list);
    } catch (err) {
      setFeedback({
        kind: "error",
        message: getApiErrorMessage(err, "Falha ao carregar usuarios."),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const resetForm = () => {
    setName("");
    setEmail("");
    setCpf("");
    setRole("ATTENDANT");
    setPassword("");
    setPasswordConfirm("");
    setIsActiveField(true);
    setMustChangePassword(true);
    setEditingUser(null);
    setIsSubmitting(false);
    setModalFeedback(null);
  };

  const openCreateModal = () => {
    setModalMode("create");
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (user: TenantUser) => {
    setModalMode("edit");
    setEditingUser(user);
    setName(user.name ?? "");
    setEmail(user.email);
    setCpf(user.cpf ?? "");
    setRole(user.role);
    setPassword("");
    setPasswordConfirm("");
    setIsActiveField(user.isActive);
    setMustChangePassword(user.mustChangePassword);
    setModalFeedback(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedPasswordConfirm = passwordConfirm.trim();
    const cpfDigits = cpf.replace(/\D/g, "");

    if (!trimmedName) {
      setModalFeedback({
        kind: "error",
        message: "Informe o nome do usuario.",
      });
      return;
    }

    if (!trimmedEmail) {
      setModalFeedback({
        kind: "error",
        message: "Informe o email do usuario.",
      });
      return;
    }

    if (modalMode === "create") {
      if (!trimmedPassword) {
        setModalFeedback({
          kind: "error",
          message: "Informe uma senha inicial para o usuario.",
        });
        return;
      }
      if (trimmedPassword.length < 6) {
        setModalFeedback({
          kind: "error",
          message: "A senha deve ter pelo menos 6 caracteres.",
        });
        return;
      }
      if (trimmedPasswordConfirm && trimmedPasswordConfirm !== trimmedPassword) {
        setModalFeedback({
          kind: "error",
          message: "A confirmacao de senha nao confere.",
        });
        return;
      }
    } else if (modalMode === "edit" && trimmedPassword) {
      if (trimmedPassword.length < 6) {
        setModalFeedback({
          kind: "error",
          message: "A nova senha deve ter pelo menos 6 caracteres.",
        });
        return;
      }
      if (trimmedPasswordConfirm && trimmedPasswordConfirm !== trimmedPassword) {
        setModalFeedback({
          kind: "error",
          message: "A confirmacao de senha nao confere.",
        });
        return;
      }
    }

    if (cpfDigits && cpfDigits.length !== 11) {
      setModalFeedback({
        kind: "error",
        message: "CPF deve ter 11 digitos (somente numeros).",
      });
      return;
    }

    setIsSubmitting(true);
    setModalFeedback(null);

    try {
      if (modalMode === "create") {
        const payload: CreateUserPayload = {
          email: trimmedEmail,
          password: trimmedPassword,
          name: trimmedName,
          role,
          isActive: isActiveField,
          mustChangePassword,
        };
        if (cpfDigits) {
          payload.cpf = cpfDigits;
        }

        await apiCreateUser(payload);
        setFeedback({
          kind: "success",
          message: "Usuario criado com sucesso.",
        });
      } else if (modalMode === "edit" && editingUser) {
        const payload: UpdateUserPayload = {
          email: trimmedEmail,
          name: trimmedName,
          role,
          isActive: isActiveField,
          mustChangePassword,
        };

        if (trimmedPassword) {
          payload.password = trimmedPassword;
        }
        if (cpfDigits) {
          payload.cpf = cpfDigits;
        }

        await apiUpdateUser(editingUser.id, payload);
        setFeedback({
          kind: "success",
          message: "Usuario atualizado com sucesso.",
        });
      }

      closeModal();
      await loadUsers();
    } catch (err) {
      setModalFeedback({
        kind: "error",
        message: getApiErrorMessage(err, "Falha ao salvar o usuario."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (
    user: TenantUser,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();

    const nextActive = !user.isActive;

    if (!nextActive) {
      const ok = window.confirm(
        `Deseja realmente desativar o usuario "${user.name || user.email}"?`,
      );
      if (!ok) return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const updated = await apiUpdateUser(user.id, { isActive: nextActive });

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: updated.isActive } : u)),
      );

      setFeedback({
        kind: "success",
        message: nextActive
          ? "Usuario ativado com sucesso."
          : "Usuario desativado com sucesso.",
      });
    } catch (err) {
      setFeedback({
        kind: "error",
        message: getApiErrorMessage(
          err,
          "Falha ao atualizar status do usuario.",
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="axis-products-header">
        <div className="axis-products-title-block">
          <div className="axis-products-title">Usuarios</div>
          <div className="axis-products-subtitle">
            Pesquise, cadastre e gerencie os usuarios com acesso ao sistema.
          </div>
        </div>

        <div className="axis-products-actions">
          <button
            type="button"
            className="axis-admin-button-primary"
            onClick={openCreateModal}
          >
            + Cadastrar usuario
          </button>

          <div className="axis-products-search">
            <div className="axis-search-wrapper">
              <div className="axis-search-bar">
                <AxisSearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder=" Pesquise por nome, ID, CPF ou email..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="axis-products-list">
        <div className="axis-products-list-header">
          <span>Usuario</span>
          <span>Email</span>
          <span>Funcao</span>
          <span>Status</span>
        </div>

        <div className="axis-products-list-body">
          {isLoading ? (
            <div className="axis-products-empty">Carregando usuarios...</div>
          ) : visibleUsers.length === 0 ? (
            <div className="axis-products-empty">
              Nenhum usuario encontrado. Ajuste a busca ou cadastre um novo
              usuario.
            </div>
          ) : (
            visibleUsers.map((user) => {
              const letter = (user.name || user.email).charAt(0).toUpperCase();
              const statusLabel = user.isActive ? "Ativo" : "Inativo";

              return (
                <article
                  key={user.id}
                  className="axis-prodcard-row"
                  onClick={() => openEditModal(user)}
                >
                  <div className="axis-prodcard">
                    <div className="axis-prodcard-image">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="9" r="3" fill="#ffffff" />
                        <path
                          d="M6 18c1-2.6 3-4.2 6-4.2s5 1.6 6 4.2"
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>

                    <div className="axis-prodcard-info">
                      <div className="axis-prodcard-name">
                        {user.name || user.email || letter}
                      </div>
                      <div className="axis-prodcard-price">
                        {user.email} <span>({user.role})</span>
                      </div>
                    </div>

                    <div className="axis-prodcard-divider" />

                    <div className="axis-prodcard-category">
                      <div className="axis-prodcard-category-label">
                        Status:
                      </div>
                      <div className="axis-prodcard-category-value">
                        {statusLabel}
                      </div>
                    </div>

                    <div className="axis-prodcard-toggle">
                      <button
                        type="button"
                        className="axis-prodcard-toggle-button"
                        onClick={(event) => handleToggleActive(user, event)}
                      >
                        <div
                          className={
                            "axis-toggle-pill" +
                            (user.isActive
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
                    ? "Cadastrar usuario"
                    : `Editar usuario: ${editingUser?.name ?? editingUser?.email ?? ""}`}
                </div>
                <div className="axis-modal-subtitle">
                  Informe os dados basicos do usuario. A senha inicial e obrigatoria apenas na criacao.
                </div>
              </div>
              <button
                className="axis-modal-close"
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
              >
                X
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
                <div className="axis-input-row">
                  <label className="axis-label">
                    Nome
                    <input
                      type="text"
                      className="axis-input"
                      placeholder="Nome completo"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </label>

                  <label className="axis-label">
                    Email
                    <input
                      type="email"
                      className="axis-input"
                      placeholder="email@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </label>
                </div>

                <div className="axis-input-row">
                  <label className="axis-label">
                    Funcao (ROLE)
                    <select
                      className="axis-select"
                      value={role}
                      onChange={(e) => setRole(e.target.value as AxisRole)}
                      disabled={isSubmitting}
                    >
                      <option value="OWNER">OWNER</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="ATTENDANT">ATTENDANT</option>
                    </select>
                  </label>

                  <label className="axis-label">
                    Status
                    <select
                      className="axis-select"
                      value={isActiveField ? "active" : "inactive"}
                      onChange={(e) =>
                        setIsActiveField(e.target.value === "active")
                      }
                      disabled={isSubmitting}
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </label>
                </div>

                <label className="axis-label">
                  CPF (opcional)
                  <input
                    type="text"
                    className="axis-input"
                    placeholder="Somente numeros"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    disabled={isSubmitting}
                  />
                </label>

                <div className="axis-input-row">
                  <label className="axis-label">
                    Senha inicial{" "}
                    {modalMode === "edit" && (
                      <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                        (preencha apenas para alterar a senha)
                      </span>
                    )}
                    <input
                      type="password"
                      className="axis-input"
                      placeholder={
                        modalMode === "create"
                          ? "Minimo 6 caracteres"
                          : "Deixe em branco para nao alterar"
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </label>

                  <label className="axis-label">
                    Confirmar senha
                    <input
                      type="password"
                      className="axis-input"
                      placeholder="Repita a senha"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </label>
                </div>

                <label className="axis-label">
                  Obrigatorio trocar senha no proximo acesso?
                  <select
                    className="axis-select"
                    value={mustChangePassword ? "yes" : "no"}
                    onChange={(e) =>
                      setMustChangePassword(e.target.value === "yes")
                    }
                    disabled={isSubmitting}
                  >
                    <option value="yes">Sim</option>
                    <option value="no">Nao</option>
                  </select>
                </label>

                <div className="axis-form-actions">
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
                        ? "Salvar usuario"
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

export default AxisUsersPageContent;


