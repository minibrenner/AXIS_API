"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUser = exports.getUser = exports.listUsers = exports.createUser = void 0;
// apps/api/src/modules/tenant/controllers/users.controller.ts
// Controlador do CRUD de usuarios por tenant. Cada handler reforca o isolamento entre tenants,
// usa argon2 para hashing de senha e responde apenas com campos seguros.
const client_1 = require("@prisma/client");
const argon2_1 = __importDefault(require("argon2"));
const client_2 = require("../../../prisma/client");
const httpErrors_1 = require("../../../utils/httpErrors");
/** Campos autorizados a sair na camada HTTP (passwordHash jamais e exposto). */
const userSelectSafe = {
    id: true,
    tenantId: true,
    email: true,
    name: true,
    role: true,
    isActive: true,
    mustChangePassword: true,
    createdAt: true,
    updatedAt: true,
    passwordUpdatedAt: true,
    pinSupervisor: true,
};
const toHttpUser = (user) => {
    if (!user) {
        return null;
    }
    const { pinSupervisor, ...rest } = user;
    return { ...rest, hasSupervisorPin: Boolean(pinSupervisor) };
};
async function normalizeSupervisorPin(input) {
    if (input === undefined) {
        return undefined;
    }
    if (input === null) {
        return null;
    }
    const trimmed = input.trim();
    if (!trimmed) {
        return null;
    }
    return argon2_1.default.hash(trimmed);
}
const ALLOWED_ROLES = new Set(["ADMIN", "ATTENDANT", "OWNER"]);
/** Normaliza qualquer role vinda do body para um valor aceito pelo enum da aplicacao. */
function normalizeRole(role) {
    const normalized = String(role ?? "").trim().toUpperCase();
    return ALLOWED_ROLES.has(normalized) ? normalized : "ATTENDANT";
}
/** Identifica erros conhecidos do Prisma (unicidade, etc.) para respostas amigaveis. */
function isPrismaKnownError(error) {
    return error instanceof client_1.Prisma.PrismaClientKnownRequestError;
}
/** Padroniza os logs de erro emitidos pelo controller. */
function toLog(error) {
    const output = {};
    if (error instanceof Error) {
        output.name = error.name;
        output.message = error.message;
        output.stack = error.stack;
    }
    if (typeof error === "object" && error !== null) {
        const record = error;
        if (record.code)
            output.code = record.code;
        if (record.meta)
            output.meta = record.meta;
    }
    return output;
}
/** Interrompe o fluxo caso o tenantId nao esteja presente no contexto. */
function requireTenantId(req, res) {
    const tenantId = req.tenantId;
    if (!tenantId) {
        (0, httpErrors_1.respondWithError)(res, {
            status: 400,
            code: httpErrors_1.ErrorCodes.TENANT_NOT_RESOLVED,
            message: "Tenant nao identificado no contexto da requisicao.",
        });
        return undefined;
    }
    return tenantId;
}
/**
 * POST /users - cria um usuario no tenant atual e armazena apenas o hash do refresh.
 */
const createUser = async (req, res) => {
    const tenantId = requireTenantId(req, res);
    if (!tenantId)
        return;
    const { email, password, name, role, isActive, mustChangePassword, pinSupervisor } = req.body;
    const isBootstrap = req.isBootstrapOwnerCreation === true;
    try {
        const passwordHash = await argon2_1.default.hash(password);
        const normalizedRole = normalizeRole(isBootstrap ? "OWNER" : role);
        const activeFlag = isBootstrap ? true : isActive ?? true;
        const mustChangePasswordFlag = isBootstrap ? false : mustChangePassword ?? false;
        const supervisorPin = await normalizeSupervisorPin(pinSupervisor);
        const user = await client_2.prisma.user.create({
            data: {
                tenantId,
                email,
                passwordHash,
                name,
                role: normalizedRole,
                isActive: activeFlag,
                mustChangePassword: mustChangePasswordFlag,
                ...(supervisorPin !== undefined ? { pinSupervisor: supervisorPin } : {}),
            },
            select: userSelectSafe,
        });
        if (isBootstrap && user.role === "OWNER") {
            await client_2.prisma.tenant
                .update({
                where: { id: tenantId },
                data: { ownerUserId: user.id },
            })
                .catch((error) => {
                console.error("Falha ao vincular owner ao tenant:", toLog(error));
            });
        }
        return res.status(201).json(toHttpUser(user));
    }
    catch (error) {
        console.error("Falha ao criar usuario [details]:", toLog(error));
        if (isPrismaKnownError(error) && error.code === "P2002") {
            const target = error.meta?.target?.join(", ");
            return (0, httpErrors_1.respondWithError)(res, {
                status: 409,
                code: httpErrors_1.ErrorCodes.USER_CONFLICT,
                message: "Ja existe um usuario com os dados fornecidos.",
                ...(target ? { details: { target } } : {}),
            });
        }
        return (0, httpErrors_1.respondWithError)(res, {
            status: 500,
            code: httpErrors_1.ErrorCodes.INTERNAL,
            message: "Falha ao criar usuario.",
        });
    }
};
exports.createUser = createUser;
/**
 * GET /users - lista usuarios do tenant com pagina simples (sem filtros adicionais).
 */
const listUsers = async (req, res) => {
    const tenantId = requireTenantId(req, res);
    if (!tenantId)
        return;
    const users = await client_2.prisma.user.findMany({
        where: { tenantId },
        select: userSelectSafe,
    });
    return res.json(users.map((user) => toHttpUser(user)));
};
exports.listUsers = listUsers;
/**
 * GET /users/:id - recupera apenas usuarios pertencentes ao tenant corrente.
 */
const getUser = async (req, res) => {
    const tenantId = requireTenantId(req, res);
    if (!tenantId)
        return;
    const { id } = req.params;
    const user = await client_2.prisma.user.findFirst({
        where: { id, tenantId },
        select: userSelectSafe,
    });
    if (!user) {
        return (0, httpErrors_1.respondWithError)(res, {
            status: 404,
            code: httpErrors_1.ErrorCodes.USER_NOT_FOUND,
            message: "Usuario nao encontrado.",
        });
    }
    return res.json(toHttpUser(user));
};
exports.getUser = getUser;
/**
 * PUT /users/:id - atualiza dados do usuario garantindo isolamento multi-tenant.
 * Se uma nova senha vier, o hash e atualizado e passwordUpdatedAt e avancado.
 */
const updateUser = async (req, res) => {
    const tenantId = requireTenantId(req, res);
    if (!tenantId)
        return;
    const { id } = req.params;
    const { email, password, name, role, isActive, mustChangePassword, pinSupervisor } = req.body;
    const data = {};
    if (email !== undefined)
        data.email = email;
    if (name !== undefined)
        data.name = name;
    if (role !== undefined)
        data.role = normalizeRole(role);
    if (isActive !== undefined)
        data.isActive = isActive;
    if (mustChangePassword !== undefined)
        data.mustChangePassword = mustChangePassword;
    if (password) {
        data.passwordHash = await argon2_1.default.hash(password);
        data.passwordUpdatedAt = new Date();
        if (mustChangePassword === undefined) {
            data.mustChangePassword = false;
        }
    }
    const supervisorPin = await normalizeSupervisorPin(pinSupervisor ?? undefined);
    if (supervisorPin !== undefined) {
        data.pinSupervisor = supervisorPin;
    }
    try {
        const result = await client_2.prisma.user.updateMany({
            where: { id, tenantId },
            data,
        });
        if (result.count === 0) {
            return (0, httpErrors_1.respondWithError)(res, {
                status: 404,
                code: httpErrors_1.ErrorCodes.USER_NOT_FOUND,
                message: "Usuario nao encontrado.",
            });
        }
        const updated = await client_2.prisma.user.findFirst({
            where: { id, tenantId },
            select: userSelectSafe,
        });
        return res.json(toHttpUser(updated));
    }
    catch (error) {
        console.error("Falha ao atualizar usuario [details]:", toLog(error));
        if (isPrismaKnownError(error) && error.code === "P2002") {
            const target = error.meta?.target?.join(", ");
            return (0, httpErrors_1.respondWithError)(res, {
                status: 409,
                code: httpErrors_1.ErrorCodes.USER_CONFLICT,
                message: "Ja existe um usuario com os dados fornecidos.",
                ...(target ? { details: { target } } : {}),
            });
        }
        return (0, httpErrors_1.respondWithError)(res, {
            status: 500,
            code: httpErrors_1.ErrorCodes.INTERNAL,
            message: "Falha ao atualizar usuario.",
        });
    }
};
exports.updateUser = updateUser;
/**
 * DELETE /users/:id - remove usuario do tenant sem afetar dados de outros tenants.
 */
const deleteUser = async (req, res) => {
    const tenantId = requireTenantId(req, res);
    if (!tenantId)
        return;
    const { id } = req.params;
    try {
        const result = await client_2.prisma.user.deleteMany({
            where: { id, tenantId },
        });
        if (result.count === 0) {
            return (0, httpErrors_1.respondWithError)(res, {
                status: 404,
                code: httpErrors_1.ErrorCodes.USER_NOT_FOUND,
                message: "Usuario nao encontrado.",
            });
        }
        return res.status(204).send();
    }
    catch (error) {
        console.error("Falha ao deletar usuario [details]:", toLog(error));
        return (0, httpErrors_1.respondWithError)(res, {
            status: 500,
            code: httpErrors_1.ErrorCodes.INTERNAL,
            message: "Falha ao deletar usuario.",
        });
    }
};
exports.deleteUser = deleteUser;
exports.default = { createUser: exports.createUser, listUsers: exports.listUsers, getUser: exports.getUser, updateUser: exports.updateUser, deleteUser: exports.deleteUser };
//# sourceMappingURL=users.controller.js.map