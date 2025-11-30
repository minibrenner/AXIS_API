import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  clearSession,
  getAccessToken,
  getCurrentUser,
  hasAdminAccess,
} from "../auth/session";
import {
  CashSession,
  closeCashSession,
  fetchOpenCashSession,
  listProducts,
  listStockLocations,
  openCashSession,
  type Product,
  fetchSaleReceipt,
  ensureSessionAlive,
  createSale,
} from "../services/api";
import "./axis-pos.css";
import { AxisPosOpenCashModal } from "./AxisPosOpenCashModal";
import { AxisPosCloseCashModal } from "./AxisPosCloseCashModal";

const AXIS_LOGO = "/axis-logo.png";
const PRINT_MODE = import.meta.env.VITE_PRINT_MODE ?? "dev";

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

type ProductOption = Product & { priceCents?: number; barcode?: string | null };

type CartItem = {
  id: string;
  name: string;
  sku?: string | null;
  priceCents: number;
  qty: number;
  discountPercent?: number;
  locationId?: string;
};

const mockProducts: ProductOption[] = [
  
];

const mockClients: Array<{ cpf: string; name: string; code?: string }> = [
  { cpf: "12345678901", name: "Cliente AXIS", code: "C123" },
];

const formatCurrency = (valueCents: number) =>
  `R$ ${(valueCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AxisPosPage() {
  const navigate = useNavigate();
  const [accessToken] = useState(() => getAccessToken());
  const [user] = useState(() => getCurrentUser());
  const resolvedUserName =
    user?.name && user.name.trim().length > 0 ? user.name : user?.userId ?? "Operador";
  const [currentDateTime] = useState(() => formatLocalDateTimeForInput());

  const [showSplash, setShowSplash] = useState(true);
  const [showOpenCash, setShowOpenCash] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [showCloseCash, setShowCloseCash] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [closeFeedback, setCloseFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [products, setProducts] = useState<ProductOption[]>(mockProducts);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductOption[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedCartItemId, setSelectedCartItemId] = useState<string | null>(null);
  const [priceModalItem, setPriceModalItem] = useState<CartItem | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [activeKeypadTarget, setActiveKeypadTarget] = useState<string>("search");
  const [priceFeedback, setPriceFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [supervisorSecretForDiscount, setSupervisorSecretForDiscount] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<"sale" | "presales">("sale");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    "cash" | "debit" | "credit" | "pix" | "vr" | "va" | "store_credit" | null
  >(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [payments, setPayments] = useState<
    Array<{ method: "cash" | "debit" | "credit" | "pix" | "vr" | "va" | "store_credit"; amountCents: number }>
  >([]);
  const [saleDiscountType, setSaleDiscountType] = useState<"none" | "value" | "percent">("none");
  const [saleDiscountValue, setSaleDiscountValue] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);
  const [saleLocationId, setSaleLocationId] = useState<string | null>(null);
  const [paymentFeedback, setPaymentFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [preSales, setPreSales] = useState<
    Array<{
      id: string;
      items: CartItem[];
      customer: {
        label: string;
        cpf: string;
        cpfConfirmed: boolean;
        code: string;
        codeConfirmed: boolean;
      };
      createdAt: number;
    }>
  >([]);
  const [customerLabel, setCustomerLabel] = useState("Cliente AXIS");
  const [cpfInput, setCpfInput] = useState("");
  const [cpfConfirmed, setCpfConfirmed] = useState(false);
  const [customerCodeInput, setCustomerCodeInput] = useState("");
  const [customerCodeConfirmed, setCustomerCodeConfirmed] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !user) {
      clearSession();
      navigate("/login", { replace: true });
      return;
    }
    if (!hasAdminAccess(user)) {
      navigate("/", { replace: true });
    }
  }, [accessToken, user?.userId, navigate]);

  useEffect(() => {
    const handleEnterKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      if (priceModalItem) {
        event.preventDefault();
        applyPriceChanges();
        return;
      }
      if (activeKeypadTarget === "search") {
        event.preventDefault();
        handleAddProductFromSearch();
        return;
      }
      if (activeKeypadTarget?.startsWith("qty:")) {
        event.preventDefault();
        handleConfirmKeypad();
      }
    };

    window.addEventListener("keydown", handleEnterKey);
    return () => window.removeEventListener("keydown", handleEnterKey);
  }, [activeKeypadTarget, priceModalItem]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const enterFullscreen = async () => {
    if (document.fullscreenElement) return;
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // ignore
    }
  };

  // Mantém a sessão viva no PDV para evitar logout por inatividade
  useEffect(() => {
    const KEEP_ALIVE_INTERVAL = 8 * 60 * 1000; // 8 minutos
    let timer: number | undefined;
    const tick = async () => {
      try {
        await ensureSessionAlive();
        setSessionError(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Falha ao renovar sessão.";
        setSessionError(msg);
      }
    };
    timer = window.setInterval(tick, KEEP_ALIVE_INTERVAL);
    // roda uma vez ao montar para garantir que o refresh funcione
    tick();
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, []);

  const exitFullscreen = async () => {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch {
      // ignore
    }
  };

  const clearSaleState = () => {
    setCartItems([]);
    setSelectedCartItemId(null);
    clearCustomer();
    setSearchQuery("");
    setSearchResults([]);
    setPriceModalItem(null);
    setPriceInput("");
    setDiscountInput("");
    setActiveKeypadTarget("search");
    setPriceFeedback(null);
    setSupervisorSecretForDiscount("");
    setPayments([]);
    setPaymentAmount("");
    setSaleDiscountType("none");
    setSaleDiscountValue("");
    setPaymentFeedback(null);
    setShowPaymentModal(false);
  };

  const hasDraft =
    cartItems.length > 0 ||
    cpfConfirmed ||
    customerCodeConfirmed ||
    customerLabel !== "Cliente AXIS";

  const ensureDraftSavedToPreSale = (autoFeedback = false) => {
    if (!hasDraft) return false;
    const id = `pre_${Date.now()}`;
    setPreSales((prev) => [
      {
        id,
        items: cartItems.map((item) => ({ ...item })),
        customer: {
          label: customerLabel,
          cpf: cpfInput,
          cpfConfirmed,
          code: customerCodeInput,
          codeConfirmed: customerCodeConfirmed,
        },
        createdAt: Date.now(),
      },
      ...prev,
    ]);
    clearSaleState();
    if (autoFeedback) {
      setFeedback({ type: "success", message: "Pré-venda salva automaticamente." });
    }
    return true;
  };

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const apiProducts = await listProducts();
        if (Array.isArray(apiProducts) && apiProducts.length > 0) {
          const normalized = apiProducts.map((p) => ({
            ...p,
            priceCents: (() => {
              const raw = (p as ProductOption).price ?? "0";
              const parsed = Number(String(raw).replace(",", "."));
              return Number.isNaN(parsed) ? 0 : Math.round(parsed * 100);
            })(),
          })) as ProductOption[];
          setProducts(normalized);
        }
      } catch {
        // mantém mock se falhar
      }
    };
    loadProducts();
  }, []);

  useEffect(() => {
    const loadSaleLocation = async () => {
      try {
        const locations = await listStockLocations();
        if (locations && locations.length > 0) {
          const saleSource =
            locations.find((l) => l.isSaleSource) ??
            locations[0];
          setSaleLocationId(saleSource.id);
        }
      } catch {
        // fallback: keep null, front valida depois
      }
    };
    loadSaleLocation();
  }, []);

  useEffect(() => {
    if (!accessToken || !user) {
      setIsCheckingSession(false);
      return;
    }

    let isActive = true;

    const loadOpenSession = async () => {
      setIsCheckingSession(true);
      try {
        const session = await fetchOpenCashSession();
        if (!isActive) return;
        if (session) {
          setCashSession(session);
          setShowWorkspace(true);
          setShowOpenCash(false);
          setShowSplash(false);
          setFeedback(null);
        } else {
          setCashSession(null);
          setShowWorkspace(false);
          setShowOpenCash(true);
          setShowSplash(false);
          setFeedback(null);
        }
      } catch (error) {
        if (!isActive) return;
        const message =
          error instanceof Error ? error.message : "Falha ao buscar sessao de caixa.";
        setFeedback({ type: "error", message });
        setShowWorkspace(false);
        setShowOpenCash(true);
        setShowSplash(false);
      } finally {
        if (isActive) {
          setIsCheckingSession(false);
        }
      }
    };

    loadOpenSession();

    return () => {
      isActive = false;
    };
  }, [accessToken, user?.userId]);

  useEffect(() => {
    if (isCheckingSession) return;
    const splashTimer = setTimeout(() => setShowSplash(false), 1100);
    const modalTimer = setTimeout(() => {
      if (!showWorkspace) {
        setShowOpenCash(true);
      }
    }, 1250);
    return () => {
      clearTimeout(splashTimer);
      clearTimeout(modalTimer);
    };
  }, [isCheckingSession, showWorkspace]);

  const handleCloseModal = () => {
    setShowOpenCash(false);
    navigate("/admin/dashboard");
  };

  const handleCloseCloseModal = () => {
    setShowCloseCash(false);
    setCloseFeedback(null);
  };

  const handleStartSale = async () => {
    setFeedback(null);
    if (isCheckingSession) return;
    try {
      const session = await fetchOpenCashSession();
      if (session) {
        setCashSession(session);
        setShowWorkspace(true);
        setShowOpenCash(false);
        setShowSplash(false);
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao buscar sessao de caixa.";
      setFeedback({ type: "error", message });
    }
    setShowOpenCash(true);
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
      const session = await openCashSession({
        registerNumber: payload.cashNumber?.trim() || undefined,
        openingCents,
        notes: payload.userName
          ? `Operador: ${payload.userName}${payload.dateTime ? ` | ${payload.dateTime}` : ""}`
          : undefined,
      });
      setCashSession(session);
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

  const requiresSupervisor = user?.role === "ATTENDANT";

  const handleRequestCloseCash = async () => {
    setCloseFeedback(null);
    if (cartItems.length > 0 || preSales.length > 0) {
      setFeedback({
        type: "error",
        message: "Finalize ou cancele a venda antes de fechar o caixa (há itens ou pré-vendas).",
      });
      return;
    }
    if (!cashSession?.id) {
      try {
        const session = await fetchOpenCashSession();
        if (session) {
          setCashSession(session);
          setShowCloseCash(true);
          return;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao buscar sessao de caixa.";
        setFeedback({ type: "error", message });
        return;
      }
      setFeedback({ type: "error", message: "Nenhum caixa aberto para fechar." });
      return;
    }
    setShowCloseCash(true);
  };

  const handleSavePreSale = (auto = false) => {
    if (!cartItems.length) {
      if (!auto) {
        setFeedback({ type: "error", message: "Adicione itens para salvar a pré-venda." });
      }
      return false;
    }
    ensureDraftSavedToPreSale(!auto);
    return true;
  };

  const handleOpenPreSales = (autoSaveDraft = false) => {
    if (autoSaveDraft) {
      ensureDraftSavedToPreSale(true);
    }
    setViewMode("presales");
  };

  const handleRestorePreSale = (id: string) => {
    const pre = preSales.find((p) => p.id === id);
    if (!pre) return;
    setPreSales((prev) => prev.filter((p) => p.id !== id));
    setCartItems(pre.items);
    setSelectedCartItemId(pre.items[0]?.id ?? null);
    setCustomerLabel(pre.customer.label);
    setCpfInput(pre.customer.cpf);
    setCpfConfirmed(pre.customer.cpfConfirmed);
    setCustomerCodeInput(pre.customer.code);
    setCustomerCodeConfirmed(pre.customer.codeConfirmed);
    setViewMode("sale");
  };

  const handleFinalizeClick = () => {
    if (!cartItems.length) {
      setPaymentFeedback({ type: "error", message: "Adicione itens antes de finalizar a venda." });
      return;
    }
    if (!cashSession?.id) {
      setPaymentFeedback({ type: "error", message: "Abra um caixa antes de finalizar a venda." });
      return;
    }
    const { netTotalCents } = calculateSaleTotals();
    const paidSoFar = payments.reduce((acc, p) => acc + p.amountCents, 0);
    const remaining = Math.max(netTotalCents - paidSoFar, 0);
    setPaymentAmount(remaining > 0 ? formatCentsForInput(remaining) : "");
    setActiveKeypadTarget("payment");
    setShowPaymentModal(true);
  };

  const handleAddPayment = () => {
    if (!selectedPaymentMethod) {
      setPaymentFeedback({ type: "error", message: "Selecione um metodo de pagamento." });
      return;
    }
    const amountCents = parsePaymentAmount(paymentAmount);
    if (!amountCents) {
      setPaymentFeedback({ type: "error", message: "Informe um valor valido para o pagamento." });
      return;
    }
    const { netTotalCents } = calculateSaleTotals();
    const paidSoFar = payments.reduce((acc, p) => acc + p.amountCents, 0);
    const remaining = Math.max(netTotalCents - paidSoFar, 0);
    if (selectedPaymentMethod !== "cash" && amountCents > remaining) {
      setPaymentFeedback({
        type: "error",
        message: "Pagamento excede o valor restante. Apenas dinheiro pode gerar troco.",
      });
      return;
    }
    const updatedPayments = [...payments, { method: selectedPaymentMethod, amountCents }];
    const newPaid = paidSoFar + amountCents;
    const newRemaining = Math.max(netTotalCents - newPaid, 0);
    setPayments(updatedPayments);
    setPaymentAmount(newRemaining > 0 ? formatCentsForInput(newRemaining) : "");
    setSelectedPaymentMethod(null);
    setPaymentFeedback(null);
  };

  const applySaleDiscount = (totalCents: number) => {
    if (saleDiscountType === "none") return { discount: undefined, netTotal: totalCents };
    if (saleDiscountType === "value") {
      const value = Number(saleDiscountValue.replace(/[^\d.,-]/g, "").replace(",", "."));
      const valueCents = Number.isNaN(value) ? 0 : Math.max(0, Math.round(value * 100));
      if (valueCents <= 0) return { discount: undefined, netTotal: totalCents };
      const net = Math.max(0, totalCents - valueCents);
      return { discount: { type: "value" as const, valueCents }, netTotal: net };
    }
    const pct = Number(saleDiscountValue);
    const pctValid = !Number.isNaN(pct) && pct > 0 && pct < 100 ? pct : 0;
    if (pctValid <= 0) return { discount: undefined, netTotal: totalCents };
    const valueCents = Math.round((totalCents * pctValid) / 100);
    const net = Math.max(0, totalCents - valueCents);
    return { discount: { type: "percent" as const, percent: pctValid }, netTotal: net };
  };

  const formatCentsForInput = (valueCents: number) => (valueCents / 100).toFixed(2).replace(".", ",");

  const parsePaymentAmount = (raw: string) => {
    const normalizedAmount = raw.replace(/[^\d.,-]/g, "").replace(",", ".");
    const parsed = normalizedAmount.length ? Number(normalizedAmount) : NaN;
    if (Number.isNaN(parsed) || parsed <= 0) {
      return null;
    }
    return Math.round(parsed * 100);
  };

  const buildSaleItems = () =>
    cartItems.map((item) => ({
      productId: item.id,
      name: item.name,
      sku: item.sku ?? undefined,
      qty: item.qty,
      unitPriceCents: item.priceCents,
      discount:
        item.discountPercent && item.discountPercent > 0
          ? { type: "percent" as const, percent: item.discountPercent }
          : undefined,
    }));

  const calculateSaleTotals = () => {
    const items = buildSaleItems().filter((item) => item.qty > 0);
    const grossTotalCents = items.reduce((acc, item) => {
      const base = item.unitPriceCents;
      const discounted =
        item.discount?.type === "percent"
          ? Math.max(0, Math.round(base * (1 - (item.discount.percent ?? 0) / 100)))
          : base;
      return acc + discounted * item.qty;
    }, 0);

    const { discount, netTotal } = applySaleDiscount(grossTotalCents);
    return { items, grossTotalCents, netTotalCents: netTotal, discount };
  };

  const openReceiptPrintWindow = (receipt: Awaited<ReturnType<typeof fetchSaleReceipt>>) => {
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;

    const formatBRL = (value: number) =>
      (value / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const itemsHtml = receipt.items
      .map(
        (item) => `
          <tr>
            <td>${item.name}</td>
            <td style="text-align:right;">${item.qty}</td>
            <td style="text-align:right;">R$ ${formatBRL(item.totalCents)}</td>
          </tr>
        `,
      )
      .join("");

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Recibo de venda</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 16px; }
            h1 { font-size: 18px; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { padding: 4px 0; font-size: 13px; }
            th { border-bottom: 1px solid #ccc; text-align: left; }
            tfoot td { border-top: 1px solid #ccc; font-weight: bold; }
            .totais { margin-top: 16px; font-size: 14px; }
            .header { margin-bottom: 10px; font-size: 13px; }
          </style>
        </head>
        <body>
          <h1>Recibo de venda #${receipt.number ?? receipt.saleId}</h1>
          <div class="header">
            <div>${receipt.tenant?.name ?? ""}</div>
            ${receipt.tenant?.cnpj ? `<div>CNPJ: ${receipt.tenant.cnpj}</div>` : ""}
            ${receipt.tenant?.address ? `<div>${receipt.tenant.address}</div>` : ""}
            ${receipt.operatorName ? `<div>Operador: ${receipt.operatorName}</div>` : ""}
            ${receipt.registerNumber ? `<div>Caixa: ${receipt.registerNumber}</div>` : ""}
            <div>${new Date(receipt.createdAt).toLocaleString("pt-BR")}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th style="text-align:right;">Qtde</th>
                <th style="text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totais">
            <div>Total: <strong>R$ ${formatBRL(receipt.totalCents)}</strong></div>
            <div>Pago: <strong>R$ ${formatBRL(receipt.paidCents)}</strong></div>
            <div>Troco: <strong>R$ ${formatBRL(receipt.changeCents)}</strong></div>
          </div>

          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `;

    w.document.write(html);
    w.document.close();
  };

  const validatePaymentsAgainstTotal = (
    list: Array<{
      method: "cash" | "debit" | "credit" | "pix" | "vr" | "va" | "store_credit";
      amountCents: number;
    }>,
    netTotalCents: number,
  ) => {
    let remaining = netTotalCents;
    for (const payment of list) {
      const effectiveRemaining = Math.max(remaining, 0);
      if (payment.method !== "cash" && payment.amountCents > effectiveRemaining) {
        return "Pagamentos nao podem exceder o valor restante (apenas dinheiro pode gerar troco).";
      }
      remaining -= payment.amountCents;
    }
    const totalPaid = list.reduce((acc, p) => acc + p.amountCents, 0);
    if (totalPaid < netTotalCents) {
      return "Valor pago e menor que o total da venda.";
    }
    return { changeCents: Math.max(-remaining, 0) };
  };

  const handleFinalizeSale = async () => {
    setPaymentFeedback(null);
    setFeedback(null);
    if (!cashSession?.id) {
      setPaymentFeedback({ type: "error", message: "Abra um caixa antes de finalizar a venda." });
      return;
    }
    if (!cartItems.length) {
      setPaymentFeedback({ type: "error", message: "Carrinho vazio." });
      return;
    }
    if (!saleLocationId) {
      setPaymentFeedback({ type: "error", message: "Selecione um depósito para a venda." });
      return;
    }

    const pendingPayment =
      selectedPaymentMethod && paymentAmount.trim().length > 0
        ? (() => {
            const amountCents = parsePaymentAmount(paymentAmount);
            if (!amountCents) {
              setPaymentFeedback({ type: "error", message: "Informe um valor valido para o pagamento." });
              return null;
            }
            return { method: selectedPaymentMethod, amountCents };
          })()
        : null;

    const paymentList = pendingPayment ? [...payments, pendingPayment] : payments;

    if (!paymentList.length) {
      setPaymentFeedback({ type: "error", message: "Adicione pelo menos um pagamento." });
      return;
    }

    const { items, netTotalCents, discount } = calculateSaleTotals();
    if (!items.length) {
      setPaymentFeedback({ type: "error", message: "Carrinho vazio ou quantidades zeradas." });
      return;
    }

    const validation = validatePaymentsAgainstTotal(paymentList, netTotalCents);
    if (typeof validation === "string") {
      setPaymentFeedback({ type: "error", message: validation });
      return;
    }

    setIsFinishing(true);
    try {
      const saleInput = {
        cashSessionId: cashSession.id,
        locationId: saleLocationId,
        items,
        payments: paymentList,
        discount,
        fiscalMode: "none" as const,
      };

      const response = await createSale({
        sale: saleInput,
        supervisorSecret: supervisorSecretForDiscount || undefined,
        idempotencyKey: crypto.randomUUID(),
      });

      if ("duplicate" in response) {
        setPaymentFeedback({ type: "success", message: "Venda ja enviada anteriormente." });
        clearSaleState();
        return;
      }

      const sale = response.sale;
      if (PRINT_MODE === "dev" && sale?.id) {
        try {
          const receipt = await fetchSaleReceipt(sale.id);
          openReceiptPrintWindow(receipt);
        } catch (err) {
          console.error("Falha ao imprimir recibo em modo dev:", err);
        }
      }
      clearSaleState();
      setShowPaymentModal(false);
      setSelectedPaymentMethod(null);
      setFeedback({
        type: "success",
        message: `Venda ${sale?.number ?? ""} finalizada com sucesso.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao finalizar a venda.";
      if (message.toLowerCase().includes("sess") || message.toLowerCase().includes("tenant")) {
        setSessionError("Sessão expirada. Tente novamente ou refaça login.");
      }
      setPaymentFeedback({ type: "error", message });
    } finally {
      setIsFinishing(false);
    }
  };

  const handleConfirmClose = async (payload: {
    closingAmount: string;
    supervisorSecret: string;
    notes?: string;
  }) => {
    if (!cashSession?.id) {
      setCloseFeedback({ type: "error", message: "Nenhum caixa aberto para fechar." });
      return;
    }

    setCloseFeedback(null);
    const normalizedAmount = payload.closingAmount.replace(/[^\d.,-]/g, "").replace(",", ".");
    const amountNumber = normalizedAmount.length ? Number(normalizedAmount) : NaN;
    if (Number.isNaN(amountNumber)) {
      setCloseFeedback({ type: "error", message: "Informe um valor válido para fechamento." });
      return;
    }
    if (requiresSupervisor) {
      if (!payload.supervisorSecret || payload.supervisorSecret.trim().length < 4) {
        setCloseFeedback({ type: "error", message: "Informe o PIN ou senha do supervisor." });
        return;
      }
    }

    const closingCents = Math.round(amountNumber * 100);
    setIsClosing(true);
    try {
      await closeCashSession({
        cashSessionId: cashSession.id,
        closingCents,
        supervisorSecret: requiresSupervisor ? payload.supervisorSecret.trim() : undefined,
        notes: payload.notes?.trim() || undefined,
      });
      setCloseFeedback({ type: "success", message: "Caixa fechado com sucesso." });
      setCashSession(null);
      setShowCloseCash(false);
      setShowWorkspace(false);
      setShowOpenCash(false);
      setShowSplash(false);
      setFeedback(null);
      navigate("/admin/dashboard", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao fechar o caixa.";
      setCloseFeedback({ type: "error", message });
    } finally {
      setIsClosing(false);
    }
  };

  useEffect(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) {
      setSearchResults([]);
      return;
    }
    const filtered = products.filter((product) => {
      const tokens = [product.name, product.sku, (product as ProductOption).barcode].filter(Boolean);
      return tokens.some((token) => token!.toLowerCase().includes(term));
    });
    setSearchResults(filtered);
  }, [searchQuery, products]);

  const upsertCartItem = (product: ProductOption, qty = 1) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      const updated = existing
        ? { ...existing, qty: Math.max(1, existing.qty + qty) }
        : {
            id: product.id,
            name: product.name,
            sku: product.sku,
            priceCents: product.priceCents ?? 0,
            qty: Math.max(1, qty),
          };
      const without = prev.filter((item) => item.id !== product.id);
      return [updated, ...without];
    });
    setSelectedCartItemId(product.id);
  };

  const handleAddProductFromSearch = (product?: ProductOption) => {
    const target = product ?? searchResults[0];
    if (!target) return;
    upsertCartItem(target, 1);
    setSearchQuery("");
    setSearchResults([]);
  };

  const updateItemQty = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item,
      ),
    );
  };

  const removeItem = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
    if (selectedCartItemId === id) {
      setSelectedCartItemId(null);
    }
  };

  const openPriceModal = (item: CartItem) => {
    setPriceModalItem(item);
    setPriceInput((item.priceCents / 100).toFixed(2));
    setDiscountInput(item.discountPercent ? String(item.discountPercent) : "");
    setActiveKeypadTarget("price");
    setPriceFeedback(null);
    setSupervisorSecretForDiscount("");
  };

  const applyPriceChanges = () => {
    if (!priceModalItem) return;

    const newPriceNumber = priceInput.trim().length
      ? Number(priceInput.replace(/[^\d.,-]/g, "").replace(",", "."))
      : null;
    if (newPriceNumber !== null && (Number.isNaN(newPriceNumber) || newPriceNumber < 0)) {
      setPriceFeedback({ type: "error", message: "Preço inválido." });
      return;
    }

    const discountNumber = discountInput.trim().length ? Number(discountInput) : null;
    if (discountNumber !== null && (Number.isNaN(discountNumber) || discountNumber < 0 || discountNumber >= 100)) {
      setPriceFeedback({ type: "error", message: "Desconto deve ser menor que 100%." });
      return;
    }

    const isAttendant = user?.role === "ATTENDANT";
    if (isAttendant) {
      if (!supervisorSecretForDiscount || supervisorSecretForDiscount.trim().length < 4) {
        setPriceFeedback({ type: "error", message: "Informe o PIN/senha de supervisor." });
        return;
      }
    }

    setCartItems((prev) =>
      prev.map((item) =>
        item.id === priceModalItem.id
          ? {
              ...item,
              priceCents:
                newPriceNumber !== null ? Math.round(newPriceNumber * 100) : item.priceCents,
              discountPercent: discountNumber ?? undefined,
            }
          : item,
      ),
    );
    setPriceModalItem(null);
    setPriceInput("");
    setDiscountInput("");
    setActiveKeypadTarget(null);
    setPriceFeedback(null);
    setSupervisorSecretForDiscount("");
  };

  const applyKeypadInput = (digit: string) => {
    if (!activeKeypadTarget) return;

    if (activeKeypadTarget.startsWith("qty:")) {
      const targetId = activeKeypadTarget.split(":")[1];
      setCartItems((prev) =>
        prev.map((item) =>
          item.id === targetId
            ? { ...item, qty: Math.max(0, Number(`${item.qty}${digit}`) || item.qty) }
            : item,
        ),
      );
      return;
    }

    if (activeKeypadTarget === "price") {
      setPriceInput((prev) => `${prev}${digit}`);
      return;
    }

    if (activeKeypadTarget === "discount") {
      setDiscountInput((prev) => `${prev}${digit}`);
      return;
    }

    if (activeKeypadTarget === "search") {
      setSearchQuery((prev) => `${prev}${digit}`);
      return;
    }

    if (activeKeypadTarget === "payment") {
      setPaymentAmount((prev) => `${prev}${digit}`);
      return;
    }
  };

  const clearActiveField = () => {
    if (activeKeypadTarget.startsWith("qty:")) {
      const targetId = activeKeypadTarget.split(":")[1];
      setCartItems((prev) =>
        prev.map((item) => (item.id === targetId ? { ...item, qty: 0 } : item)),
      );
      return;
    }
    if (activeKeypadTarget === "price") {
      setPriceInput("0");
      return;
    }
    if (activeKeypadTarget === "discount") {
      setDiscountInput("0");
      return;
    }
    if (activeKeypadTarget === "payment") {
      setPaymentAmount("");
      return;
    }
    if (activeKeypadTarget === "search") {
      setSearchQuery("");
      setSearchResults([]);
    }
  };

  const handleConfirmKeypad = () => {
    if (activeKeypadTarget === "search") {
      handleAddProductFromSearch();
      return;
    }
    if (priceModalItem) {
      applyPriceChanges();
      return;
    }
    if (showPaymentModal && selectedPaymentMethod) {
      handleAddPayment();
    }
  };

  const handleSelectCustomer = async () => {
    const cleanCpf = cpfInput.replace(/\D/g, "");
    if (cleanCpf.length !== 11) return;
    const found = mockClients.find((c) => c.cpf === cleanCpf);
    const resolvedName = found?.name ? `Cliente: ${found.name}` : `Cliente: ${cleanCpf}`;
    setCustomerLabel(resolvedName);
    setCpfConfirmed(true);
  };

  const handleSelectCustomerCode = () => {
    if (!customerCodeInput.trim()) return;
    const found = mockClients.find(
      (c) => c.code?.toLowerCase() === customerCodeInput.trim().toLowerCase(),
    );
    setCustomerLabel(
      found?.name ? `Cliente: ${found.name}` : `Cliente: ${customerCodeInput.trim()}`,
    );
    setCustomerCodeConfirmed(true);
  };

  const clearCustomer = () => {
    setCustomerLabel("Cliente AXIS");
    setCpfInput("");
    setCpfConfirmed(false);
    setCustomerCodeInput("");
    setCustomerCodeConfirmed(false);
  };

  const effectiveUnitPrice = (item: CartItem) => {
    if (item.discountPercent && item.discountPercent > 0) {
      return Math.max(0, Math.round(item.priceCents * (1 - item.discountPercent / 100)));
    }
    return item.priceCents;
  };

  const cartTotals = cartItems.reduce(
    (acc, item) => {
      const unit = effectiveUnitPrice(item);
      acc.totalCents += unit * item.qty;
      acc.volumes += item.qty;
      acc.last = item;
      return acc;
    },
    { totalCents: 0, volumes: 0, last: null as CartItem | null },
  );
  if (showWorkspace) {
    const focusedItem =
      (selectedCartItemId && cartItems.find((item) => item.id === selectedCartItemId)) ??
      cartTotals.last;
    const canEditPrices = user?.role === "ADMIN" || user?.role === "OWNER";
    const cpfDigits = cpfInput.replace(/\D/g, "").slice(0, 11);
    const saleTotals = calculateSaleTotals();
    const pendingAmountCents = parsePaymentAmount(paymentAmount);
    const pendingPaymentPreview =
      selectedPaymentMethod && pendingAmountCents
        ? { method: selectedPaymentMethod, amountCents: pendingAmountCents }
        : null;
    const paymentPreviewList = pendingPaymentPreview ? [...payments, pendingPaymentPreview] : payments;
    const totalPaidCents = paymentPreviewList.reduce((acc, p) => acc + p.amountCents, 0);
    const remainingCents = Math.max(saleTotals.netTotalCents - totalPaidCents, 0);
    const changeCents = Math.max(totalPaidCents - saleTotals.netTotalCents, 0);

    return (
      <>
        <div className={`axis-pos-root${isSidebarCollapsed ? " sidebar-collapsed" : ""}`}>
          {sessionError && (
            <div className="axis-pos-session-banner">
              <div className="axis-pos-session-banner__dot" />
              <div>
                <strong>Sessão expirada:</strong> {sessionError} Refaça login para continuar.
              </div>
            </div>
          )}
          <aside className={`axis-pos-sidebar${isSidebarCollapsed ? " collapsed" : ""}`}>
            <div className="axis-pos-sidebar-logo">
              AXIS POS
              <button
                type="button"
                className="axis-pos-sidebar-toggle"
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                aria-label="Alternar menu"
              >
                {isSidebarCollapsed ? "›" : "‹"}
              </button>
            </div>

            <div className="axis-pos-sidebar-group">
              <button
                className={`axis-pos-sidebar-button${viewMode === "sale" ? " axis-pos-sidebar-button--active" : ""}`}
                onClick={() => {
                  if (viewMode !== "sale") {
                    setViewMode("sale");
                  }
                }}
              >
                <span className="axis-pos-sidebar-button-icon">🛒</span>
                <span>Nova venda</span>
              </button>

              <button
                className="axis-pos-sidebar-button"
                onClick={() => {
                  if (hasDraft) {
                    ensureDraftSavedToPreSale(true);
                  }
                }}
              >
                <span className="axis-pos-sidebar-button-icon">👥</span>
                <span>Clientes</span>
              </button>

              <button
                className={`axis-pos-sidebar-button${viewMode === "presales" ? " axis-pos-sidebar-button--active" : ""}`}
                onClick={() => {
                  if (hasDraft) ensureDraftSavedToPreSale(true);
                  setViewMode("presales");
                }}
              >
                <span className="axis-pos-sidebar-button-icon">📄</span>
                <span>Resgatar pré-venda</span>
              </button>

              <button
                    className="axis-pos-sidebar-button"
                    onClick={() => {
                      if (hasDraft) ensureDraftSavedToPreSale(true);
                    }}
                  >
                <span className="axis-pos-sidebar-button-icon">📦</span>
                <span>Orçamentos</span>
              </button>

              <button
                className="axis-pos-sidebar-button"
                onClick={() => {
                  if (hasDraft) ensureDraftSavedToPreSale(true);
                  handleRequestCloseCash();
                }}
              >
                <span className="axis-pos-sidebar-button-icon">💵</span>
                <span>Caixa</span>
              </button>

              <button
                className="axis-pos-sidebar-button"
                onClick={() => {
                  if (hasDraft) ensureDraftSavedToPreSale(true);
                }}
              >
                <span className="axis-pos-sidebar-button-icon">⛔</span>
                <span>Cancelamento</span>
              </button>

              <button
                className="axis-pos-sidebar-button"
                onClick={() => {
                  if (hasDraft) ensureDraftSavedToPreSale(true);
                }}
              >
                <span className="axis-pos-sidebar-button-icon">🔁</span>
                <span>Reimprimir</span>
              </button>
            </div>

            <div className="axis-pos-sidebar-footer">AXIS Softwares — PDV Web</div>
          </aside>

          <header className="axis-pos-topbar">
            <div className="axis-pos-topbar-left">
              <div>
                <div className="axis-pos-topbar-item-label">Status</div>
                <div className="axis-pos-topbar-item-value">
                  PDV_LOJA_01 - {cashSession?.registerNumber ?? "Caixa aberto"}
                </div>
              </div>

              <div>
                <div className="axis-pos-topbar-item-label">Movimentos a sincronizar</div>
                <div className="axis-pos-topbar-item-value">1 pendente</div>
              </div>

              <div>
                <div className="axis-pos-topbar-item-label">SAT / NFC-e</div>
                <div className="axis-pos-topbar-item-value">SAT ativo — NFC-e OK</div>
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
                  {resolvedUserName} — {currentDateTime.split("T")[1]}
                </div>
              </div>

              <div>
                <div className="axis-pos-topbar-item-label">Data</div>
                <div className="axis-pos-topbar-item-value">{currentDateTime.split("T")[0].split("-").reverse().join("/")}</div>
              </div>

              <button
                type="button"
                className="axis-pos-ghost-btn"
                onClick={() => navigate("/admin/dashboard")}
                style={{ marginLeft: "1rem" }}
              >
                Voltar ao painel
              </button>

              <button
                type="button"
                className="axis-pos-ghost-btn"
                onClick={() => (isFullscreen ? exitFullscreen() : enterFullscreen())}
                style={{ marginLeft: "0.5rem" }}
              >
                {isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              </button>
            </div>
          </header>

          <main className="axis-pos-center">
            {viewMode === "presales" ? (
              <section className="axis-pos-presales">
                <div className="axis-pos-cart-header">
                  <span>Pré-venda</span>
                  <span>Itens</span>
                  <span>Cliente</span>
                  <span />
                </div>
                <div className="axis-pos-cart-list">
                  {preSales.map((p) => (
                    <div key={p.id} className="axis-pos-cart-row">
                      <div>
                        <div className="axis-pos-cart-product-name">
                          Pré-venda #{p.id.split("_")[1] ?? p.id}
                        </div>
                        <div className="axis-pos-cart-product-meta">
                          Criada em {new Date(p.createdAt).toLocaleString("pt-BR")}
                        </div>
                      </div>
                      <div>{p.items.length}</div>
                      <div className="axis-pos-cart-price">{p.customer.label}</div>
                      <button
                        className="axis-pos-cart-remove"
                        onClick={() => handleRestorePreSale(p.id)}
                      >
                        Carregar
                      </button>
                    </div>
                  ))}
                  {preSales.length === 0 && (
                    <div className="axis-pos-empty-row">Nenhuma pré-venda em aberto.</div>
                  )}
                </div>
                <div className="axis-pos-center-actions">
                  <button
                    className="axis-pos-center-btn axis-pos-center-btn--primary"
                    onClick={() => setViewMode("sale")}
                  >
                    Voltar para nova venda
                  </button>
                </div>
              </section>
            ) : (
              <>
                <div className="axis-pos-cart-header">
                  <span>Produto</span>
                  <span>Quantidade</span>
                  <span>Total (R$)</span>
                  <span />
                </div>

                <div className="axis-pos-cart-list">
                  {cartItems.map((item) => {
                    const unit = effectiveUnitPrice(item);
                    const total = unit * item.qty;
                    return (
                      <div
                        key={item.id}
                        className={`axis-pos-cart-row${selectedCartItemId === item.id ? " active" : ""}`}
                        onClick={() => setSelectedCartItemId(item.id)}
                      >
                        <div>
                          <div className="axis-pos-cart-product-name">{item.name}</div>
                          <div className="axis-pos-cart-product-meta">
                            SKU: {item.sku ?? "—"} • UN • {formatCurrency(unit)}
                            {item.discountPercent ? ` (desc. ${item.discountPercent}% )` : ""}
                          </div>
                        </div>

                        <div>
                          <div className="axis-pos-cart-qty-control">
                            <button
                              className="axis-pos-cart-qty-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateItemQty(item.id, -1);
                              }}
                            >
                              -
                            </button>
                            <input
                              className="axis-pos-cart-qty-input"
                              value={item.qty.toString().padStart(2, "0")}
                              readOnly
                              onFocus={() => setActiveKeypadTarget(`qty:${item.id}`)}
                            />
                            <button
                              className="axis-pos-cart-qty-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateItemQty(item.id, 1);
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div
                          className="axis-pos-cart-price"
                          onClick={(e) => {
                            e.stopPropagation();
                            openPriceModal(item);
                          }}
                        >
                          {formatCurrency(total)}
                        </div>

                        <button
                          className="axis-pos-cart-remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeItem(item.id);
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    );
                  })}

                  {cartItems.length === 0 && (
                    <div className="axis-pos-empty-row">Nenhum item. Busque um produto para começar.</div>
                  )}
                </div>

                <section className="axis-pos-center-footer">
                  <div className="axis-pos-center-totals">
                    <div>
                      <div className="axis-pos-center-total-item-label">Último item</div>
                      <div className="axis-pos-center-total-item-value">
                        {cartTotals.last
                          ? formatCurrency(effectiveUnitPrice(cartTotals.last) * cartTotals.last.qty)
                          : "R$ 0,00"}
                      </div>
                    </div>

                    <div>
                      <div className="axis-pos-center-total-item-label">Volumes</div>
                      <div className="axis-pos-center-total-item-value">
                        {cartTotals.volumes.toString().padStart(2, "0")}
                      </div>
                    </div>

                    <div>
                      <div className="axis-pos-center-total-item-label">Total</div>
                      <div className="axis-pos-center-total-item-value">
                        {formatCurrency(cartTotals.totalCents)}
                      </div>
                    </div>
                  </div>

                  <div className="axis-pos-center-actions">
                    <button
                      className="axis-pos-center-btn axis-pos-center-btn--danger"
                      onClick={() => setShowCancelConfirm(true)}
                    >
                      Cancelar venda aberta
                    </button>

                    <button
                      className="axis-pos-center-btn axis-pos-center-btn--warning"
                      onClick={() => handleSavePreSale()}
                    >
                      Salvar pré-venda
                    </button>

                    <button
                      className="axis-pos-center-btn axis-pos-center-btn--success"
                      onClick={handleFinalizeClick}
                    >
                      Finalizar venda
                    </button>
                  </div>
                </section>
              </>
            )}
          </main>

          <aside className="axis-pos-right">
            <section className="axis-pos-client-card">
              <div className="axis-pos-client-name">
                <span>{customerLabel}</span>
                <span>Selecionar cliente</span>
              </div>

              <div className="axis-pos-client-row">
                <label className="axis-label">
                  CPF
                  <input
                    className="axis-input axis-pos-input-outline"
                    placeholder="000.000.000-00"
                    value={cpfInput}
                    maxLength={14}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, "").slice(0, 11);
                      const masked = digits.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d) =>
                        d ? `${a}.${b}.${c}-${d}` : `${a}.${b}${c ? `.${c}` : ""}`,
                      );
                      setCpfInput(masked);
                      setCpfConfirmed(false);
                    }}
                    onBlur={() => setActiveKeypadTarget(null)}
                  />
                  {cpfDigits.length === 11 && !cpfConfirmed && (
                    <button type="button" className="axis-pos-mini-btn" onClick={handleSelectCustomer}>
                      Confirmar CPF
                    </button>
                  )}
                  {cpfConfirmed && (
                    <button type="button" className="axis-pos-mini-btn axis-pos-mini-btn--clear" onClick={clearCustomer}>
                      Limpar
                    </button>
                  )}
                </label>

                <label className="axis-label">
                  Código
                  <input
                    className="axis-input axis-pos-input-outline"
                    placeholder="Código interno"
                    value={customerCodeInput}
                    maxLength={14}
                    onChange={(event) => {
                      setCustomerCodeInput(event.target.value.slice(0, 14));
                      setCustomerCodeConfirmed(false);
                    }}
                  />
                  {customerCodeInput.trim().length > 0 && !customerCodeConfirmed && (
                    <button type="button" className="axis-pos-mini-btn" onClick={handleSelectCustomerCode}>
                      Confirmar código
                    </button>
                  )}
                  {customerCodeConfirmed && (
                    <button type="button" className="axis-pos-mini-btn axis-pos-mini-btn--clear" onClick={clearCustomer}>
                      Limpar
                    </button>
                  )}
                </label>
              </div>
            </section>

            <section className="axis-pos-product-search">
              <div className="axis-pos-product-search-left">
                <label className="axis-label">
                  Produto
                  <input
                    className="axis-input axis-pos-input-outline"
                    placeholder="Buscar por nome, SKU ou código de barras"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onFocus={() => setActiveKeypadTarget(null)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddProductFromSearch();
                      }
                    }}
                  />
                </label>

                {searchQuery.trim().length > 0 && searchResults.length > 0 && (
                  <ul className="axis-pos-search-results">
                    {searchResults.map((product) => (
                      <li
                        key={product.id}
                        className="axis-pos-search-result"
                        onClick={() => handleAddProductFromSearch(product)}
                      >
                        <div>
                          <div className="axis-pos-search-name">{product.name}</div>
                          <div className="axis-pos-search-meta">SKU: {product.sku ?? "—"}</div>
                        </div>
                        <div className="axis-pos-search-price">
                          {formatCurrency((product.priceCents ?? 0))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="axis-pos-price-qty">
                <div className="axis-pos-price-row">
                  <span>Preço</span>
                  <span
                    className={`axis-pos-price-value${canEditPrices && focusedItem ? " axis-pos-price-value--action" : ""}`}
                    onClick={() => {
                      if (canEditPrices && focusedItem) {
                        openPriceModal(focusedItem);
                      }
                    }}
                  >
                    {focusedItem ? formatCurrency(effectiveUnitPrice(focusedItem)) : "—"}
                  </span>
                </div>

                <div className="axis-pos-qty-row">
                  <span>Quantidade</span>

                  <div className="axis-pos-qty-control">
                    <button
                      className="axis-pos-qty-btn"
                      onClick={() => focusedItem && updateItemQty(focusedItem.id, -1)}
                    >
                      -
                    </button>
                    <input
                      className="axis-pos-qty-input axis-pos-input-outline"
                      value={focusedItem ? focusedItem.qty.toString().padStart(2, "0") : "00"}
                      readOnly
                      onFocus={() => focusedItem && setActiveKeypadTarget(`qty:${focusedItem.id}`)}
                    />
                    <button
                      className="axis-pos-qty-btn"
                      onClick={() => focusedItem && updateItemQty(focusedItem.id, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="axis-pos-keypad">
              <div className="axis-pos-keypad-grid">
                {["7", "8", "9", "4", "5", "6", "1", "2", "3", "0"].map((digit) => (
                  <button
                    key={digit}
                    className={`axis-pos-keypad-btn${digit === "0" ? " axis-pos-keypad-btn--zero" : ""}`}
                    onClick={() => applyKeypadInput(digit)}
                  >
                    {digit}
                  </button>
                ))}
              </div>

              <div className="axis-pos-keypad-actions">
                <button
                  className="axis-pos-keypad-action-btn axis-pos-keypad-action-btn--clear-field"
                  onClick={clearActiveField}
                >
                  Limpar campo selecionado
                </button>

                <button
                  className="axis-pos-keypad-action-btn axis-pos-keypad-action-btn--clear-item"
                  onClick={() => selectedCartItemId && removeItem(selectedCartItemId)}
                >
                  Limpar item atual
                </button>

                <button
                  className="axis-pos-keypad-action-btn axis-pos-keypad-action-btn--confirm"
                  onClick={handleConfirmKeypad}
                >
                  Confirmar (adicionar à venda)
                </button>
              </div>
            </section>
          </aside>
        </div>

        {priceModalItem && canEditPrices && (
          <div className="axis-modal-backdrop axis-pos-price-modal">
            <div className="axis-modal axis-modal-sm axis-pos-price-card">
              <header className="axis-modal-header">
                <div className="axis-modal-title-group">
                  <h1 className="axis-modal-title">Ajustar preço / desconto</h1>
                  <p className="axis-modal-subtitle">{priceModalItem.name}</p>
                </div>
              </header>

              <section className="axis-modal-body">
                {(() => {
                  const baseCents = priceModalItem.priceCents;
                  const parsedPrice = priceInput.trim().length
                    ? Number(priceInput.replace(/[^\d.,-]/g, "").replace(",", "."))
                    : null;
                  const effectiveBase =
                    parsedPrice !== null && !Number.isNaN(parsedPrice) && parsedPrice >= 0
                      ? Math.round(parsedPrice * 100)
                      : baseCents;
                  const discountPct = discountInput.trim().length ? Number(discountInput) : 0;
                  const discounted =
                    discountPct && !Number.isNaN(discountPct) && discountPct > 0
                      ? Math.max(0, Math.round(effectiveBase * (1 - discountPct / 100)))
                      : effectiveBase;
                  return (
                    <div className="axis-pos-price-summary">
                      <span>Preço original: {formatCurrency(baseCents)}</span>
                      <span className="axis-pos-price-divider">|</span>
                      <span>Com desconto: {formatCurrency(discounted)}</span>
                    </div>
                  );
                })()}

                <label className="axis-label">
                  Novo preço (R$)
                  <input
                    className="axis-input axis-pos-input-outline"
                    value={priceInput}
                    onFocus={() => setActiveKeypadTarget("price")}
                    onChange={(event) => setPriceInput(event.target.value)}
                    placeholder="Ex.: 19,90"
                  />
                </label>

                <label className="axis-label">
                  Desconto em %
                  <input
                    className="axis-input axis-pos-input-outline"
                    value={discountInput}
                    onFocus={() => setActiveKeypadTarget("discount")}
                    onChange={(event) => setDiscountInput(event.target.value.replace(/[^\d]/g, ""))}
                    placeholder="Ex.: 10"
                  />
                </label>

                {user?.role === "ATTENDANT" && (
                  <label className="axis-label">
                    Supervisor (PIN / senha)
                    <input
                      className="axis-input axis-pos-input-outline"
                      type="password"
                      value={supervisorSecretForDiscount}
                      onChange={(event) => setSupervisorSecretForDiscount(event.target.value)}
                      placeholder="Necessário para aplicar desconto"
                    />
                  </label>
                )}

                {priceFeedback && (
                  <div
                    className={`axis-pos-modal-feedback ${
                      priceFeedback.type === "error"
                        ? "axis-pos-modal-feedback--error"
                        : "axis-pos-modal-feedback--success"
                    }`}
                  >
                    {priceFeedback.message}
                  </div>
                )}
              </section>

              <footer className="axis-modal-footer">
                <button
                  type="button"
                  className="axis-button axis-button-secondary"
                  onClick={() => {
                    setPriceModalItem(null);
                    setPriceFeedback(null);
                    setActiveKeypadTarget(null);
                  }}
                >
                  Cancelar
                </button>

                <button type="button" className="axis-button axis-button-primary" onClick={applyPriceChanges}>
                  Aplicar
                </button>
              </footer>
            </div>
          </div>
        )}

        <AxisPosCloseCashModal
          isOpen={showCloseCash}
          isSubmitting={isClosing}
          cashSessionId={cashSession?.id ?? null}
          registerNumber={cashSession?.registerNumber ?? null}
          requireSupervisor={requiresSupervisor}
          feedback={closeFeedback}
          onCancel={handleCloseCloseModal}
          onConfirm={handleConfirmClose}
        />

        {showCancelConfirm && (
          <div className="axis-modal-backdrop">
            <div className="axis-modal axis-modal-sm axis-pos-price-card">
              <header className="axis-modal-header">
                <div className="axis-modal-title-group">
                  <h1 className="axis-modal-title">Cancelar lista de compras?</h1>
                  <p className="axis-modal-subtitle">
                    Você gostaria de confirmar o cancelamento dessa lista de compras?
                  </p>
                </div>
              </header>
              <footer className="axis-modal-footer">
                <button
                  type="button"
                  className="axis-button axis-button-secondary"
                  onClick={() => setShowCancelConfirm(false)}
                >
                  Cancelar exclusão
                </button>
                <button
                  type="button"
                  className="axis-button axis-button-primary axis-button-primary--nav"
                  onClick={() => {
                    setCartItems([]);
                    clearCustomer();
                    setSelectedCartItemId(null);
                    setSearchQuery("");
                    setSearchResults([]);
                    setPriceModalItem(null);
                    setPriceInput("");
                    setDiscountInput("");
                    setActiveKeypadTarget("search");
                    setPriceFeedback(null);
                    setSupervisorSecretForDiscount("");
                    setFeedback(null);
                    setCloseFeedback(null);
                    setShowCancelConfirm(false);
                  }}
                >
                  Confirmar exclusão
                </button>
              </footer>
            </div>
          </div>
        )}

        {showPaymentModal && (
          <div className="axis-modal-backdrop axis-pos-price-modal">
            <div className="axis-modal axis-modal-sm axis-pos-price-card">
              <header className="axis-modal-header">
                <div className="axis-modal-title-group">
                  <h1 className="axis-modal-title">Selecionar pagamento</h1>
                  <p className="axis-modal-subtitle">Escolha o método para finalizar a venda</p>
                </div>
              </header>

              <section className="axis-modal-body">
                <label className="axis-label">
                  Valor do pagamento
                  <input
                    className="axis-input axis-pos-input-outline"
                    placeholder="Ex.: 50,00"
                    value={paymentAmount}
                    onFocus={() => setActiveKeypadTarget("payment")}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                  />
                </label>

                <div className="axis-pos-payment-grid">
                  {[
                    { id: "cash", label: "Dinheiro" },
                    { id: "debit", label: "Débito" },
                    { id: "credit", label: "Crédito" },
                    { id: "pix", label: "PIX" },
                    { id: "vr", label: "VR" },
                    { id: "va", label: "VA" },
                    { id: "store_credit", label: "Marcar conta" },
                  ].map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      className={`axis-pos-payment-btn${
                        selectedPaymentMethod === method.id ? " axis-pos-payment-btn--active" : ""
                      }`}
                      onClick={() =>
                        setSelectedPaymentMethod(
                          method.id as
                            | "cash"
                            | "debit"
                            | "credit"
                            | "pix"
                            | "vr"
                            | "va"
                            | "store_credit",
                        )
                      }
                    >
                      {method.label}
                    </button>
                  ))}
                </div>

                <div className="axis-pos-payment-summary">
                  <div>Valor da venda: {formatCurrency(saleTotals.netTotalCents)}</div>
                  <div>Pago: {formatCurrency(totalPaidCents)}</div>
                  <div>Restante: {formatCurrency(remainingCents)}</div>
                  {changeCents > 0 && <div>Troco: {formatCurrency(changeCents)}</div>}
                </div>

                {paymentFeedback && (
                  <div
                    className={`axis-pos-modal-feedback ${
                      paymentFeedback.type === "error"
                        ? "axis-pos-modal-feedback--error"
                        : "axis-pos-modal-feedback--success"
                    }`}
                  >
                    {paymentFeedback.message}
                  </div>
                )}

                {payments.length > 0 && (
                  <div className="axis-pos-payment-list">
                    <div className="axis-pos-payment-list-title">Pagamentos adicionados</div>
                    {payments.map((p, idx) => (
                      <div key={`${p.method}-${idx}`} className="axis-pos-payment-list-row">
                        <span>{p.method}</span>
                        <span>{formatCurrency(p.amountCents)}</span>
                        <button
                          type="button"
                          className="axis-button axis-button-secondary"
                          onClick={() =>
                            setPayments((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <footer className="axis-modal-footer">
                <button
                  type="button"
                  className="axis-button axis-button-secondary"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedPaymentMethod(null);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="axis-button axis-button-secondary"
                  onClick={handleAddPayment}
                  disabled={isFinishing}
                >
                  Adicionar pagamento
                </button>
                <button
                  type="button"
                  className="axis-button axis-button-primary axis-button-primary--nav"
                  onClick={handleFinalizeSale}
                  disabled={isFinishing}
                >
                  {isFinishing ? "Finalizando..." : "Confirmar"}
                </button>
              </footer>
            </div>
          </div>
        )}
      </>
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
                onClick={handleStartSale}
                disabled={isOpening || isCheckingSession}
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

      <AxisPosCloseCashModal
        isOpen={showCloseCash}
        isSubmitting={isClosing}
        cashSessionId={cashSession?.id ?? null}
        registerNumber={cashSession?.registerNumber ?? null}
        feedback={closeFeedback}
        onCancel={handleCloseCloseModal}
        onConfirm={handleConfirmClose}
      />
    </div>
  );
}
