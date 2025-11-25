import axios, { type AxiosError } from "axios";
import type { FormEvent, MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AxisSearchInput } from "../../components/elements/AxisSearchInput";
import { apiClient } from "../../services/http";
import ClientsLogoIcon from "./ClientsLogoIcon";

type Customer = {
  id: string;
  name: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  allowCredit: boolean;
  creditLimit?: string | null;
  defaultDueDays?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type Mode = "create" | "edit";
type Feedback = { kind: "success" | "error"; message: string } | null;

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

type CreateCustomerPayload = {
  name: string;
  document?: string;
  phone?: string;
  email?: string;
  address?: string;
  allowCredit?: boolean;
  creditLimit?: string;
  defaultDueDays?: number;
  isActive?: boolean;
};

type UpdateCustomerPayload = Partial<CreateCustomerPayload>;

const DEFAULT_CREDIT_LIMIT = "1000.00";
const customersBasePath = "/customers";

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

    if (status === 400) return "Dados invalidos. Verifique e tente novamente.";
    if (status === 401) return "Sessao expirada. Faca login novamente.";
    if (status === 403) return "Sem permissao para essa acao.";
    if (status === 404) return "Cliente nao encontrado.";
    if (status === 500) return "Erro interno. Tente novamente em instantes.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

async function apiListCustomers(): Promise<Customer[]> {
  const res = await apiClient.get<Customer[]>(customersBasePath);
  return res.data;
}

async function apiCreateCustomer(payload: CreateCustomerPayload): Promise<Customer> {
  const res = await apiClient.post<Customer>(customersBasePath, payload);
  return res.data;
}

async function apiUpdateCustomer(id: string, payload: UpdateCustomerPayload): Promise<Customer> {
  const res = await apiClient.patch<Customer>(`${customersBasePath}/${id}`, payload);
  return res.data;
}

async function apiDeleteCustomer(id: string): Promise<void> {
  await apiClient.delete(`${customersBasePath}/${id}`);
}

export function AxisClientsPageContent() {
  const [clients, setClients] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<Mode>("create");
  const [editingClient, setEditingClient] = useState<Customer | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [address, setAddress] = useState("");
  const [allowCredit, setAllowCredit] = useState(false);
  const [creditLimit, setCreditLimit] = useState(DEFAULT_CREDIT_LIMIT);
  const [defaultDueDays, setDefaultDueDays] = useState("");
  const [isActiveField, setIsActiveField] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<Feedback>(null);
  const [search, setSearch] = useState("");

  const visibleClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = clients
      .filter((client) => {
        if (!term) return true;
        return (
          client.name.toLowerCase().includes(term) ||
          (client.email ?? "").toLowerCase().includes(term) ||
          (client.phone ?? "").toLowerCase().includes(term) ||
          (client.document ?? "").toLowerCase().includes(term) ||
          client.id.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

    return filtered;
  }, [clients, search]);

  const loadCustomers = useCallback(async () => {
    try {
      setIsLoading(true);
      setFeedback(null);
      const list = await apiListCustomers();
      setClients(list);
    } catch (err) {
      setFeedback({
        kind: "error",
        message: getApiErrorMessage(err, "Falha ao carregar clientes."),
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setDocument("");
    setAddress("");
    setAllowCredit(false);
    setCreditLimit(DEFAULT_CREDIT_LIMIT);
    setDefaultDueDays("");
    setIsActiveField(true);
    setIsSubmitting(false);
    setModalFeedback(null);
    setEditingClient(null);
  };

  const openCreateModal = () => {
    setModalMode("create");
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (client: Customer) => {
    setModalMode("edit");
    setEditingClient(client);
    setName(client.name);
    setEmail(client.email ?? "");
    setPhone(client.phone ?? "");
    setDocument(client.document ?? "");
    setAddress(client.address ?? "");
    setAllowCredit(client.allowCredit);
    setCreditLimit(client.creditLimit ?? DEFAULT_CREDIT_LIMIT);
    setDefaultDueDays(
      typeof client.defaultDueDays === "number" ? String(client.defaultDueDays) : "",
    );
    setIsActiveField(client.isActive);
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
    const trimmedPhone = phone.trim();
    const trimmedDocument = document.trim();
    const trimmedAddress = address.trim();
    const trimmedCreditLimit = creditLimit.trim();
    const dueDaysRaw = defaultDueDays.trim();
    const dueDays =
      dueDaysRaw === "" ? null : Number.isNaN(Number(dueDaysRaw)) ? NaN : Number(dueDaysRaw);

    if (!trimmedName || trimmedName.length < 3) {
      setModalFeedback({
        kind: "error",
        message: "Informe o nome do cliente (minimo 3 caracteres).",
      });
      return;
    }

    if (trimmedEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
      setModalFeedback({ kind: "error", message: "Email invalido." });
      return;
    }

    if (dueDaysRaw !== "") {
      if (Number.isNaN(dueDays) || !Number.isInteger(dueDays) || dueDays < 0 || dueDays > 180) {
        setModalFeedback({
          kind: "error",
          message: "Dias para vencimento deve ser um inteiro entre 0 e 180.",
        });
        return;
      }
    }

    const normalizedCreditLimit =
      allowCredit && trimmedCreditLimit === "" ? DEFAULT_CREDIT_LIMIT : trimmedCreditLimit;

    setIsSubmitting(true);
    setModalFeedback(null);

    try {
      if (modalMode === "create") {
        const payload: CreateCustomerPayload = {
          name: trimmedName,
          document: trimmedDocument || undefined,
          phone: trimmedPhone || undefined,
          email: trimmedEmail || undefined,
          address: trimmedAddress || undefined,
          allowCredit,
          creditLimit: allowCredit
            ? normalizedCreditLimit || DEFAULT_CREDIT_LIMIT
            : undefined,
          defaultDueDays: dueDaysRaw === "" ? undefined : (dueDays as number),
          isActive: isActiveField,
        };

        const created = await apiCreateCustomer(payload);
        setFeedback({ kind: "success", message: "Cliente cadastrado com sucesso." });
        setClients((prev) => [...prev, created]);
      } else if (modalMode === "edit" && editingClient) {
        const payload: UpdateCustomerPayload = {
          name: trimmedName,
          document: trimmedDocument || undefined,
          phone: trimmedPhone || undefined,
          email: trimmedEmail || undefined,
          address: trimmedAddress || undefined,
          allowCredit,
          creditLimit: allowCredit
            ? normalizedCreditLimit || DEFAULT_CREDIT_LIMIT
            : undefined,
          defaultDueDays: dueDaysRaw === "" ? undefined : (dueDays as number),
          isActive: isActiveField,
        };

        const updated = await apiUpdateCustomer(editingClient.id, payload);
        setFeedback({ kind: "success", message: "Cliente atualizado com sucesso." });
        setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }

      closeModal();
    } catch (err) {
      setModalFeedback({
        kind: "error",
        message: getApiErrorMessage(err, "Falha ao salvar o cliente."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (
    client: Customer,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    const nextActive = !client.isActive;
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const updated = await apiUpdateCustomer(client.id, { isActive: nextActive });
      setClients((prev) => prev.map((c) => (c.id === client.id ? updated : c)));
      setFeedback({
        kind: "success",
        message: nextActive ? "Cliente ativado." : "Cliente inativado.",
      });
    } catch (err) {
      setFeedback({
        kind: "error",
        message: getApiErrorMessage(err, "Falha ao atualizar status do cliente."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingClient) return;
    const ok = window.confirm(
      `Deseja realmente excluir o cliente "${editingClient.name}"? Esta acao nao pode ser desfeita.`,
    );
    if (!ok) return;

    setIsSubmitting(true);
    setModalFeedback(null);

    try {
      await apiDeleteCustomer(editingClient.id);
      setClients((prev) => prev.filter((c) => c.id !== editingClient.id));
      setFeedback({ kind: "success", message: "Cliente excluido com sucesso." });
      closeModal();
    } catch (err) {
      setModalFeedback({
        kind: "error",
        message: getApiErrorMessage(err, "Falha ao excluir o cliente."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="axis-products-header">
        <div className="axis-products-title-block">
          <div className="axis-products-title">Clientes</div>
          <div className="axis-products-subtitle">
            Pesquise, cadastre e gerencie seus clientes.
          </div>
        </div>

        <div className="axis-products-actions">
          <button
            type="button"
            className="axis-admin-button-primary"
            onClick={openCreateModal}
            disabled={isSubmitting}
          >
            + Cadastrar cliente
          </button>

          <div className="axis-products-search">
            <div className="axis-search-wrapper">
              <div className="axis-search-bar">
                <AxisSearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder=" Pesquise por nome, documento, telefone ou email..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="axis-products-list">
        <div className="axis-products-list-header">
          <span>Cliente | </span>
          <span>Contato | </span>
          <span>Credito | </span>
          <span>Status</span>
        </div>

        <div className="axis-products-list-body">
          {isLoading ? (
            <div className="axis-products-empty">Carregando clientes...</div>
          ) : visibleClients.length === 0 ? (
            <div className="axis-products-empty">
              Nenhum cliente encontrado. Ajuste a busca ou cadastre um novo cliente.
            </div>
          ) : (
            visibleClients.map((client) => {
              return (
                <article
                  key={client.id}
                  className="axis-prodcard-row"
                  onClick={() => openEditModal(client)}
                >
                  <div className="axis-prodcard">
                    <div className="axis-prodcard-image">
                      <ClientsLogoIcon size={24} />
                    </div>

                    <div className="axis-prodcard-info">
                      <div className="axis-prodcard-name">{client.name}</div>
                      <div className="axis-prodcard-price">
                        {client.email || "Sem email"}{" "}
                        <span>{client.phone ? `(${client.phone})` : ""}</span>
                      </div>
                      <div className="axis-prodcard-price">
                        {client.document || "Sem documento"}
                      </div>
                    </div>

                    <div className="axis-prodcard-divider" />

                    <div className="axis-prodcard-category">
                      <div className="axis-prodcard-category-label">
                        Credito / Vencimento:
                      </div>
                      <div className="axis-prodcard-category-value">
                        {client.allowCredit
                          ? `R$ ${client.creditLimit ?? DEFAULT_CREDIT_LIMIT} / ${
                              client.defaultDueDays ?? 0
                            }d`
                          : "Sem credito"}
                      </div>
                      {client.address && (
                        <div className="axis-prodcard-category-value" style={{ opacity: 0.8 }}>
                          {client.address}
                        </div>
                      )}
                    </div>

                    <div className="axis-prodcard-toggle">
                      <button
                        type="button"
                        className="axis-prodcard-toggle-button"
                        onClick={(event) => handleToggleActive(client, event)}
                        disabled={isSubmitting}
                      >
                        <div
                          className={
                            "axis-toggle-pill" +
                            (client.isActive ? " axis-toggle-pill--active" : "")
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
                    ? "Cadastrar cliente"
                    : `Editar cliente: ${editingClient?.name ?? ""}`}
                </div>
                <div className="axis-modal-subtitle">
                  Informe os dados basicos do cliente.
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
                      placeholder="email@cliente.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </label>
                </div>

                <div className="axis-input-row">
                  <label className="axis-label">
                    Telefone
                    <input
                      type="text"
                      className="axis-input"
                      placeholder="(99) 99999-9999"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </label>

                  <label className="axis-label">
                    Documento
                    <input
                      type="text"
                      className="axis-input"
                      placeholder="CPF/CNPJ"
                      value={document}
                      onChange={(e) => setDocument(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </label>
                </div>

                <label className="axis-label">
                  Endereco
                  <input
                    type="text"
                    className="axis-input"
                    placeholder="Rua, numero, bairro, cidade"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={isSubmitting}
                  />
                </label>

                <div className="axis-input-row">
                  <label className="axis-label">
                    Permitir credito
                    <select
                      className="axis-select"
                      value={allowCredit ? "yes" : "no"}
                      onChange={(e) => setAllowCredit(e.target.value === "yes")}
                      disabled={isSubmitting}
                    >
                      <option value="no">Nao</option>
                      <option value="yes">Sim</option>
                    </select>
                  </label>

                  <label className="axis-label">
                    Limite de credito (R$)
                    <input
                      type="text"
                      className="axis-input"
                      placeholder="1000.00"
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(e.target.value)}
                      disabled={isSubmitting || !allowCredit}
                    />
                  </label>
                </div>

                <div className="axis-input-row">
                  <label className="axis-label">
                    Dias padrao para vencimento
                    <input
                      type="number"
                      className="axis-input"
                      placeholder="0 a 180 dias"
                      min={0}
                      max={180}
                      value={defaultDueDays}
                      onChange={(e) => setDefaultDueDays(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </label>

                  <div />
                </div>

                <label className="axis-label">
                  Status
                  <select
                    className="axis-select"
                    value={isActiveField ? "active" : "inactive"}
                    onChange={(e) => setIsActiveField(e.target.value === "active")}
                    disabled={isSubmitting}
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </label>

                <div className="axis-form-actions">
                  {modalMode === "edit" ? (
                    <button
                      type="button"
                      className="axis-button-secondary axis-button-danger"
                      onClick={handleDelete}
                      disabled={isSubmitting}
                    >
                      Excluir cliente
                    </button>
                  ) : (
                    <div />
                  )}
                  <div style={{ display: "flex", gap: "0.5rem" }}>
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
                          ? "Salvar cliente"
                          : "Salvar alteracoes"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AxisClientsPageContent;
