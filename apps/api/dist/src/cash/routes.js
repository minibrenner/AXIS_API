"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cashRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const rbac_1 = require("../security/rbac");
const client_1 = require("../prisma/client");
const supervisorAuth_1 = require("../security/supervisorAuth");
const httpErrors_1 = require("../utils/httpErrors");
const service_1 = require("../printing/service");
const tenant_context_1 = require("../tenancy/tenant.context");
const PAYMENT_LABELS = {
    debit: "Debito",
    credit: "Credito",
    vr: "VR",
    va: "VA",
    cash: "Dinheiro",
    pix: "PIX",
    store_credit: "Fiado",
};
const PAYMENT_ORDER = ["debit", "credit", "vr", "va", "cash", "pix", "store_credit"];
const ROLE_GUARD = (0, rbac_1.allowRoles)("ADMIN", "OWNER", "ATTENDANT");
const openSchema = zod_1.z.object({
    registerNumber: zod_1.z.string().trim().min(1).max(32).optional(),
    openingCents: zod_1.z.coerce.number().int().nonnegative(),
    notes: zod_1.z.string().trim().max(280).optional(),
});
const withdrawalSchema = zod_1.z.object({
    cashSessionId: zod_1.z.string().cuid(),
    amountCents: zod_1.z.coerce.number().int().positive(),
    reason: zod_1.z.string().trim().min(3).max(280),
    supervisorSecret: zod_1.z.string().trim().min(4).optional(),
});
const closeSchema = zod_1.z.object({
    cashSessionId: zod_1.z.string().cuid(),
    closingCents: zod_1.z.coerce.number().int().nonnegative(),
    supervisorSecret: zod_1.z.string().trim().min(4),
    notes: zod_1.z.string().trim().max(280).optional(),
});
const sessionParamSchema = zod_1.z.object({ cashSessionId: zod_1.z.string().cuid() });
exports.cashRouter = (0, express_1.Router)();
exports.cashRouter.post("/open", ROLE_GUARD, async (req, res) => {
    const { registerNumber, openingCents, notes } = openSchema.parse(req.body);
    const tenantId = req.tenantId;
    const session = await tenant_context_1.TenantContext.run(tenantId, async () => {
        const tenant = await client_1.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            throw new httpErrors_1.HttpError({
                status: 404,
                code: httpErrors_1.ErrorCodes.TENANT_NOT_FOUND,
                message: "Tenant nao encontrado.",
            });
        }
        const openCount = await client_1.prisma.cashSession.count({
            where: { tenantId, closedAt: null },
        });
        const maxOpen = tenant.maxOpenCashSessions ?? 1;
        if (openCount >= maxOpen) {
            throw new httpErrors_1.HttpError({
                status: 409,
                code: httpErrors_1.ErrorCodes.CONFLICT,
                message: "Caixas abertos excede o numero permitido, por favor feche um ou mais caixas para continuar.",
                details: { maxOpen },
            });
        }
        const normalizedRegister = registerNumber?.length ? registerNumber : null;
        if (normalizedRegister) {
            const registerInUse = await client_1.prisma.cashSession.findFirst({
                where: { tenantId, registerNumber: normalizedRegister, closedAt: null },
            });
            if (registerInUse) {
                throw new httpErrors_1.HttpError({
                    status: 409,
                    code: httpErrors_1.ErrorCodes.CONFLICT,
                    message: "Ja existe um caixa aberto com essa numeracao para este tenant.",
                });
            }
        }
        return client_1.prisma.cashSession.create({
            data: {
                tenantId,
                userId: req.user.userId,
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
const readCurrentSession = async (tenantId) => tenant_context_1.TenantContext.run(tenantId, () => client_1.prisma.cashSession.findFirst({
    where: { tenantId, closedAt: null },
    include: { withdrawals: { orderBy: { createdAt: "asc" } } },
}));
const currentSessionHandler = async (req, res) => {
    const tenantId = req.tenantId;
    const session = await readCurrentSession(tenantId);
    res.json(session);
};
exports.cashRouter.get("/session", ROLE_GUARD, currentSessionHandler);
exports.cashRouter.get("/open", ROLE_GUARD, currentSessionHandler);
exports.cashRouter.post("/withdraw", ROLE_GUARD, async (req, res) => {
    const { cashSessionId, amountCents, reason, supervisorSecret } = withdrawalSchema.parse(req.body);
    const tenantId = req.tenantId;
    const { withdrawal, approval } = await tenant_context_1.TenantContext.run(tenantId, async () => {
        const session = await client_1.prisma.cashSession.findFirst({
            where: { id: cashSessionId, tenantId, closedAt: null },
        });
        if (!session) {
            throw new httpErrors_1.HttpError({
                status: 404,
                code: httpErrors_1.ErrorCodes.NOT_FOUND,
                message: "Caixa nao encontrado ou ja encerrado.",
            });
        }
        const secret = supervisorSecret ?? req.header("x-supervisor-secret") ?? undefined;
        const approval = await (0, supervisorAuth_1.requireSupervisorApproval)(tenantId, secret, "Sangria de caixa");
        const withdrawal = await client_1.prisma.cashWithdrawal.create({
            data: {
                tenantId,
                cashSessionId,
                amountCents,
                reason,
                createdById: req.user.userId,
            },
        });
        return { withdrawal, approval };
    });
    res.status(201).json({ ...withdrawal, approvedBy: approval });
});
exports.cashRouter.post("/close", ROLE_GUARD, async (req, res) => {
    const { cashSessionId, closingCents, supervisorSecret, notes } = closeSchema.parse(req.body);
    const tenantId = req.tenantId;
    const enrichedSnapshot = await tenant_context_1.TenantContext.run(tenantId, async () => {
        const session = await client_1.prisma.cashSession.findFirst({
            where: { id: cashSessionId, tenantId },
            include: { withdrawals: { orderBy: { createdAt: "asc" } } },
        });
        if (!session || session.closedAt) {
            throw new httpErrors_1.HttpError({
                status: 404,
                code: httpErrors_1.ErrorCodes.NOT_FOUND,
                message: "Sessao de caixa nao encontrada ou ja fechada.",
            });
        }
        const approval = await (0, supervisorAuth_1.requireSupervisorApproval)(tenantId, supervisorSecret, "Fechamento de caixa");
        const closedAt = new Date();
        const closingNotes = notes?.length ? notes : null;
        const snapshot = await buildClosingSnapshot({
            tenantId,
            session,
            closedAt,
            closingCents,
            closedByUserId: req.user.userId,
            closingNotes,
            supervisor: approval,
        });
        const printJob = await (0, service_1.enqueueCashClosingPrintJob)({
            tenantId,
            userId: req.user.userId,
            cashSessionId: session.id,
            snapshot,
        });
        const enriched = {
            ...snapshot,
            printJobId: printJob.id,
            printJobStatus: printJob.status,
        };
        await client_1.prisma.cashSession.update({
            where: { id: session.id },
            data: {
                closingCents,
                closedAt,
                closedByUserId: req.user.userId,
                closingSupervisorId: approval.approverId,
                closingSupervisorRole: approval.approverRole,
                closingApprovalVia: approval.via,
                closingSnapshot: enriched,
                closingNotes,
            },
        });
        return enriched;
    });
    res.json(enrichedSnapshot);
});
exports.cashRouter.get("/:cashSessionId/report", ROLE_GUARD, async (req, res) => {
    const { cashSessionId } = sessionParamSchema.parse(req.params);
    const tenantId = req.tenantId;
    const snapshot = await tenant_context_1.TenantContext.run(tenantId, async () => {
        const session = await client_1.prisma.cashSession.findFirst({
            where: { id: cashSessionId, tenantId },
            include: { withdrawals: { orderBy: { createdAt: "asc" } } },
        });
        if (!session || !session.closedAt || session.closingCents === null) {
            throw new httpErrors_1.HttpError({
                status: 409,
                code: httpErrors_1.ErrorCodes.CONFLICT,
                message: "Este caixa ainda nao foi encerrado.",
            });
        }
        if (session.closingSnapshot) {
            return session.closingSnapshot;
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
async function buildClosingSnapshot(input) {
    const { tenantId, session, closedAt, closingCents, closedByUserId, closingNotes, supervisor } = input;
    const normalizedClosingNotes = closingNotes ?? session.closingNotes ?? null;
    const [paymentTotals, saleAgg, storeCreditDetails] = await Promise.all([
        client_1.prisma.payment.groupBy({
            by: ["method"],
            where: { sale: { tenantId, cashSessionId: session.id, status: "FINALIZED" } },
            _sum: { amountCents: true },
        }),
        client_1.prisma.sale.aggregate({
            where: { tenantId, cashSessionId: session.id, status: "FINALIZED" },
            _sum: { changeCents: true, totalCents: true },
        }),
        client_1.prisma.payment.findMany({
            where: { method: "store_credit", sale: { tenantId, cashSessionId: session.id, status: "FINALIZED" } },
            select: { amountCents: true, providerId: true, sale: { select: { number: true } } },
        }),
    ]);
    const totalsMap = new Map();
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
    const fiadoMap = new Map();
    for (const payment of storeCreditDetails) {
        const reference = payment.providerId?.trim() || `Venda #${payment.sale.number}`;
        fiadoMap.set(reference, (fiadoMap.get(reference) ?? 0) + payment.amountCents);
    }
    const fiadoEntries = Array.from(fiadoMap.entries()).map(([reference, amountCents]) => ({ reference, amountCents }));
    const totalFiadoCents = fiadoEntries.reduce((acc, entry) => acc + entry.amountCents, 0);
    const supervisorInfo = supervisor ??
        (session.closingSupervisorId
            ? {
                approverId: session.closingSupervisorId,
                approverRole: session.closingSupervisorRole ?? "ADMIN",
                via: session.closingApprovalVia ?? "PIN",
            }
            : undefined);
    const withdrawalAuthorIds = session.withdrawals.map((w) => w.createdById);
    const userIds = new Set([session.userId, closedByUserId, ...withdrawalAuthorIds]);
    if (supervisorInfo) {
        userIds.add(supervisorInfo.approverId);
    }
    const users = await client_1.prisma.user.findMany({
        where: { tenantId, id: { in: Array.from(userIds) } },
        select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name ?? null]));
    const withdrawals = session.withdrawals.map((withdrawal) => ({
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
//# sourceMappingURL=routes.js.map