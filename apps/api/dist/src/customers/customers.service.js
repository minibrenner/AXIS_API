"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomersService = void 0;
const client_1 = require("../prisma/client");
const tenant_context_1 = require("../tenancy/tenant.context");
const httpErrors_1 = require("../utils/httpErrors");
class CustomersService {
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
    async create(dto) {
        const tenantId = this.tenantId();
        return client_1.prisma.customer.create({
            data: {
                tenantId,
                ...dto,
                creditLimit: dto.creditLimit ?? null,
            },
        });
    }
    async list(filters = {}) {
        const tenantId = this.tenantId();
        return client_1.prisma.customer.findMany({
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
    async get(id) {
        const tenantId = this.tenantId();
        const customer = await client_1.prisma.customer.findFirst({ where: { id, tenantId } });
        if (!customer) {
            throw new httpErrors_1.HttpError({
                status: 404,
                code: httpErrors_1.ErrorCodes.NOT_FOUND,
                message: "Cliente nao encontrado",
            });
        }
        return customer;
    }
    async update(id, dto) {
        await this.get(id);
        return client_1.prisma.customer.update({
            where: { id },
            data: {
                ...dto,
                creditLimit: dto.creditLimit ?? undefined,
            },
        });
    }
}
exports.CustomersService = CustomersService;
//# sourceMappingURL=customers.service.js.map