import { prisma } from "../prisma/client";
import { TenantContext } from "../tenancy/tenant.context";
import { ErrorCodes, HttpError } from "../utils/httpErrors";
import type { CreateCustomerInput, UpdateCustomerInput } from "./dto";

type CustomerSearchFilter = {
  q?: string;
  active?: boolean;
};

export class CustomersService {
  private tenantId(): string {
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

  async create(dto: CreateCustomerInput) {
    const tenantId = this.tenantId();
    return prisma.customer.create({
      data: {
        tenantId,
        ...dto,
        creditLimit: dto.creditLimit ?? null,
      },
    });
  }

  async list(filters: CustomerSearchFilter = {}) {
    const tenantId = this.tenantId();
    return prisma.customer.findMany({
      where: {
        tenantId,
        isActive: filters.active ?? undefined,
        OR: filters.q
          ? [
              { name: { contains: filters.q, mode: "insensitive" } },
              { document: { contains: filters.q } },
            ]
          : undefined,
      },
      orderBy: { name: "asc" },
      take: 100,
    });
  }

  async get(id: string) {
    const tenantId = this.tenantId();
    const customer = await prisma.customer.findFirst({ where: { id, tenantId } });

    if (!customer) {
      throw new HttpError({
        status: 404,
        code: ErrorCodes.NOT_FOUND,
        message: "Cliente nao encontrado",
      });
    }

    return customer;
  }

  async update(id: string, dto: UpdateCustomerInput) {
    await this.get(id);
    return prisma.customer.update({
      where: { id },
      data: {
        ...dto,
        creditLimit: dto.creditLimit ?? undefined,
      },
    });
  }
}
