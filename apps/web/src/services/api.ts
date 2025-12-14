import { API_URL } from "./config";
import { apiClient } from "./http";

export type SuperAdminTokens = { token: string; tokenType: string; expiresIn: string };
type ApiError = { response?: { status?: number; data?: { message?: string; details?: unknown } } };

export async function login(email: string, password: string) {
  try {
    const res = await apiClient.post<{ access: string }>(
      "/auth/login",
      { email, password },
    );
    if (!res.data?.access) {
      throw new Error("Resposta inesperada da API de login.");
    }
    return { access: res.data.access };
  } catch (error) {
    const err = error as ApiError;
    const status = err.response?.status;
    if (status === 401 || status === 400) {
      throw new Error("Senha ou e-mail incorretos");
    }
    const message =
      err.response?.data?.message ??
      "Nao foi possivel alcancar a API de autenticacao. Verifique sua conexao ou o backend.";
    throw new Error(message);
  }
}

export async function loginSuperAdmin(email: string, password: string): Promise<SuperAdminTokens> {
  const res = await fetch(`${API_URL}/super-admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = await res
    .json()
    .catch(() => null) as (SuperAdminTokens & { message?: string }) | null;

  if (!res.ok) {
    const details =
      typeof payload?.message === "string"
        ? payload.message
        : "Falha ao autenticar o super admin.";
    throw new Error(details);
  }
  if (!payload) {
    throw new Error("Resposta inesperada da API de super admin.");
  }
  return payload;
}

export async function fetchCurrentUser() {
  const res = await apiClient.get("/auth/me");
  return res.data;
}

export async function requestPasswordReset(email: string) {
  const res = await fetch(`${API_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(
      typeof payload?.message === "string"
        ? payload.message
        : "Nǜo foi poss��vel iniciar o reset.",
    );
  }
}

export async function resetPassword(token: string, newPassword: string) {
  const res = await fetch(`${API_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(
      typeof payload?.message === "string"
        ? payload.message
        : "Nǜo foi poss��vel redefinir a senha.",
    );
  }
}

export async function ping(access: string, tenantId: string) {
  const res = await fetch(`${API_URL}/ping`, {
    headers: { Authorization: `Bearer ${access}`, "x-tenant-id": tenantId },
  });
  if (!res.ok) throw new Error("Ping falhou");
  return res.json();
}

export async function fetchReceipt(access: string, saleId: string) {
  const res = await fetch(`${API_URL}/sales/${saleId}/receipt`, {
    headers: { Authorization: `Bearer ${access}` },
  });

  if (!res.ok) {
    throw new Error("Falha ao gerar recibo.");
  }

  return res.json();
}

export type SuperAdminMetrics = {
  totalLojasAtivas: number;
  totalUsuariosAtivos: number;
  totalLojasDesativadas: number;
  totalUsuariosDesativados: number;
};

export type Tenant = {
  id: string;
  name: string;
  email: string;
  cnpj: string | null;
  cpfResLoja: string | null;
  isActive: boolean;
  maxOpenCashSessions: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateTenantPayload = {
  name: string;
  email: string;
  password?: string;
  cnpj?: string;
  cpfResLoja?: string;
  maxOpenCashSessions?: number;
};

function getStoredSuperAdminToken(): string | null {
  return localStorage.getItem("axis.superadmin.token");
}

async function saFetch(token: string | null, path: string, options: RequestInit = {}) {
  const resolvedToken = token ?? getStoredSuperAdminToken();
  if (!resolvedToken) {
    throw new Error("Token de super admin ausente. Fa��a login novamente.");
  }

  const res = await fetch(`${API_URL}/super-admin${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${resolvedToken}`,
      "Content-Type": "application/json",
    },
  });
  if (res.status === 401) {
    localStorage.removeItem("axis.superadmin.token");
    throw new Error("Sessǜo de super admin expirou. Fa��a login novamente.");
  }
  return res;
}

export async function fetchSuperAdminOverview(token: string): Promise<SuperAdminMetrics> {
  const res = await saFetch(token, "/overview");
  if (!res.ok) {
    throw new Error("Nǜo foi poss��vel obter os indicadores do super admin.");
  }
  return res.json();
}

export async function createTenantAsSuperAdmin(
  token: string,
  payload: CreateTenantPayload,
): Promise<Tenant> {
  const res = await saFetch(token, "/tenants", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    const err = new Error(data?.message ?? "Falha ao criar tenant.");
    if (data?.field) {
      (err as Error & { field: string }).field = data.field;
    }
    throw err;
  }
  return data;
}

export async function fetchTenantsAsSuperAdmin(token: string): Promise<Tenant[]> {
  const res = await saFetch(token, "/tenants");
  if (!res.ok) {
    throw new Error("Nǜo foi poss��vel obter a lista de tenants.");
  }
  return res.json();
}

export async function updateTenantAsSuperAdmin(
  token: string,
  tenantId: string,
  payload: Partial<CreateTenantPayload> & { isActive?: boolean },
): Promise<Tenant> {
  const res = await saFetch(token, `/tenants/${tenantId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data?.message ?? "Falha ao atualizar tenant.");
  }
  return data;
}

export type CreateTenantUserBody = {
  tenantIdentifier: string;
  email: string;
  password?: string;
  name?: string;
  role?: "OWNER" | "ADMIN" | "ATTENDANT";
  pinSupervisor?: string;
};

export async function createTenantUserAsSuperAdmin(
  token: string,
  payload: CreateTenantUserBody,
): Promise<void> {
  const { tenantIdentifier, ...rest } = payload;
  const identifier = tenantIdentifier?.trim();
  if (!identifier) {
    throw new Error("Tenant identifier obrigat������rio para criar usu��rio.");
  }

  const res = await saFetch(token, `/tenants/${identifier}/users`, {
    method: "POST",
    body: JSON.stringify(rest),
  });
  if (!res.ok) {
    const data = await parseJson(res);
    throw new Error(data?.message ?? "Falha ao criar usuǭrio para o tenant.");
  }
}

const parseJson = async (res: Response) => {
  const raw = await res.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export type CashSession = {
  id: string;
  tenantId: string;
  userId: string;
  openingCents: number;
  closingCents: number | null;
  openedAt: string;
  closedAt: string | null;
  registerNumber: string | null;
  notes: string | null;
};

export type CashClosingReport = {
  sessionId: string;
  tenantId: string;
  openedAt: string;
  closedAt: string;
  openingCents: number;
  closingCents: number;
  cashSalesCents: number;
  expectedCashCents: number;
  differenceCents: number;
  totalPaymentsCents: number;
  totalSalesCents: number;
  totalChangeCents: number;
  totalWithdrawalsCents: number;
  openingNotes: string | null;
  closingNotes: string | null;
  openedBy: { id: string; name: string | null };
  closedBy: { id: string; name: string | null };
  approvedBy?: { id: string; name: string | null; role: "ADMIN" | "OWNER"; via: "PIN" | "PASSWORD" };
  printJobId?: string | null;
  printJobStatus?: "PENDING" | "PRINTING" | "DONE" | "FAILED";
  paymentBreakdown: Array<{ method: string; label: string; amountCents: number }>;
  withdrawals: Array<{
    id: string;
    amountCents: number;
    reason: string;
    createdAt: string;
    createdBy: { id: string; name: string | null };
  }>;
  fiado: { totalCents: number; entries: Array<{ reference: string; amountCents: number }> };
};

export async function fetchCashClosingReport(access: string, cashSessionId: string): Promise<CashClosingReport> {
  const res = await fetch(`${API_URL}/cash/${cashSessionId}/report`, {
    headers: { Authorization: `Bearer ${access}` },
  });

  if (!res.ok) {
    throw new Error("Falha ao buscar relat��rio de fechamento de caixa.");
  }

  return res.json();
}

export async function fetchOpenCashSession(): Promise<CashSession | null> {
  try {
    const res = await apiClient.get<CashSession | null>("/cash/session");
    return res.data ?? null;
  } catch (error: unknown) {
    const maybeAxios = error as ApiError;
    const message =
      typeof maybeAxios?.response?.data?.message === "string"
        ? maybeAxios.response.data.message
        : "Falha ao buscar sessao de caixa.";
    throw new Error(message);
  }
}

export async function openCashSession(payload: {
  registerNumber?: string;
  openingCents: number;
  notes?: string;
}): Promise<CashSession> {
  try {
    const res = await apiClient.post<{ session: CashSession }>("/cash/open", {
      registerNumber: payload.registerNumber,
      openingCents: payload.openingCents,
      notes: payload.notes,
    });
    return res.data.session;
  } catch (error: unknown) {
    const maybeAxios = error as ApiError;
    const status = maybeAxios?.response?.status;
    const data = maybeAxios?.response?.data as
      | { message?: string; details?: { maxOpen?: number; registerNumber?: string; openedBy?: { id?: string | null; name?: string | null }; openSessionId?: string } }
      | undefined;
    let message =
      typeof data?.message === "string"
        ? data.message
        : "Falha ao abrir o caixa.";
    const details = maybeAxios?.response?.data?.details as
      | { registerNumber?: string; openedBy?: { id?: string | null; name?: string | null }; openSessionId?: string }
      | undefined;

    if (status === 409) {
      if (details?.openSessionId) {
        throw new Error("Voce ja possui um caixa aberto. Continue no mesmo caixa antes de abrir outro.");
      }
      if (details?.openedBy?.name || details?.openedBy?.id) {
        const name = details.openedBy.name ?? details.openedBy.id ?? "outro operador";
        throw new Error(
          `Esse caixa já está aberto por ${name}. Feche ou escolha outro número.`,
        );
      }
      if (data?.details?.maxOpen) {
        throw new Error(
          `Limite de caixas abertos atingido (máx. ${data.details.maxOpen}). Feche um caixa antes de abrir outro.`,
        );
      }
    }

    if (!status) {
      message = "Não foi possível conectar ao servidor. Verifique sua rede.";
    }

    throw new Error(message);
  }
}

export async function closeCashSession(payload: {
  cashSessionId: string;
  closingCents: number;
  supervisorSecret?: string;
  notes?: string;
}): Promise<void> {
  try {
    await apiClient.post("/cash/close", {
      cashSessionId: payload.cashSessionId,
      closingCents: payload.closingCents,
      ...(payload.supervisorSecret ? { supervisorSecret: payload.supervisorSecret } : {}),
      notes: payload.notes,
    });
  } catch (error: unknown) {
    const maybeAxios = error as ApiError;
    const message =
      typeof maybeAxios?.response?.data?.message === "string"
        ? maybeAxios.response.data.message
        : "Falha ao fechar o caixa.";
    throw new Error(message);
  }
}

// ===============
// VENDAS / POS
// ===============

export type DiscountInput =
  | { type: "value"; valueCents: number }
  | { type: "percent"; percent: number };

export type PaymentMethod = "cash" | "debit" | "credit" | "pix" | "vr" | "va" | "store_credit";

export type SaleItemInput = {
  productId: string;
  sku?: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  discount?: DiscountInput;
};

export type PaymentInput = {
  method: PaymentMethod;
  amountCents: number;
  providerId?: string;
};

export type SaleInput = {
  cashSessionId: string;
  locationId: string;
  items: SaleItemInput[];
  payments: PaymentInput[];
  discount?: DiscountInput;
  fiscalMode?: "sat" | "nfce" | "none";
  saleId?: string;
};

export type SalePayment = {
  id: string;
  method: PaymentMethod;
  amountCents: number;
  providerId: string | null;
};

export type SaleItem = {
  id: string;
  productId: string;
  sku: string | null;
  name: string;
  qty: string;
  unitPriceCents: number;
  totalCents: number;
  discountCents: number;
  discountMode: "NONE" | "VALUE" | "PERCENT";
};

export type Sale = {
  id: string;
  tenantId: string;
  userId: string;
  cashSessionId: string;
  number: number;
  status: string;
  subtotalCents: number;
  discountCents: number;
  discountMode: "NONE" | "VALUE" | "PERCENT";
  totalCents: number;
  changeCents: number;
  fiscalMode: "sat" | "nfce" | "none";
  fiscalKey?: string | null;
  createdAt: string;
  updatedAt?: string;
  items: SaleItem[];
  payments: SalePayment[];
};

export type StockWarning = { productId: string; locationId: string; balance: string };
export type StockError = { productId: string; locationId?: string; message: string };

export type CreateSaleResult = {
  sale: Sale;
  fiscalStatus?: string;
  fiscalError?: string;
  stockWarnings?: StockWarning[];
  stockErrors?: StockError[];
};

export type CreateSaleResponse = CreateSaleResult | { duplicate: true };

export async function createSale(payload: {
  sale: SaleInput;
  supervisorSecret?: string;
  idempotencyKey?: string;
}): Promise<CreateSaleResponse> {
  try {
    const res = await apiClient.post<CreateSaleResponse>(
      "/sales",
      {
        sale: payload.sale,
        supervisorSecret: payload.supervisorSecret,
        idempotencyKey: payload.idempotencyKey,
      },
      {
        headers: {
          ...(payload.supervisorSecret ? { "x-supervisor-secret": payload.supervisorSecret } : {}),
          ...(payload.idempotencyKey ? { "x-idempotency-key": payload.idempotencyKey } : {}),
        },
      },
    );
    return res.data;
  } catch (error: unknown) {
    const maybeAxios = error as ApiError;
    const message =
      typeof maybeAxios?.response?.data?.message === "string"
        ? maybeAxios.response.data.message
        : "Falha ao criar venda.";
    throw new Error(message);
  }
}

export async function cancelSale(
  saleId: string,
  payload: { reason: string; supervisorSecret?: string },
): Promise<Sale> {
  try {
    const res = await apiClient.post<Sale>(
      `/sales/${saleId}/cancel`,
      { reason: payload.reason, supervisorSecret: payload.supervisorSecret },
      {
        headers: payload.supervisorSecret ? { "x-supervisor-secret": payload.supervisorSecret } : {},
      },
    );
    return res.data;
  } catch (error: unknown) {
    const maybeAxios = error as ApiError;
    const message =
      typeof maybeAxios?.response?.data?.message === "string"
        ? maybeAxios.response.data.message
        : "Falha ao cancelar a venda.";
    throw new Error(message);
  }
}

// ---------- Printing ----------
export type PrinterDeviceType = "NETWORK" | "USB" | "WINDOWS";
export type PrinterInterface = "TCP" | "USB" | "WINDOWS_DRIVER";
export type PrinterLocation = {
  id: string;
  name: string;
  isReceiptDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PrinterDevice = {
  id: string;
  name: string;
  type: PrinterDeviceType;
  interface: PrinterInterface;
  host?: string | null;
  port?: number | null;
  locationId?: string | null;
  isActive: boolean;
  workstationId?: string | null;
  lastSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listPrinterLocations(): Promise<PrinterLocation[]> {
  const res = await apiClient.get<PrinterLocation[]>("/printing/locations");
  return res.data;
}

export async function createPrinterLocation(payload: {
  name: string;
  isReceiptDefault?: boolean;
}): Promise<PrinterLocation> {
  const res = await apiClient.post<PrinterLocation>("/printing/locations", payload);
  return res.data;
}

export async function updatePrinterLocation(
  id: string,
  payload: Partial<{ name: string; isReceiptDefault: boolean }>,
): Promise<PrinterLocation> {
  const res = await apiClient.patch<PrinterLocation>(`/printing/locations/${id}`, payload);
  return res.data;
}

export async function deletePrinterLocation(id: string, opts?: { force?: boolean }): Promise<void> {
  await apiClient.delete(`/printing/locations/${id}`, { params: opts });
}

export async function listPrinterDevices(filters?: {
  locationId?: string;
  active?: boolean;
}): Promise<PrinterDevice[]> {
  const res = await apiClient.get<PrinterDevice[]>("/printing/devices", { params: filters });
  return res.data;
}

export async function createPrinterDevice(payload: {
  name: string;
  type: PrinterDeviceType;
  interface: PrinterInterface;
  host?: string | null;
  port?: number | null;
  locationId?: string | null;
  isActive?: boolean;
  workstationId?: string | null;
}): Promise<PrinterDevice> {
  const res = await apiClient.post<PrinterDevice>("/printing/devices", payload);
  return res.data;
}

export async function updatePrinterDevice(
  id: string,
  payload: Partial<{
    name: string;
    type: PrinterDeviceType;
    interface: PrinterInterface;
    host?: string | null;
    port?: number | null;
    locationId?: string | null;
    isActive?: boolean;
    workstationId?: string | null;
  }>,
): Promise<PrinterDevice> {
  const res = await apiClient.patch<PrinterDevice>(`/printing/devices/${id}`, payload);
  return res.data;
}

export async function testPrinterDevice(id: string) {
  const res = await apiClient.post(`/printing/devices/${id}/test`);
  return res.data;
}

export type SaleReceipt = {
  saleId: string;
  number?: number | null;
  tenant: { name: string; cnpj?: string | null; address?: string | null };
  operatorName?: string | null;
  registerNumber?: string | null;
  items: Array<{
    id: string;
    productId: string;
    sku: string | null;
    name: string;
    qty: number;
    unitPriceCents: number;
    totalCents: number;
    discountCents: number;
  }>;
  payments: Array<{
    id: string;
    method: string;
    amountCents: number;
    providerId?: string | null;
  }>;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paidCents: number;
  changeCents: number;
  fiscalKey?: string | null;
  createdAt: string;
  receiptText: string;
  escposBase64: string;
};

export async function fetchSaleReceipt(saleId: string): Promise<SaleReceipt> {
  try {
    const res = await apiClient.get<SaleReceipt>(`/sales/${saleId}/receipt`);
    return res.data;
  } catch (error: unknown) {
    const maybeAxios = error as ApiError;
    const message =
      typeof maybeAxios?.response?.data?.message === "string"
        ? maybeAxios.response.data.message
        : "Falha ao buscar recibo da venda.";
    throw new Error(message);
  }
}


// =======================
// SESS?O / KEEP ALIVE POS
// =======================

export async function ensureSessionAlive(): Promise<void> {
  // Usa /auth/me: se o access estiver expirado, o interceptor tenta refresh.
  // Se falhar, propagamos o erro para o chamador decidir.
  await apiClient.get("/auth/me");
}

// =======================
// CATEGORIAS (PAINEL ADMIN)
// =======================

export type Category = {
  id: string;
  tenantId: string;
  name: string;
  imagePath: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listCategories(): Promise<Category[]> {
  const response = await apiClient.get<Category[]>("/categories");
  return response.data;
}

export async function createCategory(
  name: string,
  imageFile?: File | null,
): Promise<Category> {
  const formData = new FormData();
  formData.append("name", name);
  if (imageFile) {
    formData.append("image", imageFile);
  }

  const response = await apiClient.post<Category>("/categories", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data;
}

export async function updateCategory(
  id: string,
  params: { name: string; imageFile?: File | null },
): Promise<Category> {
  const formData = new FormData();
  formData.append("name", params.name);
  if (params.imageFile) {
    formData.append("image", params.imageFile);
  }

  const response = await apiClient.put<Category>(`/categories/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data;
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/categories/${id}`);
}

// =======================
// ESTOQUE / DEPÓSITOS
// =======================

export type StockLocation = {
  id: string;
  tenantId: string;
  name: string;
  isSaleSource: boolean;
  createdAt: string;
  updatedAt: string;
  totalSkus?: number;
  totalQuantity?: string | number;
};

export async function listStockLocations(): Promise<StockLocation[]> {
  const response = await apiClient.get<{ items: StockLocation[] }>("/stock/locations");
  return response.data.items ?? [];
}

export async function createStockLocation(payload: { name: string; isSaleSource?: boolean }): Promise<StockLocation> {
  const response = await apiClient.post<StockLocation>("/stock/locations", {
    name: payload.name,
    isSaleSource: payload.isSaleSource ?? false,
  });
  return response.data;
}

export async function updateStockLocation(
  id: string,
  payload: { name: string; isSaleSource?: boolean },
): Promise<StockLocation> {
  const response = await apiClient.put<StockLocation>(`/stock/locations/${id}`, {
    name: payload.name,
    isSaleSource: payload.isSaleSource ?? false,
  });
  return response.data;
}

export async function deleteStockLocation(id: string): Promise<void> {
  await apiClient.delete(`/stock/locations/${id}`);
}

export type Product = {
  id: string;
  tenantId: string;
  name: string;
  sku: string;
  price?: string | null;
  barcode?: string | null;
  categoryId?: string | null;
};

export async function listProducts(): Promise<Product[]> {
  const response = await apiClient.get<Product[]>("/products");
  return response.data;
}

export type InventoryItem = {
  id: string;
  tenantId: string;
  productId: string;
  locationId: string;
  quantity: string;
};

export async function listInventory(): Promise<InventoryItem[]> {
  const response = await apiClient.get<{ items: InventoryItem[] } | InventoryItem[]>("/stock");
  // API devolve { items } ou array direto, tratar ambos
  const data = Array.isArray(response.data)
    ? response.data
    : Array.isArray((response.data as { items?: InventoryItem[] }).items)
      ? (response.data as { items: InventoryItem[] }).items
      : [];
  return data;
}

export async function initInventoryBulk(items: Array<{ productId: string; locationId: string }>): Promise<void> {
  await apiClient.post("/stock/init/bulk", { items });
}

export async function adjustStock(payload: {
  productId: string;
  locationId: string;
  qty: number;
  reason?: string;
}): Promise<void> {
  await apiClient.post("/stock/adjust", payload);
}

export async function stockTransfer(payload: {
  productId: string;
  fromLocationId: string;
  toLocationId: string;
  qty: number;
  reason?: string;
}): Promise<void> {
  await apiClient.post("/stock/transfer", payload);
}

export async function deleteInventoryItem(productId: string, locationId: string): Promise<void> {
  await apiClient.delete("/stock/inventory", {
    params: { productId, locationId },
  });
}

export type StockMovement = {
  id: string;
  tenantId: string;
  productId: string;
  locationId: string;
  type: "IN" | "OUT" | "ADJUST" | "CANCEL" | "RETURN";
  quantity: string | number;
  reason?: string | null;
  refId?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt: string;
};

export async function listStockMovements(params?: { productId?: string; locationId?: string }): Promise<StockMovement[]> {
  const response = await apiClient.get<{ items: StockMovement[] }>("/stock/movements", {
    params: {
      productId: params?.productId,
      locationId: params?.locationId,
    },
  });
  return response.data.items ?? [];
}

export type Customer = {
  id: string;
  name: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  allowCredit?: boolean;
  creditLimit?: string | null;
  defaultDueDays?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function searchCustomers(params?: { q?: string; active?: boolean }): Promise<Customer[]> {
  const response = await apiClient.get<Customer[]>("/customers", {
    params: {
      q: params?.q,
      active: params?.active,
    },
  });
  return response.data;
}

export async function createCustomer(payload: {
  name: string;
  document?: string;
  phone?: string;
  email?: string;
  address?: string;
  allowCredit?: boolean;
  creditLimit?: string;
  defaultDueDays?: number;
  isActive?: boolean;
}): Promise<Customer> {
  const response = await apiClient.post<Customer>("/customers", payload);
  return response.data;
}

export async function updateCustomer(
  id: string,
  payload: Partial<{
    name: string;
    document?: string;
    phone?: string;
    email?: string;
    address?: string;
    allowCredit?: boolean;
    creditLimit?: string;
    defaultDueDays?: number;
    isActive?: boolean;
  }>,
): Promise<Customer> {
  const response = await apiClient.patch<Customer>(`/customers/${id}`, payload);
  return response.data;
}

export async function deleteCustomer(id: string): Promise<void> {
  await apiClient.delete(`/customers/${id}`);
}

export type ComandaStatus = "ABERTO" | "PENDENTE" | "ENCERRADO";
export type ComandaCustomerStatus = "ATIVO" | "DESATIVADO";

export type ComandaPayload = {
  number: string;
  customerName?: string;
  customerPhone?: string;
  customerCpf?: string;
  status?: ComandaStatus;
  customerStatus?: ComandaCustomerStatus;
  notes?: string;
};

export type Comanda = ComandaPayload & {
  id: string;
  tenantId: string;
  tableNumber?: string | null;
  openedAt: string;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  totalValue?: number;
  totalItems?: number;
  items?: Array<{
    id: string;
    productId: string;
    quantity: string | number;
    unitPrice: string | number;
    totalPrice: string | number;
    notes?: string | null;
    tableNumber?: string | null;
    createdAt?: string;
    createdByUserId?: string | null;
    createdByUserName?: string | null;
    product?: { id: string; name: string; price?: string | number | null; barcode?: string | null; sku?: string | null };
  }>;
};

export async function listComandas(params?: {
  q?: string;
  status?: ComandaStatus;
  customerStatus?: ComandaCustomerStatus;
}): Promise<Comanda[]> {
  const response = await apiClient.get<Comanda[]>("/comandas", {
    params: {
      q: params?.q,
      status: params?.status,
      customerStatus: params?.customerStatus,
    },
  });
  return response.data;
}

export async function getComanda(id: string): Promise<Comanda> {
  const response = await apiClient.get<Comanda>(`/comandas/${id}`);
  return response.data;
}

export async function createComanda(payload: ComandaPayload): Promise<Comanda> {
  const response = await apiClient.post<Comanda>("/comandas", payload);
  return response.data;
}

export async function updateComanda(
  id: string,
  payload: Partial<ComandaPayload>,
): Promise<Comanda> {
  const response = await apiClient.patch<Comanda>(`/comandas/${id}`, payload);
  return response.data;
}

export async function deleteComanda(id: string): Promise<void> {
  await apiClient.delete(`/comandas/${id}`);
}

export type ComandaOrderItemPayload = { productId: string; qty: number };

export async function addItemsToComanda(
  id: string,
  payload: {
    items: ComandaOrderItemPayload[];
    tableNumber?: string;
    notes?: string;
  },
): Promise<{ comandaId: string; itemsAdded: number; totalValue: string }> {
  const response = await apiClient.post<{ comandaId: string; itemsAdded: number; totalValue: string }>(
    `/comandas/${id}/items`,
    payload,
  );
  return response.data;
}
