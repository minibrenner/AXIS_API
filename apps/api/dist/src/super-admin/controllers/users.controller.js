"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTenantUser = createTenantUser;
const client_1 = require("@prisma/client");
const argon2_1 = __importDefault(require("argon2"));
const client_2 = require("../../prisma/client");
const httpErrors_1 = require("../../utils/httpErrors");
const tenants_controller_1 = require("./tenants.controller");
const sanitizeRole = (role) => {
    if (!role) {
        return "ADMIN";
    }
    if (role === "ADMIN" || role === "OWNER") {
        return role;
    }
    return "ADMIN";
};
function formatTarget(target) {
    if (Array.isArray(target)) {
        return target.join(",");
    }
    if (typeof target === "string") {
        return target;
    }
    return undefined;
}
async function createTenantUser(req, res) {
    const { tenantIdentifier, email, password, name, role, pinSupervisor } = req.body;
    if (!tenantIdentifier || !email || !password) {
        return (0, httpErrors_1.respondWithError)(res, {
            status: 400,
            code: httpErrors_1.ErrorCodes.BAD_REQUEST,
            message: "Campos tenantIdentifier, email e password sao obrigatorios.",
        });
    }
    const candidates = (0, tenants_controller_1.buildTenantWhereCandidates)(tenantIdentifier);
    let tenantId;
    for (const where of candidates) {
        const tenant = await client_2.prisma.tenant.findUnique({ where, select: { id: true } });
        if (tenant) {
            tenantId = tenant.id;
            break;
        }
    }
    if (!tenantId) {
        return (0, httpErrors_1.respondWithError)(res, {
            status: 404,
            code: httpErrors_1.ErrorCodes.TENANT_NOT_FOUND,
            message: "Tenant nao encontrado.",
            details: { tenantIdentifier },
        });
    }
    try {
        const passwordHash = await argon2_1.default.hash(password);
        const supervisorPin = pinSupervisor && pinSupervisor.trim().length > 0 ? await argon2_1.default.hash(pinSupervisor.trim()) : undefined;
        const user = await client_2.prisma.user.create({
            data: {
                tenantId,
                email,
                passwordHash,
                name,
                role: sanitizeRole(role),
                isActive: true,
                mustChangePassword: false,
                ...(supervisorPin ? { pinSupervisor: supervisorPin } : {}),
            },
            select: {
                id: true,
                tenantId: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
        });
        return res.status(201).json(user);
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return (0, httpErrors_1.respondWithError)(res, {
                status: 409,
                code: httpErrors_1.ErrorCodes.USER_CONFLICT,
                message: "Email ja utilizado neste tenant.",
                details: { target: formatTarget(error.meta?.target) },
            });
        }
        return (0, httpErrors_1.respondWithError)(res, {
            status: 500,
            code: httpErrors_1.ErrorCodes.INTERNAL,
            message: "Falha ao criar usuario.",
        });
    }
}
//# sourceMappingURL=users.controller.js.map