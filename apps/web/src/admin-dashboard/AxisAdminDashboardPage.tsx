import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./axis-admin-dashboard.css";
import {
  clearSession,
  getAccessToken,
  getCurrentUser,
  hasAdminAccess,
} from "../auth/session";
import AxisCategoriesPageContent from "./AxisCategoriesPageContent";
import AxisProductsPageContent from "./AxisProductsPageContent";
import AxisUsersPageContent from "./AxisUsersPageContent";

type Theme = "dark" | "light";
type NavGroupId =
  | "dashboard"
  | "categorias"
  | "produtos"
  | "usuarios"
  | "estoque"
  | "vendas"
  | "caixa"
  | "fiscal"
  | "clientes"
  | "sync"
  | "config";


type MainSection = "dashboard" | "categories" | "products" | "users";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export function AxisAdminDashboardPage() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>("dark");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<NavGroupId[]>(["dashboard"]);
  const [mainSection, setMainSection] = useState<MainSection>("dashboard");

  const accessToken = getAccessToken();
  const user = getCurrentUser();
  const isDark = theme === "dark";

  const handleLogout = useCallback(() => {
    clearSession();
    navigate("/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!accessToken || !user) {
      handleLogout();
      return;
    }
    if (!hasAdminAccess(user)) {
      navigate("/", { replace: true });
    }
  }, [accessToken, user, handleLogout, navigate]);

  useEffect(() => {
    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    let timer: ReturnType<typeof setTimeout> | null = null;

    const resetTimer = () => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(handleLogout, IDLE_TIMEOUT_MS);
    };

    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [handleLogout]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const isGroupOpen = (id: NavGroupId) => openGroups.includes(id);

  const toggleGroup = (id: NavGroupId) => {
    if (isSidebarCollapsed) return;
    setOpenGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  const rootClassName = `axis-root axis-${theme}`;
  const sidebarClassName = `axis-sidebar${isSidebarCollapsed ? " collapsed" : ""}`;
  const userName =
    user?.name && user.name.trim().length > 0
      ? user.name
      : user?.userId
        ? user.userId.slice(0, 6)
        : "Usuario";
  const roleLabel = user?.role ?? "ADMIN";

  return (
    <div className={rootClassName} id="axis-root">
      {/* TOPBAR */}
      <header className="axis-topbar">
        <div className="axis-topbar-left">
          <div className="axis-brand">
            <span className="axis-brand-dot" />
            <span>AXIS</span>
          </div>
          <div className="axis-topbar-title">
            | Painel do gestor - ADMIN / OWNER
          </div>
        </div>

        <div className="axis-topbar-right">
          <button
            className="axis-toggle"
            type="button"
            onClick={toggleTheme}
          >
            {isDark ? "🌓 Claro" : "🌙 Escuro"}
          </button>
          <div className="axis-user-chip">
            <div className="axis-avatar" />
            <div className="axis-token-details">
              <span>{userName}</span>
              <span className="axis-copy-note">{roleLabel}</span>
            </div>
          </div>
        </div>
      </header>

      {/* LAYOUT PRINCIPAL */}
      <div className="axis-dashboard-layout">
        {/* SIDEBAR */}
        <aside className={sidebarClassName} id="axis-sidebar">
          <div className="axis-sidebar-header">
            <div className="axis-sidebar-title">Menu</div>
            <button
              className="axis-sidebar-toggle"
              type="button"
              onClick={toggleSidebar}
            >
              ≡
            </button>
          </div>

          <div className="axis-nav-groups">
            {/* DASHBOARD */}
            <div
              className={`axis-nav-group ${
                isGroupOpen("dashboard") ? "open" : ""
              }`}
              data-group="dashboard"
            >
              <button
                className="axis-nav-parent"
                type="button"
                onClick={() => toggleGroup("dashboard")}
              >
                <div className="axis-nav-parent-main">
                  <div className="axis-nav-icon">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M4.5 10.8L12 3.5L19.5 10.8V19
                           C19.5 20.38 18.38 21.5 17 21.5H7
                           C5.62 21.5 4.5 20.38 4.5 19V10.8Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 21.5V16.3
                           C9 14.96 10.01 13.9 11.35 13.9H12.65
                           C13.99 13.9 15 14.96 15 16.3V21.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="axis-nav-parent-label">Dashboard</span>
                </div>
                <span className="axis-nav-parent-chevron">›</span>
              </button>
              <ul className="axis-nav-children">
                <li className="axis-nav-child">
                  <span>Métricas de caixa / vendas</span>
                  <small>/api/reports/*</small>
                </li>
                <li className="axis-nav-child">
                  <span>Onboarding & ajustes rápidos</span>
                  <small>Configurações iniciais da loja</small>
                </li>
              </ul>
            </div>

            {/* CATEGORIAS */}
            <div
              className={`axis-nav-group ${
                isGroupOpen("categorias") ? "open" : ""
              }`}
              data-group="categorias"
            >
              <button
                className="axis-nav-parent"
                type="button"
                onClick={() => toggleGroup("categorias")}
              >
                <div className="axis-nav-parent-main">
                  <div className="axis-nav-icon">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <rect
                        x="4"
                        y="4"
                        width="7"
                        height="7"
                        rx="2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                      <rect
                        x="13"
                        y="4"
                        width="7"
                        height="7"
                        rx="2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                      <rect
                        x="4"
                        y="13"
                        width="7"
                        height="7"
                        rx="2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                      <rect
                        x="13"
                        y="13"
                        width="7"
                        height="7"
                        rx="2"
                        fill="currentColor"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                    </svg>
                  </div>
                  <span className="axis-nav-parent-label">Categorias</span>
                </div>
                <span className="axis-nav-parent-chevron">›</span>
              </button>
              <ul className="axis-nav-children">
                <li
                  className="axis-nav-child"
                  onClick={() => setMainSection("categories")}
                >
                  <span>Criar / Editar</span>
                  <small>Gerenciar categorias e imagens</small>
                </li>
              </ul>
            </div>

            {/* PRODUTOS (placeholder para futuras telas) */}
            <div
              className={`axis-nav-group ${
                isGroupOpen("produtos") ? "open" : ""
              }`}
              data-group="produtos"
            >
              <button
                className="axis-nav-parent"
                type="button"
                onClick={() => toggleGroup("produtos")}
              >
                <div className="axis-nav-parent-main">
                  <div className="axis-nav-icon">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M4.5 9L12 4.5L19.5 9L12 13.5Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M4.5 9V16.2C4.5 17.2 5.1 18.1 6 18.6L11.4 21.3
                           C11.77 21.49 12.23 21.49 12.6 21.3L18 18.6
                           C18.9 18.1 19.5 17.2 19.5 16.2V9"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M8.2 7.8L12 10L15.8 7.8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="axis-nav-parent-label">Produtos</span>
                </div>
                <span className="axis-nav-parent-chevron">›</span>
              </button>
              <ul className="axis-nav-children">
                <li
                  className="axis-nav-child"
                  onClick={() => setMainSection("products")}
                >
                  <span>Criar/editar produtos</span>
                  <small>Listar / criar / editar produtos</small>
                </li>

              </ul>
            </div>

            {/* USUARIOS */}
            <div
              className={`axis-nav-group ${
                isGroupOpen("usuarios") ? "open" : ""
              }`}
              data-group="usuarios"
            >
              <button
                className="axis-nav-parent"
                type="button"
                onClick={() => toggleGroup("usuarios")}
              >
                <div className="axis-nav-parent-main">
                  <div className="axis-nav-icon">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle cx="15" cy="9" r="3" fill="currentColor" />
                      <path
                        d="M11.5 17c0.7-2.1 2.3-3.5 4.5-3.5s3.8 1.4 4.5 3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                      <circle cx="9" cy="10" r="3.1" fill="currentColor" />
                      <path
                        d="M4.5 18c0.9-2.4 2.8-4 5.5-4s4.6 1.6 5.5 4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <span className="axis-nav-parent-label">Usuarios</span>
                </div>
                <span className="axis-nav-parent-chevron">�?�</span>
              </button>
              <ul className="axis-nav-children">
                <li
                  className="axis-nav-child"
                  onClick={() => setMainSection("users")}
                >
                  <span>Criar / Editar</span>
                  <small>Gerenciar usuarios</small>
                </li>
              </ul>
            </div>

            {/* DEMAIS GRUPOS (simplificados) */}
            <div
              className={`axis-nav-group ${
                isGroupOpen("estoque") ? "open" : ""
              }`}
              data-group="estoque"
            >
              <button
                className="axis-nav-parent"
                type="button"
                onClick={() => toggleGroup("estoque")}
              >
                <div className="axis-nav-parent-main">
                  <div className="axis-nav-icon">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M3.5 11L12 4.5L20.5 11V18.5
                           C20.5 19.88 19.38 21 18 21H6
                           C4.62 21 3.5 19.88 3.5 18.5V11Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M8 19V14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 19V14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M16 19V14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="axis-nav-parent-label">Estoque</span>
                </div>
                <span className="axis-nav-parent-chevron">›</span>
              </button>
            </div>

            <div
              className={`axis-nav-group ${
                isGroupOpen("vendas") ? "open" : ""
              }`}
              data-group="vendas"
            >
              <button
                className="axis-nav-parent"
                type="button"
                onClick={() => toggleGroup("vendas")}
              >
                <div className="axis-nav-parent-main">
                  <div className="axis-nav-icon">🧾</div>
                  <span className="axis-nav-parent-label">Vendas</span>
                </div>
                <span className="axis-nav-parent-chevron">›</span>
              </button>
            </div>

            <div className="axis-sidebar-footer">
              <div className="axis-sidebar-logout">
                <button
                  className="axis-logout-btn"
                  type="button"
                  onClick={handleLogout}
                >
                  SAIR
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN / DASHBOARD */}
        <main className="axis-dashboard-main">
          {mainSection === "categories" ? (
            <AxisCategoriesPageContent />
          ) : mainSection === "products" ? (
            <AxisProductsPageContent />
          ) : mainSection === "users" ? (
            <AxisUsersPageContent />
          ) : (
            <>
              <header className="axis-dashboard-header">
                <div>
                  <div className="axis-dashboard-title">Visão geral de hoje</div>
                  <div className="axis-dashboard-subtitle">
                    Acompanhe rapidamente indicadores de vendas, caixa e estoque.
                  </div>
                </div>
                <div>

                </div>
              </header>

              {/* MÉTRICAS PRINCIPAIS (mock) */}
              <section className="axis-metrics-grid">
                <article className="axis-metric-card">
                  <div className="axis-metric-label">Faturamento de hoje</div>
                  <div className="axis-metric-value">R$ 12.450,90</div>
                  <div className="axis-metric-footer">
                    +18% vs. ontem /api/reports/sales-summary
                  </div>
                </article>
                <article className="axis-metric-card">
                  <div className="axis-metric-label">Vendas concluídas</div>
                  <div className="axis-metric-value">134</div>
                  <div className="axis-metric-footer">
                    Ticket médio R$ 92,90 /api/sales
                  </div>
                </article>
                <article className="axis-metric-card">
                  <div className="axis-metric-label">Caixas ativos</div>
                  <div className="axis-metric-value">3</div>
                  <div className="axis-metric-footer">
                    /api/cash/open-sessions
                  </div>
                </article>
                <article className="axis-metric-card">
                  <div className="axis-metric-label">Alertas de estoque</div>
                  <div className="axis-metric-value">7 itens</div>
                  <div className="axis-metric-footer">
                    Estoque abaixo do mínimo /api/reports/min-stock
                  </div>
                </article>
              </section>

              {/* PAINÉIS MOCKS */}
              <section className="axis-panels-grid">
                <article className="axis-panel">
                  <div className="axis-panel-header">
                    <div>
                      <div className="axis-panel-title">Vendas por hora</div>
                      <div className="axis-panel-subtitle">
                        Gráfico alimentado por /api/reports/sales-timeseries.
                      </div>
                    </div>
                    <span className="axis-panel-chip">Hoje</span>
                  </div>
                  <div className="axis-chart-placeholder">
                    (Aqui entra o gráfico real no app final)
                  </div>
                </article>

                <article className="axis-panel">
                  <div className="axis-panel-header">
                    <div>
                      <div className="axis-panel-title">
                        Top sellers & vendas fracas
                      </div>
                      <div className="axis-panel-subtitle">
                        Baseado em /api/reports/top-sellers e /api/reports/weak-sales.
                      </div>
                    </div>
                  </div>
                  <ul className="axis-list">
                    <li className="axis-list-item">
                      <span>Pão francês (KG)</span>
                      <span className="axis-badge-soft">Top seller</span>
                    </li>
                    <li className="axis-list-item">
                      <span>Refrigerante lata 350ml</span>
                      <span className="axis-badge-soft">Top seller</span>
                    </li>
                    <li className="axis-list-item">
                      <span>Doce de leite 400g</span>
                      <span className="axis-badge-warning">Venda fraca</span>
                    </li>
                    <li className="axis-list-item">
                      <span>Sabonete neutro 90g</span>
                      <span className="axis-badge-warning">Venda fraca</span>
                    </li>
                  </ul>
                </article>
              </section>

              <section className="axis-panels-grid" style={{ marginTop: "0.3rem" }}>
                <article className="axis-panel">
                  <div className="axis-panel-header">
                    <div>
                      <div className="axis-panel-title">Estoque mínimo</div>
                      <div className="axis-panel-subtitle">
                        Itens abaixo do nível configurado em /api/reports/min-stock.
                      </div>
                    </div>
                  </div>
                  <ul className="axis-list">
                    <li className="axis-list-item">
                      <span>Arroz 5kg</span>
                      <span className="axis-badge-warning">2 un em estoque</span>
                    </li>
                    <li className="axis-list-item">
                      <span>Feijão carioca 1kg</span>
                      <span className="axis-badge-warning">3 un em estoque</span>
                    </li>
                    <li className="axis-list-item">
                      <span>Café torrado 500g</span>
                      <span className="axis-badge-warning">1 un em estoque</span>
                    </li>
                  </ul>
                </article>

                <article className="axis-panel">
                  <div className="axis-panel-header">
                    <div>
                      <div className="axis-panel-title">Sincronização offline</div>
                      <div className="axis-panel-subtitle">
                        Status de envios pendentes para /api/sync/sale.
                      </div>
                    </div>
                  </div>
                  <ul className="axis-list">
                    <li className="axis-list-item">
                      <span>Vendas pendentes</span>
                      <span className="axis-badge-warning">5 não enviadas</span>
                    </li>
                    <li className="axis-list-item">
                      <span>Última sincronização</span>
                      <span>Hoje às 14:32</span>
                    </li>
                    <li className="axis-list-item">
                      <span>Indicadores offline</span>
                      <span className="axis-badge-soft">Atualizado</span>
                    </li>
                  </ul>
                </article>
              </section>

              <p className="axis-footer-note">
                As métricas acima são mock para preview. No app real, você vai
                consumir as rotas <code>/api/reports/*</code>, <code>/api/cash/*</code>,{" "}
                <code>/api/sales</code> e <code>/api/sync/sale</code> usando o{" "}
                <strong>tenantId</strong> do ADMIN / OWNER.
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default AxisAdminDashboardPage;
