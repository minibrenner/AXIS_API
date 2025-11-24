import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { CashSession, CashWithdrawal, PayMethod, Prisma, Role, PrintJobStatus } from "@prisma/client";
import { allowRoles } from "../security/rbac";
import { prisma } from "../prisma/client";
import { requireSupervisorApproval, type SupervisorApproval } from "../security/supervisorAuth";
import { ErrorCodes, HttpError } from "../utils/httpErrors";
import { enqueueCashClosingPrintJob } from "../printing/service";
import { TenantContext } from "../tenancy/tenant.context";

type SessionWithWithdrawals = CashSession & { withdrawals: CashWithdrawal[] };

type WithdrawalEntry = {
  id: string;
  amountCents: number;
  reason: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string | null;
  };
};

export type CashClosingSnapshot = {
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
  openedBy: {
    id: string;
    name: string | null;
  };
  closedBy: {
    id: string;
    name: string | null;
  };
  approvedBy?: {
    id: string;
    name: string | null;
    role: Role;
    via: "PIN" | "PASSWORD";
  };
  printJobId?: string | null;
  printJobStatus?: PrintJobStatus;
  paymentBreakdown: Array<{ method: PayMethod; label: string; amountCents: number }>;
  withdrawals: WithdrawalEntry[];
  fiado: {
    totalCents: number;
    entries: Array<{ reference: string; amountCents: number }>;
  };
};

const PAYMENT_LABELS: Record<PayMethod, string> = {
  debit: "Debito",
  credit: "Credito",
  vr: "VR",
  va: "VA",
  cash: "Dinheiro",
  pix: "PIX",
  store_credit: "Fiado",
};

const PAYMENT_ORDER: PayMethod[] = ["debit", "credit", "vr", "va", "cash", "pix", "store_credit"];
const ROLE_GUARD = allowRoles("ADMIN", "OWNER", "ATTENDANT");

const openSchema = z.object({
  registerNumber: z.string().trim().min(1).max(32).optional(),
  openingCents: z.coerce.number().int().nonnegative(),
  notes: z.string().trim().max(280).optional(),
});

const withdrawalSchema = z.object({
  cashSessionId: z.string().cuid(),
  amountCents: z.coerce.number().int().positive(),
  reason: z.string().trim().min(3).max(280),
  supervisorSecret: z.string().trim().min(4).optional(),
});

const closeSchema = z.object({
  cashSessionId: z.string().cuid(),
  closingCents: z.coerce.number().int().nonnegative(),
  supervisorSecret: z.string().trim().min(4),
  notes: z.string().trim().max(280).optional(),
});

const sessionParamSchema = z.object({ cashSessionId: z.string().cuid() });

export const cashRouter = Router();

cashRouter.post("/open", ROLE_GUARD, async (req, res) => {
  const { registerNumber, openingCents, notes } = openSchema.parse(req.body);
  const tenantId = req.tenantId!;

  const session = await TenantContext.run(tenantId, async () => {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new HttpError({
        status: 404,
        code: ErrorCodes.TENANT_NOT_FOUND,
        message: "Tenant nao encontrado.",
      });
    }

    const openCount = await prisma.cashSession.count({
      where: { tenantId, closedAt: null },
    });

    const maxOpen = tenant.maxOpenCashSessions ?? 1;
    if (openCount >= maxOpen) {
      throw new HttpError({
        status: 409,
        code: ErrorCodes.CONFLICT,
        message:
          "Caixas abertos excede o numero permitido, por favor feche um ou mais caixas para continuar.",
        details: { maxOpen },
      });
    }

    const normalizedRegister = registerNumber?.length ? registerNumber : null;
    if (normalizedRegister) {
      const registerInUse = await prisma.cashSession.findFirst({
        where: { tenantId, registerNumber: normalizedRegister, closedAt: null },
      });
      if (registerInUse) {
        throw new HttpError({
          status: 409,
          code: ErrorCodes.CONFLICT,
          message: "Ja existe um caixa aberto com essa numeracao para este tenant.",
        });
      }
    }

    return prisma.cashSession.create({
      data: {
        tenantId,
        userId: req.user!.userId,
        openingCents,
        notes: notes?.length ? notes : null,
        registerNumber: normalizedRegister,
      },
    });
  });

  res.status(201).json({
    session,
    nextAction: {
      type: "POS_REDIRECT",
      path: "/pos",
      message: "Redirecione o atendente para o PDV.",
    },
  });
});

const readCurrentSession = async (tenantId: string) =>
  TenantContext.run(tenantId, () =>
    prisma.cashSession.findFirst({
      where: { tenantId, closedAt: null },
      include: { withdrawals: { orderBy: { createdAt: "asc" } } },
    }),
  );

const currentSessionHandler = async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const session = await readCurrentSession(tenantId);
  res.json(session);
};

cashRouter.get("/session", ROLE_GUARD, currentSessionHandler);
cashRouter.get("/open", ROLE_GUARD, currentSessionHandler);

cashRouter.post("/withdraw", ROLE_GUARD, async (req, res) => {
  const { cashSessionId, amountCents, reason, supervisorSecret } = withdrawalSchema.parse(req.body);
  const tenantId = req.tenantId!;

  const { withdrawal, approval } = await TenantContext.run(tenantId, async () => {
    const session = await prisma.cashSession.findFirst({
      where: { id: cashSessionId, tenantId, closedAt: null },
    });

    if (!session) {
      throw new HttpError({
        status: 404,
        code: ErrorCodes.NOT_FOUND,
        message: "Caixa nao encontrado ou ja encerrado.",
      });
    }

    const secret = supervisorSecret ?? req.header("x-supervisor-secret") ?? undefined;
    const approval = await requireSupervisorApproval(tenantId, secret, "Sangria de caixa");

    const withdrawal = await prisma.cashWithdrawal.create({
      data: {
        tenantId,
        cashSessionId,
        amountCents,
        reason,
        createdById: req.user!.userId,
      },
    });

    return { withdrawal, approval };
  });

  res.status(201).json({ ...withdrawal, approvedBy: approval });
});

cashRouter.post("/close", ROLE_GUARD, async (req, res) => {
  const { cashSessionId, closingCents, supervisorSecret, notes } = closeSchema.parse(req.body);
  const tenantId = req.tenantId!;

  const enrichedSnapshot = await TenantContext.run(tenantId, async () => {
    const session = await prisma.cashSession.findFirst({
      where: { id: cashSessionId, tenantId },
      include: { withdrawals: { orderBy: { createdAt: "asc" } } },
    });

    if (!session || session.closedAt) {
      throw new HttpError({
        status: 404,
        code: ErrorCodes.NOT_FOUND,
        message: "Sessao de caixa nao encontrada ou ja fechada.",
      });
    }

    const approval = await requireSupervisorApproval(tenantId, supervisorSecret, "Fechamento de caixa");
    const closedAt = new Date();
    const closingNotes = notes?.length ? notes : null;

    const snapshot = await buildClosingSnapshot({
      tenantId,
      session,
      closedAt,
      closingCents,
      closedByUserId: req.user!.userId,
      closingNotes,
      supervisor: approval,
    });

    const printJob = await enqueueCashClosingPrintJob({
      tenantId,
      userId: req.user!.userId,
      cashSessionId: session.id,
      snapshot,
    });

    const enriched: CashClosingSnapshot = {
      ...snapshot,
      printJobId: printJob.id,
      printJobStatus: printJob.status,
    };

    await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        closingCents,
        closedAt,
        closedByUserId: req.user!.userId,
        closingSupervisorId: approval.approverId,
        closingSupervisorRole: approval.approverRole,
        closingApprovalVia: approval.via,
        closingSnapshot: enriched as Prisma.JsonObject,
        closingNotes,
      },
    });

    return enriched;
  });

  res.json(enrichedSnapshot);
});

cashRouter.get("/:cashSessionId/report", ROLE_GUARD, async (req, res) => {
  const { cashSessionId } = sessionParamSchema.parse(req.params);
  const tenantId = req.tenantId!;

  const snapshot = await TenantContext.run(tenantId, async () => {
    const session = await prisma.cashSession.findFirst({
      where: { id: cashSessionId, tenantId },
      include: { withdrawals: { orderBy: { createdAt: "asc" } } },
    });

    if (!session || !session.closedAt || session.closingCents === null) {
      throw new HttpError({
        status: 409,
        code: ErrorCodes.CONFLICT,
        message: "Este caixa ainda nao foi encerrado.",
      });
    }

    if (session.closingSnapshot) {
      return session.closingSnapshot as CashClosingSnapshot;
    }

    return buildClosingSnapshot({
      tenantId,
      session,
      closedAt: session.closedAt,
      closingCents: session.closingCents,
      closedByUserId: session.closedByUserId ?? session.userId,
      closingNotes: session.closingNotes ?? null,
      supervisor: session.closingSupervisorId
        ? {
            approverId: session.closingSupervisorId,
            approverRole: session.closingSupervisorRole ?? "ADMIN",
            via: session.closingApprovalVia ?? "PIN",
          }
        : undefined,
    });
  });

  res.json(snapshot);
});

async function buildClosingSnapshot(input: {
  tenantId: string;
  session: SessionWithWithdrawals;
  closedAt: Date;
  closingCents: number;
  closedByUserId: string;
  closingNotes: string | null;
  supervisor?: SupervisorApproval;
}): Promise<CashClosingSnapshot> {
  const { tenantId, session, closedAt, closingCents, closedByUserId, closingNotes, supervisor } = input;
  const normalizedClosingNotes = closingNotes ?? session.closingNotes ?? null;

  const [paymentTotals, saleAgg, storeCreditDetails] = await Promise.all([
    prisma.payment.groupBy({
      by: ["method"],
      where: { sale: { tenantId, cashSessionId: session.id, status: "FINALIZED" } },
      _sum: { amountCents: true },
    }),
    prisma.sale.aggregate({
      where: { tenantId, cashSessionId: session.id, status: "FINALIZED" },
      _sum: { changeCents: true, totalCents: true },
    }),
    prisma.payment.findMany({
      where: { method: "store_credit", sale: { tenantId, cashSessionId: session.id, status: "FINALIZED" } },
      select: { amountCents: true, providerId: true, sale: { select: { number: true } } },
    }),
  ]);

  const totalsMap = new Map<PayMethod, number>();
  paymentTotals.forEach((entry) => {
    totalsMap.set(entry.method, entry._sum.amountCents ?? 0);
  });

  const paymentBreakdown = PAYMENT_ORDER.map((method) => ({
    method,
    label: PAYMENT_LABELS[method],
    amountCents: totalsMap.get(method) ?? 0,
  }));

  const totalPaymentsCents = paymentBreakdown.reduce((acc, item) => acc + item.amountCents, 0);
  const cashPaymentsCents = paymentBreakdown.find((item) => item.method === "cash")?.amountCents ?? 0;
  const totalChangeCents = saleAgg._sum.changeCents ?? 0;
  const totalSalesCents = saleAgg._sum.totalCents ?? 0;
  const totalWithdrawalsCents = session.withdrawals.reduce((acc, w) => acc + w.amountCents, 0);
  const cashSalesCents = Math.max(cashPaymentsCents - totalChangeCents, 0);
  const expectedCashCents = session.openingCents + cashSalesCents - totalWithdrawalsCents;
  const differenceCents = closingCents - expectedCashCents;

  const fiadoMap = new Map<string, number>();
  for (const payment of storeCreditDetails) {
    const reference = payment.providerId?.trim() || `Venda #${payment.sale.number}`;
    fiadoMap.set(reference, (fiadoMap.get(reference) ?? 0) + payment.amountCents);
  }
  const fiadoEntries = Array.from(fiadoMap.entries()).map(([reference, amountCents]) => ({ reference, amountCents }));
  const totalFiadoCents = fiadoEntries.reduce((acc, entry) => acc + entry.amountCents, 0);

  const supervisorInfo =
    supervisor ??
    (session.closingSupervisorId
      ? {
          approverId: session.closingSupervisorId,
          approverRole: session.closingSupervisorRole ?? "ADMIN",
          via: session.closingApprovalVia ?? "PIN",
        }
      : undefined);

  const withdrawalAuthorIds = session.withdrawals.map((w) => w.createdById);
  const userIds = new Set<string>([session.userId, closedByUserId, ...withdrawalAuthorIds]);
  if (supervisorInfo) {
    userIds.add(supervisorInfo.approverId);
  }

  const users = await prisma.user.findMany({
    where: { tenantId, id: { in: Array.from(userIds) } },
    select: { id: true, name: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.name ?? null]));

  const withdrawals: WithdrawalEntry[] = session.withdrawals.map((withdrawal) => ({
    id: withdrawal.id,
    amountCents: withdrawal.amountCents,
    reason: withdrawal.reason,
    createdAt: withdrawal.createdAt.toISOString(),
    createdBy: {
      id: withdrawal.createdById,
      name: userMap.get(withdrawal.createdById) ?? null,
    },
  }));

  return {
    sessionId: session.id,
    tenantId,
    openedAt: session.openedAt.toISOString(),
    closedAt: closedAt.toISOString(),
    openingCents: session.openingCents,
    closingCents,
    cashSalesCents,
    expectedCashCents,
    differenceCents,
    totalPaymentsCents,
    totalSalesCents,
    totalChangeCents,
    totalWithdrawalsCents,
    openingNotes: session.notes ?? null,
    closingNotes: normalizedClosingNotes,
    openedBy: { id: session.userId, name: userMap.get(session.userId) ?? null },
    closedBy: { id: closedByUserId, name: userMap.get(closedByUserId) ?? null },
    approvedBy: supervisorInfo
      ? {
          id: supervisorInfo.approverId,
          name: userMap.get(supervisorInfo.approverId) ?? null,
          role: supervisorInfo.approverRole,
          via: supervisorInfo.via,
        }
      : undefined,
    paymentBreakdown,
    withdrawals,
    fiado: {
      totalCents: totalFiadoCents,
      entries: fiadoEntries,
    },
  };
}

