const configuredApiUrl =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL)
    : "";

const apiBase = configuredApiUrl || "http://localhost:3000/api";

export const API_URL = apiBase.replace(/\/$/, "");

const defaultHeaders = { "Content-Type": "application/json" } as const;

const defaultNetworkErrorMessage =
  "Não foi possível conectar com a API. Verifique se o backend está ativo e se o domínio deste front-end foi liberado no CORS.";

async function safeFetch(
  input: RequestInfo,
  init?: RequestInit,
  networkErrorMessage?: string,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    const err = new Error(networkErrorMessage ?? defaultNetworkErrorMessage);
    (err as { cause?: unknown }).cause = error;
    throw err;
  }
}

const readPayload = async <T>(res: Response): Promise<T> => {
  const raw = await res.text();
  if (!raw) {
    return null as T;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null as T;
  }
};

export type AuthTokens = { access: string; refresh: string };
export type SuperAdminTokens = { token: string; tokenType: string; expiresIn: string };

export async function login(email: string, password: string): Promise<AuthTokens> {
  const res = await safeFetch(
    `${API_URL}/auth/login`,
    {
      method: "POST",
      headers: defaultHeaders,
      body: JSON.stringify({ email, password }),
    },
    "Não foi possível alcançar a API de autenticação. Verifique se o backend e o CORS estão configurados.",
  );
  const payload = await readPayload<AuthTokens & { message?: string }>(res);

  if (!res.ok) {
    const details =
      typeof payload?.message === "string"
        ? payload.message
        : "Login falhou";
    throw new Error(details);
  }
  if (!payload) {
    throw new Error("Resposta inesperada da API de login.");
  }
  return { access: payload.access, refresh: payload.refresh };
}

export async function loginSuperAdmin(email: string, password: string): Promise<SuperAdminTokens> {
  const res = await safeFetch(
    `${API_URL}/super-admin/login`,
    {
      method: "POST",
      headers: defaultHeaders,
      body: JSON.stringify({ email, password }),
    },
    "Não foi possível conectar com a API de super admin. Verifique se o backend está ativo e se o CORS permite este domínio.",
  );
  const payload = await readPayload<SuperAdminTokens & { message?: string }>(res);

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

export async function fetchCurrentUser(access: string) {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!res.ok) {
    throw new Error("Não foi possível obter os dados do usuário.");
  }
  return res.json();
}

export async function requestPasswordReset(email: string) {
  const res = await fetch(`${API_URL}/auth/forgot-password`, {
    method: "POST",
    headers: defaultHeaders,
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const payload = await readPayload<{ message?: string }>(res);
    throw new Error(
      typeof payload?.message === "string"
        ? payload.message
        : "Não foi possível iniciar o reset.",
    );
  }
}

export async function resetPassword(token: string, newPassword: string) {
  const res = await fetch(`${API_URL}/auth/reset-password`, {
    method: "POST",
    headers: defaultHeaders,
    body: JSON.stringify({ token, newPassword }),
  });
  if (!res.ok) {
    const payload = await readPayload<{ message?: string }>(res);
    throw new Error(
      typeof payload?.message === "string"
        ? payload.message
        : "Não foi possível redefinir a senha.",
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
    throw new Error("Token de super admin ausente. Faça login novamente.");
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
    throw new Error("Sessão de super admin expirou. Faça login novamente.");
  }
  return res;
}

export async function fetchSuperAdminOverview(token: string): Promise<SuperAdminMetrics> {
  const res = await saFetch(token, "/overview");
  if (!res.ok) {
    throw new Error("Não foi possível obter os indicadores do super admin.");
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
    throw new Error("Não foi possível obter a lista de tenants.");
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
    throw new Error("Tenant identifier obrigat��rio para criar usuǭrio.");
  }

  const res = await saFetch(token, `/tenants/${identifier}/users`, {
    method: "POST",
    body: JSON.stringify(rest),
  });
  if (!res.ok) {
    const data = await parseJson(res);
    throw new Error(data?.message ?? "Falha ao criar usuário para o tenant.");
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
    throw new Error("Falha ao buscar relatório de fechamento de caixa.");
  }

  return res.json();
}
