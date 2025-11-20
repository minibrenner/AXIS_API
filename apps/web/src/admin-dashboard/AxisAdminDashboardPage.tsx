import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./axis-admin-dashboard.css";
import {
  clearSession,
  getAccessToken,
  getCurrentUser,
  getTenantId,
  hasAdminAccess,
} from "../auth/session";

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

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export function AxisAdminDashboardPage() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>("dark");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<NavGroupId[]>(["dashboard"]);

  const accessToken = getAccessToken();
  const tenantId = getTenantId();
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
            {isDark ? "☀️ Claro" : "🌙 Escuro"}
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
              «
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
                  <div className="axis-nav-icon">📊</div>
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
                  <div className="axis-nav-icon">🏷️</div>
                  <span className="axis-nav-parent-label">Categorias</span>
                </div>
                <span className="axis-nav-parent-chevron">›</span>
              </button>
              <ul className="axis-nav-children">
                <li className="axis-nav-child">
                  <span>Criar categorias</span>
                  <small>Cadastro de novas categorias</small>
                </li>
                <li className="axis-nav-child">
                  <span>Editar categorias</span>
                  <small>Atualizar nomes e status</small>
                </li>
              </ul>
            </div>

            {/* PRODUTOS */}
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
                  <div className="axis-nav-icon">🛒</div>
                  <span className="axis-nav-parent-label">Produtos</span>
                </div>
                <span className="axis-nav-parent-chevron">›</span>
              </button>
              <ul className="axis-nav-children">
                <li className="axis-nav-child">
                  <span>Criar produtos</span>
                  <small>Cadastro de novos itens</small>
                </li>
                <li className="axis-nav-child">
                  <span>Editar produtos</span>
                  <small>Preços, códigos de barras, etc.</small>
                </li>
              </ul>
            </div>

            {/* USUÁRIOS */}
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
                  <div className="axis-nav-icon">👥</div>
                  <span className="axis-nav-parent-label">Usuários</span>
                </div>
                <span className="axis-nav-parent-chevron">›</span>
              </button>
              <ul className="axis-nav-children">
                <li className="axis-nav-child">
                  <span>Adicionar usuários</span>
                  <small>Criar OWNER / ADMIN / ATTENDANT</small>
                </li>
                <li className="axis-nav-child">
                  <span>Editar usuários</span>
                  <small>Listar, atualizar e desativar</small>
                </li>
              </ul>
            </div>

            {/* ESTOQUE */}
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
                  <div className="axis-nav-icon">📦</div>
                  <span className="axis-nav-parent-label">Estoque</span>
                </div>
                <span className="axis-nav-parent-chevron">›</span>
              </button>
              <ul className="axis-nav-children">
                <li className="axis-nav-child">
                  <span>Adicionar / retirar itens</span>
                  <small>Entradas, saídas e ajustes</small>
                </li>
                <li className="axis-nav-child">
                  <span>Gerenciar estoques</span>
                  <small>Locais e níveis mínimos</small>
                </li>
              </ul>
            </div>

            {/* VENDAS */}
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
              <ul className="axis-nav-children">
                <li className="axis-nav-child">
                  <span>Últimas vendas feitas</span>
                  <small>Histórico recente de vendas</small>
                </li>
              </ul>
            </div>

            {/* CAIXA */}
            <div
              className={`axis-nav-group ${
                isGroupOpen("caixa") ? "open" : ""
              }`}
              data-group="caixa"
            >
              <button
                className="axis-nav-parent"
                type="button"
                onClick={() => toggleGroup("caixa")}
              >
                <div className="axis-nav-parent-main">
                  <div className="axis-nav-icon">💰</div>
                  <span className="axis-nav-parent-label">Caixa</span>
                </div>
                <span className="axis-nav-parent-chevron">›</span>
              </button>
              <ul className="axis-nav-children">
                <li className="axis-nav-child">
                  <span>Iniciar um caixa</span>
                  <small>Abertura de sessão de caixa</small>
                </li>
                <li className="axis-nav-child">
                  <span>Caixas ativos</span>
                  <small>Sessões abertas no momento</small>
                </li>
                <li className="axis-nav-child">
                  <span>Relatórios dos últimos caixas</span>
                  <small>Fechamento e conferência</small>
                </li>
              </ul>
            </div>

            {/* FISCAL */}
            <div
              className={`axis-nav-group ${
                isGroupOpen("fiscal") ? "open" : ""
              }`}
              data-group="fiscal"
            >
              <button
                className="axis-nav-parent"
                type="button"
                onClick={() => toggleGroup("fiscal")}
              >
                <div className="axis-nav-parent-main">
                  <div className="axis-nav-icon">📑</div>
                  <span className="axis-nav-parent-label">Fiscal</span>
                </div>
                <span className="axis-nav-parent-chevron">›</span>
              </button>
              <ul className="axis-nav-children">
                <li className="axis-nav-child">
                  <span>Relatórios fiscais</span>
                  <small>Consulta de documentos emitidos</small>
                </li>
                <li className="axis-nav-child">
                  <span>Configuração fiscal</span>
                  <small>Certificados, séries, etc.</small>
                </li>
              </ul>
            </div>

            {/* CLIENTES */}
            <div
              className={`axis-nav-group ${
                isGroupOpen("clientes") ? "open" : ""
              }`}
              data-group="clientes"
            >
              <button
                className="axis-nav-parent"
                type="button"
                onClick={() => toggleGroup("clientes")}
              >
                <div className="axis-nav-parent-main">
                  <div className="axis-nav-icon">🙍</div>
                  <span className="axis-nav-parent-label">Clientes</span>
                </div>
                <span className="axis-nav-parent-chevron">›</span>
              </button>
              <ul className="axis-nav-children">
                <li className="axis-nav-child">
                  <span>Cadastrar clientes</span>
                  <small>Cadastro básico / completo</small>
                </li>
                <li className="axis-nav-child">
                  <span>Editar clientes</span>
                  <small>Dados, limites e observações</small>
                </li>
              </ul>
            </div>

            {/* SYNC / OFFLINE */}
            <div
              className={`axis-nav-group ${
                isGroupOpen("sync") ? "open" : ""
              }`}
              data-group="sync"
            >
              <button
                className="axis-nav-parent"
                type="button"
                onClick={() => toggleGroup("sync")}
              >
                <div className="axis-nav-parent-main">
                  <div className="axis-nav-icon">🔁</div>
                  <span className="axis-nav-parent-label">
                    Sync / Offline
                  </span>
                </div>
                <span className="axis-nav-parent-chevron">›</span>
              </button>
              <ul className="axis-nav-children">
                <li className="axis-nav-child">
                  <span>Sincronizar vendas e indicadores</span>
                  <small>/api/sync/sale</small>
                </li>
              </ul>
            </div>

            {/* CONFIG / PERFIL */}
            <div
              className={`axis-nav-group ${
                isGroupOpen("config") ? "open" : ""
              }`}
              data-group="config"
            >
              <button
                className="axis-nav-parent"
                type="button"
                onClick={() => toggleGroup("config")}
              >
                <div className="axis-nav-parent-main">
                  <div className="axis-nav-icon">⚙️</div>
                  <span className="axis-nav-parent-label">
                    Configuração / Perfil
                  </span>
                </div>
                <span className="axis-nav-parent-chevron">›</span>
              </button>
              <ul className="axis-nav-children">
                <li className="axis-nav-child">
                  <span>Token & sessão</span>
                  <small>Gerenciar token atual</small>
                </li>
                <li className="axis-nav-child">
                  <span>Senha & segurança</span>
                  <small>Alterar senha e políticas</small>
                </li>
                <li className="axis-nav-child">
                  <span>Notificações</span>
                  <small>Alertas de vendas, estoque, etc.</small>
                </li>
              </ul>
            </div>
          </div>

          <div className="axis-sidebar-footer">
            <div>
              Logado como {user?.role ?? "ADMIN / OWNER"}.
            </div>
            <div className="axis-sidebar-logout">
              <button
                className="axis-logout-btn"
                type="button"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN / DASHBOARD */}
        <main className="axis-dashboard-main">
          <header className="axis-dashboard-header">
            <div>
              <div className="axis-dashboard-title">Visão geral de hoje</div>
            
            </div>
          </header>

          {/* MÉTRICAS PRINCIPAIS */}
          <section className="axis-metrics-grid">
            <article className="axis-metric-card">
              <div className="axis-metric-label">Faturamento de hoje</div>
              <div className="axis-metric-value">R$ 12.450,90</div>
              <div className="axis-metric-footer">
                +18% vs. ontem • /api/reports/sales-summary
              </div>
            </article>
            <article className="axis-metric-card">
              <div className="axis-metric-label">Vendas concluídas</div>
              <div className="axis-metric-value">134</div>
              <div className="axis-metric-footer">
                Ticket médio R$ 92,90 • /api/sales
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
                Estoque abaixo do mínimo • /api/reports/min-stock
              </div>
            </article>
          </section>

          {/* PAINÉIS – GRÁFICO + TOP SELLERS */}
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
                (Aqui entra o gráfico real no React / lib de charts)
              </div>
            </article>

            <article className="axis-panel">
              <div className="axis-panel-header">
                <div>
                  <div className="axis-panel-title">Top sellers & vendas fracas</div>
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

          {/* PAINÉIS – ESTOQUE MÍNIMO + SYNC */}
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
            As métricas acima são mock para preview. No app real, você vai consumir as rotas <code>/api/reports/*</code>, <code>/api/cash/*</code>, <code>/api/sales</code> e <code>/api/sync/sale</code> usando o <strong>tenantId</strong> do ADMIN / OWNER.
          </p>
        </main>
      </div>
    </div>
  );
}

export default AxisAdminDashboardPage;
