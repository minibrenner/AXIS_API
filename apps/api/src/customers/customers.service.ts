import { prisma } from "../prisma/client";
import { TenantContext } from "../tenancy/tenant.context";
import { ErrorCodes, HttpError } from "../utils/httpErrors";
import type { CreateCustomerInput, UpdateCustomerInput } from "./dto";
import { cacheGet, cacheInvalidatePrefix, cacheSet } from "../redis/cache";

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
    const created = await prisma.customer.create({
      data: {
        tenantId,
        ...dto,
        creditLimit: dto.creditLimit ?? null,
      },
    });
    await cacheInvalidatePrefix(this.cachePrefix(tenantId));
    return created;
  }

  async list(filters: CustomerSearchFilter = {}) {
    const tenantId = this.tenantId();
    const cacheKey = `${this.cachePrefix(tenantId)}:list:${filters.q ?? "all"}:${String(filters.active ?? "any")}`;
    const cached = await cacheGet<unknown[]>(cacheKey);
    if (cached) return cached as unknown[];

    const data = await prisma.customer.findMany({
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
    await cacheSet(cacheKey, data, 300);
    return data;
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
    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...dto,
        creditLimit: dto.creditLimit ?? undefined,
      },
    });
    await cacheInvalidatePrefix(this.cachePrefix());
    return updated;
  }

  async delete(id: string) {
    await this.get(id);
    const deleted = await prisma.customer.delete({ where: { id } });
    await cacheInvalidatePrefix(this.cachePrefix());
    return deleted;
  }

  private cachePrefix(tenantId?: string) {
    return `tenant:${tenantId ?? this.tenantId()}:customers`;
  }
}
