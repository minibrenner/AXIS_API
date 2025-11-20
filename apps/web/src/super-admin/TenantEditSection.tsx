import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  fetchTenantsAsSuperAdmin,
  Tenant,
  updateTenantAsSuperAdmin,
} from "../services/api";

type TenantEditState = {
  search: string;
  tenants: Tenant[];
  selectedTenant: Tenant | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  modalFeedback: string | null;
  editName: string;
  editEmail: string;
  editCnpj: string;
  editCpfResLoja: string;
  editIsActive: boolean;
  editMaxOpenCashSessions: string;
  editPassword: string;
};

export function TenantEditSection() {
  const [state, setState] = useState<TenantEditState>({
    search: "",
    tenants: [],
    selectedTenant: null,
    isLoading: false,
    isSaving: false,
    error: null,
    modalFeedback: null,
    editName: "",
    editEmail: "",
    editCnpj: "",
    editCpfResLoja: "",
    editIsActive: true,
    editMaxOpenCashSessions: "1",
    editPassword: "",
  });

  const token = localStorage.getItem("axis.superadmin.token") ?? "";

  useEffect(() => {
    async function fetchTenants() {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const data = await fetchTenantsAsSuperAdmin(token);
        setState((prev) => ({ ...prev, tenants: data }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error:
            err instanceof Error
              ? err.message
              : "Erro inesperado ao carregar tenants.",
        }));
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    }

    if (token) {
      fetchTenants();
    } else {
      setState((prev) => ({
        ...prev,
        error: "Token de super admin ausente. Faça login novamente.",
      }));
    }
  }, [token]);

  const filteredTenants = useMemo(() => {
    const term = state.search.trim().toLowerCase();
    if (!term) return state.tenants;
    return state.tenants.filter((tenant) => {
      const fields = [
        tenant.id,
        tenant.email,
        tenant.cnpj ?? "",
        tenant.cpfResLoja ?? "",
      ];
      return fields.some((field) => field?.toLowerCase().includes(term));
    });
  }, [state.search, state.tenants]);

  function openModal(tenant: Tenant) {
    setState((prev) => ({
      ...prev,
      selectedTenant: tenant,
      modalFeedback: null,
      editPassword: "",
      editName: tenant.name ?? "",
      editEmail: tenant.email ?? "",
      editCnpj: tenant.cnpj ?? "",
      editCpfResLoja: tenant.cpfResLoja ?? "",
      editIsActive: tenant.isActive,
      editMaxOpenCashSessions: String(tenant.maxOpenCashSessions || 1),
    }));
  }

  function closeModal() {
    if (state.isSaving) return;
    setState((prev) => ({ ...prev, selectedTenant: null, modalFeedback: null }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state.selectedTenant) return;
    setState((prev) => ({ ...prev, isSaving: true, modalFeedback: null }));
    const body: Record<string, unknown> = {};
    if (state.editName) body.name = state.editName;
    if (state.editEmail) body.email = state.editEmail;
    if (state.editCnpj) body.cnpj = state.editCnpj;
    if (state.editCpfResLoja) body.cpfResLoja = state.editCpfResLoja;
    body.isActive = state.editIsActive;
    if (state.editMaxOpenCashSessions) {
      body.maxOpenCashSessions = Number(state.editMaxOpenCashSessions);
    }
    if (state.editPassword.trim()) {
      body.password = state.editPassword.trim();
    }

    try {
      const updated = await updateTenantAsSuperAdmin(
        token,
        state.selectedTenant.id,
        body as any,
      );
      setState((prev) => ({
        ...prev,
        tenants: prev.tenants.map((tenant) =>
          tenant.id === updated.id ? updated : tenant,
        ),
        modalFeedback: "Tenant atualizado com sucesso.",
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        modalFeedback:
          err instanceof Error ? err.message : "Erro inesperado ao atualizar o tenant.",
      }));
    } finally {
      setState((prev) => ({ ...prev, isSaving: false }));
    }
  }

  return (
    <section className="tenant-edit-wrapper">
      <div className="tenant-search-bar">
        <input
          className="tenant-search-input"
          placeholder="Buscar por ID, email, CNPJ ou CPF"
          value={state.search}
          onChange={(e) => setState((prev) => ({ ...prev, search: e.target.value }))}
        />
      </div>

      {state.isLoading && <p className="tenant-counter">Carregando tenants...</p>}
      {state.error && (
        <p className="tenant-counter tenant-error">{state.error}</p>
      )}

      {!state.isLoading && !state.error && (
        <>
          <div className="tenant-counter">
            {filteredTenants.length} tenant{filteredTenants.length === 1 ? "" : "s"}{" "}
            encontrado{filteredTenants.length === 1 ? "" : "s"}
          </div>
          <ul className="tenant-list">
            {filteredTenants.map((tenant) => (
              <li
                key={tenant.id}
                className="tenant-row"
                onClick={() => openModal(tenant)}
              >
                <div className="tenant-row-main">
                  <div className="tenant-row-name">{tenant.name}</div>
                  <div className="tenant-row-id">ID: {tenant.id}</div>
                </div>
                <div className="tenant-row-secondary">
                  <span>{tenant.email}</span>
                  <span>
                    {tenant.cnpj && <>CNPJ: {tenant.cnpj} • </>}
                    {tenant.cpfResLoja && <>CPF resp.: {tenant.cpfResLoja}</>}
                  </span>
                </div>
                <div className="tenant-row-status">
                  <span
                    className={`status-pill ${
                      tenant.isActive ? "status-active" : "status-inactive"
                    }`}
                  >
                    {tenant.isActive ? "Ativo" : "Desativado"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {state.selectedTenant && (
        <div className="modal-backdrop show">
          <form className="modal-card" onSubmit={handleSave}>
            <div className="modal-header">
              <h2>Editar tenant</h2>
              <button type="button" className="modal-close" onClick={closeModal}>
                ×
              </button>
            </div>
            <div className="modal-helper">
              ID: <code>{state.selectedTenant.id}</code>
            </div>
            <div className="modal-body">
              <label className="modal-field">
                Nome da loja
                <input
                  className="modal-input"
                  value={state.editName}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, editName: e.target.value }))
                  }
                  disabled={state.isSaving}
                />
              </label>
              <label className="modal-field">
                Email principal
                <input
                  className="modal-input"
                  value={state.editEmail}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, editEmail: e.target.value }))
                  }
                  disabled={state.isSaving}
                />
              </label>
              <label className="modal-field">
                CNPJ
                <input
                  className="modal-input"
                  maxLength={14}
                  value={state.editCnpj}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      editCnpj: e.target.value.replace(/\D/g, "").slice(0, 14),
                    }))
                  }
                  disabled={state.isSaving}
                />
              </label>
              <label className="modal-field">
                CPF do responsável
                <input
                  className="modal-input"
                  maxLength={11}
                  value={state.editCpfResLoja}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      editCpfResLoja: e.target.value.replace(/\D/g, "").slice(0, 11),
                    }))
                  }
                  disabled={state.isSaving}
                />
              </label>
              <label className="modal-field">
                Limite de caixas abertos
                <input
                  className="modal-input"
                  type="number"
                  min={1}
                  value={state.editMaxOpenCashSessions}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      editMaxOpenCashSessions: e.target.value,
                    }))
                  }
                  disabled={state.isSaving}
                />
              </label>
              <label className="modal-field">
                Nova senha (opcional)
                <input
                  className="modal-input"
                  type="password"
                  placeholder="Deixe em branco para manter"
                  value={state.editPassword}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, editPassword: e.target.value }))
                  }
                  disabled={state.isSaving}
                />
              </label>
              <div className="modal-checkbox-row">
                <input
                  id="tenant-active-switch"
                  type="checkbox"
                  checked={state.editIsActive}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      editIsActive: e.target.checked,
                    }))
                  }
                  disabled={state.isSaving}
                />
                <label htmlFor="tenant-active-switch">Tenant ativo</label>
              </div>
            </div>
            {state.modalFeedback && (
              <p
                className={`modal-feedback ${
                  state.modalFeedback.includes("sucesso") ? "success" : "error"
                }`}
              >
                {state.modalFeedback}
              </p>
            )}
            <div className="modal-footer">
              <button
                type="button"
                className="modal-btn-secondary"
                onClick={closeModal}
                disabled={state.isSaving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="modal-btn-primary"
                disabled={state.isSaving}
              >
                {state.isSaving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

export default TenantEditSection;
