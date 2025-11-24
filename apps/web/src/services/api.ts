import { API_URL } from "./config";
import { apiClient } from "./http";

export type SuperAdminTokens = { token: string; tokenType: string; expiresIn: string };

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
    const err = error as { response?: { data?: { message?: string } } };
    const message =
      err.response?.data?.message ??
      "Nǜo foi poss��vel alcan��ar a API de autentica��ǜo. Verifique se o backend e o CORS estǜo configurados.";
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

