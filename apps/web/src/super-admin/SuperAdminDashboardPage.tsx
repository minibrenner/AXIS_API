import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./super-admin-dashboard.css";
import {
  CreateTenantPayload,
  createTenantAsSuperAdmin,
  fetchSuperAdminOverview,
  type SuperAdminMetrics,
} from "../services/api";
import TenantEditSection from "./TenantEditSection";
import TenantUserCreateSection from "./TenantUserCreateSection";

type SectionKey =
  | "dashboard"
  | "tenants-create"
  | "tenants-edit"
  | "tenants-toggle"
  | "users-create"
  | "users-edit"
  | "superadmin-create"
  | "superadmin-edit";

type Props = {
  onLogout?: () => void;
  onChangePassword?: () => void;
};

type TenantFormStatus = "idle" | "submitting" | "success" | "error";

const summaryItems = (metrics: SuperAdminMetrics) => [
  { label: "Lojas ativas", value: metrics.totalLojasAtivas },
  { label: "Usuários ativos", value: metrics.totalUsuariosAtivos },
  { label: "Lojas desativadas", value: metrics.totalLojasDesativadas },
  { label: "Usuários desativados", value: metrics.totalUsuariosDesativados },
];

const emptyMetrics: SuperAdminMetrics = {
  totalLojasAtivas: 0,
  totalUsuariosAtivos: 0,
  totalLojasDesativadas: 0,
  totalUsuariosDesativados: 0,
};

export function SuperAdminDashboardPage({ onLogout, onChangePassword }: Props) {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SectionKey>("dashboard");
  const [metrics, setMetrics] = useState<SuperAdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("axis.superadmin.token"),
  );
  const [formStatus, setFormStatus] = useState<TenantFormStatus>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateTenantPayload>({
    name: "",
    email: "",
    password: "",
    cnpj: "",
    cpfResLoja: "",
    maxOpenCashSessions: 1,
  });

  function handleLogout() {
    if (onLogout) {
      onLogout();
      return;
    }
    localStorage.removeItem("axis.superadmin.token");
    navigate("/super-admin/login");
  }

  function handleChangePassword() {
    if (onChangePassword) {
      onChangePassword();
      return;
    }
    console.log("Ir para tela de alteração de senha do Super Admin");
  }

  const activeLabel = {
    dashboard: "Visão geral",
    "tenants-create": "Criar novo tenant",
    "tenants-edit": "Editar tenant",
    "tenants-toggle": "Desativar ou ativar tenant",
    "users-create": "Adicionar usuário",
    "users-edit": "Editar usuário",
    "superadmin-create": "Criar novo Super Admin",
    "superadmin-edit": "Editar Super Admin",
  }[activeSection];

  useEffect(() => {
    if (!token) {
      setError("Token de super admin ausente. Faça login novamente.");
      navigate("/super-admin/login");
      return;
    }

    setLoading(true);
    fetchSuperAdminOverview(token)
      .then((data) => {
        setMetrics(data);
        setError(null);
      })
      .catch((err) => {
        console.error("Erro ao buscar métricas do super admin:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível obter os indicadores do super admin.",
        );
      })
      .finally(() => setLoading(false));
  }, [navigate, token]);

  const isCreateTenant = activeSection === "tenants-create";

  const canSubmitForm = useMemo(() => {
    return (
      formData.name.trim().length > 2 &&
      formData.email.trim().length > 5 &&
      !!formData.password &&
      formData.password.trim().length >= 4
    );
  }, [formData]);

  const handleTenantSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setFormError("Token ausente. Faça login novamente.");
      return;
    }
    const cnpj = (formData.cnpj ?? "").trim();
    const cpf = (formData.cpfResLoja ?? "").trim();
    const email = (formData.email ?? "").trim();
    const nome = (formData.name ?? "").trim();
    const password = formData.password?.trim();

    if (!cnpj || cnpj.length !== 14) {
      setFormError("Informe um CNPJ válido de 14 dígitos.");
      setFormStatus("error");
      return;
    }
    if (!cpf || cpf.length !== 11) {
      setFormError("Informe um CPF válido de 11 dígitos.");
      setFormStatus("error");
      return;
    }
    if (!nome) {
      setFormError("O nome do tenant é obrigatório.");
      setFormStatus("error");
      return;
    }
    if (!email) {
      setFormError("O email é obrigatório.");
      setFormStatus("error");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setFormError("Informe um email com formato válido.");
      setFormStatus("error");
      return;
    }
    if (!password || password.length < 4) {
      setFormError("A senha deve ter pelo menos 4 caracteres.");
      setFormStatus("error");
      return;
    }
    setFormStatus("submitting");
    setFormError(null);
    setFormSuccess(null);
    try {
      const response = await createTenantAsSuperAdmin(token, {
        ...formData,
        name: nome,
        email,
        password,
        cnpj,
        cpfResLoja: cpf,
      });
      setFormSuccess(`Tenant ${response.name} (${response.id}) criado com sucesso.`);
      setFormStatus("success");
      setFormData((prev) => ({ ...prev, name: "", email: "", password: "" }));
    } catch (err) {
      const apiErr = err as Error & { field?: string };
      setFormError(
        apiErr.field
          ? `Já existe cadastro com ${apiErr.field}.`
          : apiErr.message ?? "Falha ao criar tenant.",
      );
      setFormStatus("error");
    }
  };

  const displayMetrics = metrics ?? emptyMetrics;

  return (
    <div className="superadmin-root superadmin-root-dashboard">
      <div className="superadmin-shell">
        <aside className="superadmin-sidebar">
          <div>
            <div
              className="sidebar-logo"
              role="button"
              tabIndex={0}
              onClick={() => navigate("/super-admin/dashboard")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  navigate("/super-admin/dashboard");
                }
              }}
            >
              <span className="sidebar-logo-sub">AXIS</span>
              <span className="sidebar-logo-title">SUPER ADMIN</span>
            </div>

            <div>
              <div className="sidebar-section-title">Tenants</div>
              <ul className="sidebar-nav">
                <li
                  className={
                    "sidebar-item" +
                    (activeSection === "tenants-create" ? " active" : "")
                  }
                  onClick={() => setActiveSection("tenants-create")}
                >
                  <span>Criar novo tenant</span>
                  {activeSection === "tenants-create" && <span className="badge-dot" />}
                </li>
                <li
                  className={
                    "sidebar-item" + (activeSection === "tenants-edit" ? " active" : "")
                  }
                  onClick={() => setActiveSection("tenants-edit")}
                >
                  <span>Editar tenant existente</span>
                </li>

              </ul>
            </div>

            <div>
              <div className="sidebar-section-title">Usuários</div>
              <ul className="sidebar-nav">
                <li
                  className={
                    "sidebar-item" + (activeSection === "users-create" ? " active" : "")
                  }
                  onClick={() => setActiveSection("users-create")}
                >
                  <span>Criar novo usuário para um tenant</span>
                </li>

              </ul>
            </div>

            <div>
              <div className="sidebar-section-title">Super Admin</div>
              <ul className="sidebar-nav">
                <li
                  className={
                    "sidebar-item" +
                    (activeSection === "superadmin-create" ? " active" : "")
                  }
                  onClick={() => setActiveSection("superadmin-create")}
                >
                  <span>Criar novo Super Admin</span>
                </li>
                
              </ul>
            </div>
          </div>

          <div className="sidebar-actions">
            <button
              type="button"
              className="sidebar-action-btn"
              onClick={handleChangePassword}
            >
              Alterar senha
            </button>
            <button
              type="button"
              className="sidebar-action-btn danger"
              onClick={handleLogout}
            >
              Logout
            </button>
            <div className="sidebar-footer">
              <strong>AXIS PANEL</strong>
              <div>Gerencie tenants, usuários e permissões globais.</div>
            </div>
          </div>
        </aside>

        <main className="superadmin-main">
          {activeSection === "tenants-edit" ? (
            <TenantEditSection />
          ) : activeSection === "users-create" ? (
            <TenantUserCreateSection />
          ) : (
            <>
              <header className="superadmin-main-header">
                <div className="superadmin-main-title-block">
                  <h1>{isCreateTenant ? "Criar novo tenant" : "Painel geral"}</h1>
                  <p>
                    {isCreateTenant
                      ? "Preencha os dados da loja para registrar um novo tenant no AXIS."
                      : "Visão consolidada de lojas (tenants) e usuários ativos no AXIS."}
                  </p>
                </div>
                <div className="superadmin-badge-chip">Super Admin</div>
              </header>

              {(formStatus === "success" || formStatus === "error") && (
                <div
                  className={`tenant-form-alert ${
                    formStatus === "success" ? "success" : "error"
                  }`}
                >
                  {formStatus === "success" ? formSuccess : formError}
                </div>
              )}

              <section className="superadmin-metrics">
                {loading ? (
                  <div className="metric-card">
                    <span>Carregando métricas...</span>
                  </div>
                ) : (
                  summaryItems(displayMetrics).map((item) => (
                    <article key={item.label} className="metric-card">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </article>
                  ))
                )}
                {error && <p className="content-body">{error}</p>}
              </section>

              {isCreateTenant && (
                <section className="tenant-form-wrapper">
                  <form className="tenant-form-card" onSubmit={handleTenantSubmit}>
                    <div className="tenant-form-title">
                      <h3>Novo tenant</h3>
                      <p>Forneça as informações básicas para registrar a loja.</p>
                    </div>
                    <div className="tenant-form-grid">
                      <label>
                        Nome da loja
                        <input
                          className="tenant-input"
                          value={formData.name}
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, name: event.target.value }))
                          }
                          placeholder="Axis Centro"
                        />
                      </label>
                      <label>
                        Email de contato
                        <input
                          className="tenant-input"
                          type="email"
                          value={formData.email}
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, email: event.target.value }))
                          }
                          placeholder="comercial@axis.com"
                        />
                      </label>
                      <label>
                        CNPJ da loja <span className="tenant-required">*</span>
                        <input
                          className="tenant-input"
                          maxLength={14}
                          value={formData.cnpj ?? ""}
                          onChange={(event) => {
                            const digits = event.target.value.replace(/\D/g, "").slice(0, 14);
                            setFormData((prev) => ({ ...prev, cnpj: digits }));
                          }}
                          placeholder="12345678000195"
                        />
                      </label>
                      <label>
                        CPF do responsável <span className="tenant-required">*</span>
                        <input
                          className="tenant-input"
                          maxLength={11}
                          value={formData.cpfResLoja ?? ""}
                          onChange={(event) => {
                            const digits = event.target.value.replace(/\D/g, "").slice(0, 11);
                            setFormData((prev) => ({ ...prev, cpfResLoja: digits }));
                          }}
                          placeholder="12345678901"
                        />
                      </label>
                      <label>
                        Senha inicial
                        <input
                          className="tenant-input"
                          type="password"
                          value={formData.password ?? ""}
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, password: event.target.value }))
                          }
                        />
                      </label>
                      <label>
                        Caixas simultâneos
                        <input
                          className="tenant-input"
                          type="number"
                          min={1}
                          max={10}
                          value={formData.maxOpenCashSessions ?? 1}
                          onChange={(event) =>
                            setFormData((prev) => ({
                              ...prev,
                              maxOpenCashSessions: Number(event.target.value),
                            }))
                          }
                        />
                      </label>
                    </div>
                    <div className="tenant-form-actions">
                      <button type="submit" disabled={!canSubmitForm || formStatus === "submitting"}>
                        {formStatus === "submitting" ? "Registrando..." : "Criar tenant"}
                      </button>
                    </div>
                  </form>
                </section>
              )}

              {!isCreateTenant && (
                <section
                  className="superadmin-content"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <div className="content-header">
                    <div>
                      <p className="content-label">Sessão ativa</p>
                      <h2>{activeLabel}</h2>
                    </div>
                    <span className="content-tag">Atualizado agora</span>
                  </div>
                  
                  <div className="content-footer">
                    <button type="button" onClick={() => setActiveSection("dashboard")}>
                      Voltar para dashboard
                    </button>
                    <button type="button" onClick={() => setActiveSection(activeSection)}>
                      Recarregar seção
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default SuperAdminDashboardPage;
