export const API_URL = "http://localhost:3000/api";
export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const raw = await res.text();
  let payload: any = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }
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
  return payload as { access: string; refresh: string };
}
export async function ping(access: string, tenantId: string) {
  const res = await fetch(`${API_URL}/ping`, { headers: { "Authorization": `Bearer ${access}`, "x-tenant-id": tenantId } });
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

  const payload = await parseJson(res);

  if (!res.ok) {
    const message =
      typeof payload?.error?.message === "string" ? payload.error.message : "Não foi possível carregar o relatório.";
    throw new Error(message);
  }

  if (!payload) {
    throw new Error("Resposta vazia ao tentar carregar o relatório.");
  }

  return payload as CashClosingReport;
}
