import { prisma } from "../prisma/client";
import { TenantContext } from "../tenancy/tenant.context";
import { ErrorCodes, HttpError } from "../utils/httpErrors";

export class LedgerService {
  private tenantId() {
    const tenantId = TenantContext.get();
    if (!tenantId) {
      throw new HttpError({
        status: 400,
        code: ErrorCodes.BAD_REQUEST,
        message: "Tenant nao identificado",
      });
    }
    return tenantId;
  }

  private sumDecimal(value: { _sum: { amount: unknown } }) {
    return Number(value._sum.amount ?? 0);
  }

  async balance(customerId: string) {
    const tenantId = this.tenantId();
    const [charges, payments, adjusts] = await Promise.all([
      prisma.customerLedger.aggregate({ _sum: { amount: true }, where: { tenantId, customerId, type: "CHARGE" } }),
      prisma.customerLedger.aggregate({ _sum: { amount: true }, where: { tenantId, customerId, type: "PAYMENT" } }),
      prisma.customerLedger.aggregate({ _sum: { amount: true }, where: { tenantId, customerId, type: "ADJUST" } }),
    ]);

    return this.sumDecimal(charges) - this.sumDecimal(payments) - this.sumDecimal(adjusts);
  }

  async charge(opts: {
    customerId: string;
    amount: number;
    description?: string;
    saleId?: string;
    dueDate?: Date;
    idempotencyKey?: string;
    createdBy?: string;
  }) {
    const tenantId = this.tenantId();
    const customer = await prisma.customer.findFirst({ where: { id: opts.customerId, tenantId } });

    if (!customer) {
      throw new HttpError({
        status: 400,
        code: ErrorCodes.BAD_REQUEST,
        message: "Cliente invalido",
      });
    }

    if (!customer.allowCredit) {
      throw new HttpError({
        status: 403,
        code: ErrorCodes.FORBIDDEN,
        message: "Credito nao liberado para este cliente",
      });
    }

    if (opts.idempotencyKey) {
      const duplicate = await prisma.customerLedger.findFirst({ where: { idempotencyKey: opts.idempotencyKey } });
      if (duplicate) {
        return duplicate;
      }
    }

    const currentBalance = await this.balance(opts.customerId);
    const limit = customer.creditLimit != null ? Number(customer.creditLimit) : Number.POSITIVE_INFINITY;
    if (currentBalance + opts.amount > limit) {
      throw new HttpError({
        status: 403,
        code: ErrorCodes.FORBIDDEN,
        message: "Ultrapassa limite de credito",
      });
    }

    const dueDate = opts.dueDate ?? (customer.defaultDueDays ? new Date(Date.now() + customer.defaultDueDays * 86_400_000) : null);

    return prisma.customerLedger.create({
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

  async payment(opts: {
    customerId: string;
    amount: number;
    method: string;
    description?: string;
    idempotencyKey?: string;
    createdBy?: string;
  }) {
    const tenantId = this.tenantId();
    const customer = await prisma.customer.findFirst({ where: { id: opts.customerId, tenantId } });
    if (!customer) {
      throw new HttpError({
        status: 400,
        code: ErrorCodes.BAD_REQUEST,
        message: "Cliente invalido",
      });
    }

    if (opts.idempotencyKey) {
      const duplicate = await prisma.customerLedger.findFirst({ where: { idempotencyKey: opts.idempotencyKey } });
      if (duplicate) {
        return duplicate;
      }
    }

    return prisma.customerLedger.create({
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

  async statement(customerId: string, from?: Date, to?: Date) {
    const tenantId = this.tenantId();
    const items = await prisma.customerLedger.findMany({
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