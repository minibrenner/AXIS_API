"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerService = void 0;
const client_1 = require("../prisma/client");
const tenant_context_1 = require("../tenancy/tenant.context");
const httpErrors_1 = require("../utils/httpErrors");
class LedgerService {
    tenantId() {
        const tenantId = tenant_context_1.TenantContext.get();
        if (!tenantId) {
            throw new httpErrors_1.HttpError({
                status: 400,
                code: httpErrors_1.ErrorCodes.BAD_REQUEST,
                message: "Tenant nao identificado",
            });
        }
        return tenantId;
    }
    sumDecimal(value) {
        return Number(value._sum.amount ?? 0);
    }
    async balance(customerId) {
        const tenantId = this.tenantId();
        const [charges, payments, adjusts] = await Promise.all([
            client_1.prisma.customerLedger.aggregate({ _sum: { amount: true }, where: { tenantId, customerId, type: "CHARGE" } }),
            client_1.prisma.customerLedger.aggregate({ _sum: { amount: true }, where: { tenantId, customerId, type: "PAYMENT" } }),
            client_1.prisma.customerLedger.aggregate({ _sum: { amount: true }, where: { tenantId, customerId, type: "ADJUST" } }),
        ]);
        return this.sumDecimal(charges) - this.sumDecimal(payments) - this.sumDecimal(adjusts);
    }
    async charge(opts) {
        const tenantId = this.tenantId();
        const customer = await client_1.prisma.customer.findFirst({ where: { id: opts.customerId, tenantId } });
        if (!customer) {
            throw new httpErrors_1.HttpError({
                status: 400,
                code: httpErrors_1.ErrorCodes.BAD_REQUEST,
                message: "Cliente invalido",
            });
        }
        if (!customer.allowCredit) {
            throw new httpErrors_1.HttpError({
                status: 403,
                code: httpErrors_1.ErrorCodes.FORBIDDEN,
                message: "Credito nao liberado para este cliente",
            });
        }
        if (opts.idempotencyKey) {
            const duplicate = await client_1.prisma.customerLedger.findFirst({ where: { idempotencyKey: opts.idempotencyKey } });
            if (duplicate) {
                return duplicate;
            }
        }
        const currentBalance = await this.balance(opts.customerId);
        const limit = customer.creditLimit != null ? Number(customer.creditLimit) : Number.POSITIVE_INFINITY;
        if (currentBalance + opts.amount > limit) {
            throw new httpErrors_1.HttpError({
                status: 403,
                code: httpErrors_1.ErrorCodes.FORBIDDEN,
                message: "Ultrapassa limite de credito",
            });
        }
        const dueDate = opts.dueDate ?? (customer.defaultDueDays ? new Date(Date.now() + customer.defaultDueDays * 86_400_000) : null);
        return client_1.prisma.customerLedger.create({
            data: {
                tenantId,
                customerId: opts.customerId,
                type: "CHARGE",
                amount: opts.amount,
                description: opts.description ?? null,
                saleId: opts.saleId ?? null,
                dueDate,
                idempotencyKey: opts.idempotencyKey ?? null,
                createdBy: opts.createdBy ?? null,
            },
        });
    }
    async payment(opts) {
        const tenantId = this.tenantId();
        const customer = await client_1.prisma.customer.findFirst({ where: { id: opts.customerId, tenantId } });
        if (!customer) {
            throw new httpErrors_1.HttpError({
                status: 400,
                code: httpErrors_1.ErrorCodes.BAD_REQUEST,
                message: "Cliente invalido",
            });
        }
        if (opts.idempotencyKey) {
            const duplicate = await client_1.prisma.customerLedger.findFirst({ where: { idempotencyKey: opts.idempotencyKey } });
            if (duplicate) {
                return duplicate;
            }
        }
        return client_1.prisma.customerLedger.create({
            data: {
                tenantId,
                customerId: opts.customerId,
                type: "PAYMENT",
                amount: opts.amount,
                method: opts.method,
                description: opts.description ?? null,
                paidAt: new Date(),
                idempotencyKey: opts.idempotencyKey ?? null,
                createdBy: opts.createdBy ?? null,
            },
        });
    }
    async statement(customerId, from, to) {
        const tenantId = this.tenantId();
        const items = await client_1.prisma.customerLedger.findMany({
            where: {
                tenantId,
                customerId,
                createdAt: {
                    gte: from ?? undefined,
                    lte: to ?? undefined,
                },
            },
            orderBy: { createdAt: "asc" },
        });
        const balance = await this.balance(customerId);
        return { items, balance };
    }
}
exports.LedgerService = LedgerService;
//# sourceMappingURL=ledger.service.js.map