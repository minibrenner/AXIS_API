import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  clearSession,
  getAccessToken,
  getCurrentUser,
  hasAdminAccess,
} from "../auth/session";
import { openCashSession } from "../services/api";
import "./axis-pos.css";
import { AxisPosOpenCashModal } from "./AxisPosOpenCashModal";

const AXIS_LOGO = "/axis-logo.png";

const formatLocalDateTimeForInput = () => {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, "0");
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export default function AxisPosPage() {
  const navigate = useNavigate();
  const accessToken = getAccessToken();
  const user = getCurrentUser();
  const resolvedUserName =
    user?.name && user.name.trim().length > 0 ? user.name : user?.userId ?? "Operador";
  const [currentDateTime] = useState(() => formatLocalDateTimeForInput());

  const [showSplash, setShowSplash] = useState(true);
  const [showOpenCash, setShowOpenCash] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);

  useEffect(() => {
    if (!accessToken || !user) {
      clearSession();
      navigate("/login", { replace: true });
      return;
    }
    if (!hasAdminAccess(user)) {
      navigate("/", { replace: true });
    }
  }, [accessToken, user, navigate]);

  useEffect(() => {
    const splashTimer = setTimeout(() => setShowSplash(false), 1100);
    const modalTimer = setTimeout(() => setShowOpenCash(true), 1250);
    return () => {
      clearTimeout(splashTimer);
      clearTimeout(modalTimer);
    };
  }, []);

  const handleCloseModal = () => {
    setShowOpenCash(false);
    navigate("/admin/dashboard");
  };

  const handleConfirmOpen = async (payload: {
    userName: string;
    dateTime: string;
    cashNumber: string;
    openingAmount: string;
  }) => {
    setFeedback(null);
    if (!payload.cashNumber.trim()) {
      setFeedback({ type: "error", message: "Informe o número do caixa." });
      return;
    }
    const normalizedAmount = payload.openingAmount.replace(/[^\d.,-]/g, "").replace(",", ".");
    const amountNumber = normalizedAmount.length ? Number(normalizedAmount) : NaN;
    if (Number.isNaN(amountNumber)) {
      setFeedback({ type: "error", message: "Informe um valor válido para abertura." });
      return;
    }

    const openingCents = Math.round(amountNumber * 100);
    setIsOpening(true);
    try {
      await openCashSession({
        registerNumber: payload.cashNumber?.trim() || undefined,
        openingCents,
        notes: payload.userName
          ? `Operador: ${payload.userName}${payload.dateTime ? ` | ${payload.dateTime}` : ""}`
          : undefined,
      });
      setFeedback({ type: "success", message: "Caixa aberto com sucesso." });
      setShowOpenCash(false);
      setShowWorkspace(true);
      setShowSplash(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao abrir o caixa.";
      setFeedback({ type: "error", message });
    } finally {
      setIsOpening(false);
    }
  };

  if (showWorkspace) {
    return (
      <AxisPosWorkspace
        operatorName={resolvedUserName}
        currentDate={currentDateTime.split("T")[0]}
        currentTime={currentDateTime.split("T")[1]}
        onBackToDashboard={() => navigate("/admin/dashboard")}
      />
    );
  }

  return (
    <div className="axis-pos-page">
      {showSplash && (
        <div className="axis-pos-splash">
          <div className="axis-pos-splash-logo">
            <img src={AXIS_LOGO} alt="Logo AXIS" />
          </div>
        </div>
      )}

      <div className="axis-pos-stage">
        <header className="axis-pos-topline">
          <div className="axis-pos-brand">
            <div className="axis-pos-brand-dot" />
            <span>AXIS | Caixa de venda</span>
          </div>
          <button
            type="button"
            className="axis-pos-ghost-btn"
            onClick={() => navigate("/admin/dashboard")}
          >
            Voltar para o painel
          </button>
        </header>

        <div className="axis-pos-hero">
          <div className="axis-pos-hero-text">
            <p className="axis-pos-kicker">PDV rápido</p>
            <h1>Abra o caixa para iniciar as vendas</h1>
            <p className="axis-pos-subtitle">
              Validaremos os dados do operador e registraremos o valor inicial
              em dinheiro.
            </p>
            <div className="axis-pos-hero-actions">
              <button
                type="button"
          className="axis-pos-primary-btn"
          onClick={() => setShowOpenCash(true)}
          disabled={isOpening}
        >
          {isOpening ? "Abrindo caixa..." : "Iniciar venda"}
              </button>
              <button
                type="button"
                className="axis-pos-secondary-btn"
                onClick={() => navigate("/admin/dashboard")}
              >
                Cancelar
              </button>
            </div>
            {feedback && (
              <div
                className={`axis-pos-feedback ${
                  feedback.type === "error" ? "axis-pos-feedback--error" : "axis-pos-feedback--success"
                }`}
              >
                {feedback.message}
              </div>
            )}
          </div>
          <div className="axis-pos-hero-card">
            <div className="axis-pos-hero-card-icon">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4.5 10.5L12 4.5L19.5 10.5V17.5
                     C19.5 18.88 18.38 20 17 20H7
                     C5.62 20 4.5 18.88 4.5 17.5V10.5Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 20V14.5H15V20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="axis-pos-hero-card-body">
              <p className="axis-pos-hero-card-title">Fluxo exclusivo de caixa</p>
              <p className="axis-pos-hero-card-sub">
                Tela dedicada, sem distrações, para registrar a abertura e
                pagamentos.
              </p>
              <span className="axis-pos-pill">Disponível</span>
            </div>
          </div>
        </div>
      </div>

      <AxisPosOpenCashModal
        userName={resolvedUserName}
        dateTime={currentDateTime}
        isOpen={showOpenCash}
        isSubmitting={isOpening}
        feedback={feedback}
        onCancel={handleCloseModal}
        onConfirm={handleConfirmOpen}
      />
    </div>
  );
}

function AxisPosWorkspace(props: {
  operatorName: string;
  currentDate: string;
  currentTime: string;
  onBackToDashboard: () => void;
}) {
  const { operatorName, currentDate, currentTime, onBackToDashboard } = props;

  const formattedDate = (() => {
    const [year, month, day] = currentDate.split("-");
    return `${day}/${month}/${year}`;
  })();

  return (
    <div className="axis-pos-root">
      <aside className="axis-pos-sidebar">
        <div className="axis-pos-sidebar-logo">AXIS POS</div>

        <div className="axis-pos-sidebar-group">
          <button className="axis-pos-sidebar-button axis-pos-sidebar-button--primary">
            <span className="axis-pos-sidebar-button-icon">🛒</span>
            <span>Nova venda</span>
          </button>

          <button className="axis-pos-sidebar-button">
            <span className="axis-pos-sidebar-button-icon">👥</span>
            <span>Clientes</span>
          </button>

          <button className="axis-pos-sidebar-button">
            <span className="axis-pos-sidebar-button-icon">📄</span>
            <span>Resgatar pré-venda</span>
          </button>

          <button className="axis-pos-sidebar-button">
            <span className="axis-pos-sidebar-button-icon">🧮</span>
            <span>Orçamentos</span>
          </button>

          <button className="axis-pos-sidebar-button">
            <span className="axis-pos-sidebar-button-icon">🔁</span>
            <span>Realizar troca</span>
          </button>

          <button className="axis-pos-sidebar-button">
            <span className="axis-pos-sidebar-button-icon">💵</span>
            <span>Caixa</span>
          </button>

          <button className="axis-pos-sidebar-button">
            <span className="axis-pos-sidebar-button-icon">⛔</span>
            <span>Cancelamento</span>
          </button>

          <button className="axis-pos-sidebar-button">
            <span className="axis-pos-sidebar-button-icon">🖨️</span>
            <span>Reimprimir</span>
          </button>
        </div>

        <div className="axis-pos-sidebar-footer">AXIS Softwares • PDV Web</div>
      </aside>

      <header className="axis-pos-topbar">
        <div className="axis-pos-topbar-left">
          <div>
            <div className="axis-pos-topbar-item-label">Status</div>
            <div className="axis-pos-topbar-item-value">PDV_LOJA_01 • Caixa 01</div>
          </div>

          <div>
            <div className="axis-pos-topbar-item-label">Movimentos a sincronizar</div>
            <div className="axis-pos-topbar-item-value">1 pendente</div>
          </div>

          <div>
            <div className="axis-pos-topbar-item-label">SAT / NFC-e</div>
            <div className="axis-pos-topbar-item-value">SAT ativo • NFC-e OK</div>
          </div>
        </div>

        <div className="axis-pos-topbar-right">
          <div style={{ display: "flex", alignItems: "center" }}>
            <span className="axis-pos-status-dot" />
            <span>Online</span>
          </div>

          <div>
            <div className="axis-pos-topbar-item-label">Operador</div>
            <div className="axis-pos-topbar-item-value">
              {operatorName} • {currentTime}
            </div>
          </div>

          <div>
            <div className="axis-pos-topbar-item-label">Data</div>
            <div className="axis-pos-topbar-item-value">{formattedDate}</div>
          </div>

          <button
            type="button"
            className="axis-pos-ghost-btn"
            onClick={onBackToDashboard}
            style={{ marginLeft: "1rem" }}
          >
            Voltar ao painel
          </button>
        </div>
      </header>

      <main className="axis-pos-center">
        <div className="axis-pos-cart-header">
          <span>Produto</span>
          <span>Quantidade</span>
          <span>Total (R$)</span>
          <span />
        </div>

        <div className="axis-pos-cart-list">
          <div className="axis-pos-cart-row">
            <div>
              <div className="axis-pos-cart-product-name">Refrigerante Lata 350ml</div>
              <div className="axis-pos-cart-product-meta">SKU: REF-LATA-350 • UN • R$ 4,99</div>
            </div>

            <div>
              <div className="axis-pos-cart-qty-control">
                <button className="axis-pos-cart-qty-btn">-</button>
                <input className="axis-pos-cart-qty-input" value="01" readOnly />
                <button className="axis-pos-cart-qty-btn">+</button>
              </div>
            </div>

            <div className="axis-pos-cart-price">R$ 4,99</div>

            <button className="axis-pos-cart-remove">×</button>
          </div>

          <div className="axis-pos-cart-row">
            <div>
              <div className="axis-pos-cart-product-name">Água Mineral 500ml sem gás</div>
              <div className="axis-pos-cart-product-meta">SKU: AGUA-500 • UN • R$ 2,50</div>
            </div>

            <div>
              <div className="axis-pos-cart-qty-control">
                <button className="axis-pos-cart-qty-btn">-</button>
                <input className="axis-pos-cart-qty-input" value="02" readOnly />
                <button className="axis-pos-cart-qty-btn">+</button>
              </div>
            </div>

            <div className="axis-pos-cart-price">R$ 5,00</div>

            <button className="axis-pos-cart-remove">×</button>
          </div>

          <div className="axis-pos-cart-row">
            <div>
              <div className="axis-pos-cart-product-name">Pacote de Carvão 5kg</div>
              <div className="axis-pos-cart-product-meta">SKU: CARVAO-5KG • UN • R$ 19,90</div>
            </div>

            <div>
              <div className="axis-pos-cart-qty-control">
                <button className="axis-pos-cart-qty-btn">-</button>
                <input className="axis-pos-cart-qty-input" value="01" readOnly />
                <button className="axis-pos-cart-qty-btn">+</button>
              </div>
            </div>

            <div className="axis-pos-cart-price">R$ 19,90</div>

            <button className="axis-pos-cart-remove">×</button>
          </div>
        </div>

        <section className="axis-pos-center-footer">
          <div className="axis-pos-center-totals">
            <div>
              <div className="axis-pos-center-total-item-label">Último item</div>
              <div className="axis-pos-center-total-item-value">R$ 19,90</div>
            </div>

            <div>
              <div className="axis-pos-center-total-item-label">Volumes</div>
              <div className="axis-pos-center-total-item-value">04</div>
            </div>

            <div>
              <div className="axis-pos-center-total-item-label">Total</div>
              <div className="axis-pos-center-total-item-value">R$ 29,89</div>
            </div>
          </div>

          <div className="axis-pos-center-actions">
            <button className="axis-pos-center-btn axis-pos-center-btn--danger">
              Cancelar venda aberta
            </button>

            <button className="axis-pos-center-btn axis-pos-center-btn--warning">
              Salvar pré-venda
            </button>

            <button className="axis-pos-center-btn axis-pos-center-btn--success">
              Finalizar venda
            </button>
          </div>
        </section>
      </main>

      <aside className="axis-pos-right">
        <section className="axis-pos-client-card">
          <div className="axis-pos-client-name">
            <span>Cliente AXIS</span>
            <span>Selecionar cliente</span>
          </div>

          <div className="axis-pos-client-row">
            <label className="axis-label">
              CPF
              <input className="axis-input" placeholder="000.000.000-00" />
            </label>

            <label className="axis-label">
              Código
              <input className="axis-input" placeholder="Código interno" />
            </label>
          </div>
        </section>

        <section className="axis-pos-product-search">
          <div className="axis-pos-product-search-left">
            <label className="axis-label">
              Produto
              <input
                className="axis-input"
                placeholder="Buscar por nome, SKU ou código de barras"
              />
            </label>

            <div className="axis-pos-product-preview">Imagem do produto</div>
          </div>

          <div className="axis-pos-price-qty">
            <div className="axis-pos-price-row">
              <span>Preço</span>
              <span className="axis-pos-price-value">R$ 4,99</span>
            </div>

            <small style={{ fontSize: "0.75rem", color: "#6b7280" }}>
              Clique no preço para aplicar desconto em R$ ou %
            </small>

            <div className="axis-pos-qty-row">
              <span>Quantidade</span>

              <div className="axis-pos-qty-control">
                <button className="axis-pos-qty-btn">-</button>
                <input className="axis-pos-qty-input" value="01" readOnly />
                <button className="axis-pos-qty-btn">+</button>
              </div>
            </div>
          </div>
        </section>

        <section className="axis-pos-keypad">
          <div className="axis-pos-keypad-grid">
            <button className="axis-pos-keypad-btn">7</button>
            <button className="axis-pos-keypad-btn">8</button>
            <button className="axis-pos-keypad-btn">9</button>

            <button className="axis-pos-keypad-btn">4</button>
            <button className="axis-pos-keypad-btn">5</button>
            <button className="axis-pos-keypad-btn">6</button>

            <button className="axis-pos-keypad-btn">1</button>
            <button className="axis-pos-keypad-btn">2</button>
            <button className="axis-pos-keypad-btn">3</button>

            <button className="axis-pos-keypad-btn axis-pos-keypad-btn--zero">0</button>
          </div>

          <div className="axis-pos-keypad-actions">
            <button className="axis-pos-keypad-action-btn axis-pos-keypad-action-btn--clear-field">
              Limpar campo selecionado
            </button>

            <button className="axis-pos-keypad-action-btn axis-pos-keypad-action-btn--clear-item">
              Limpar item atual
            </button>

            <button className="axis-pos-keypad-action-btn axis-pos-keypad-action-btn--confirm">
              Confirmar (adicionar à venda)
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}
