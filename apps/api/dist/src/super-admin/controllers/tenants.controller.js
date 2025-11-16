"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTenant = exports.getTenant = exports.listTenants = exports.deleteTenant = exports.createTenant = exports.buildTenantWhereCandidates = void 0;
exports.findTenantByIdentifier = findTenantByIdentifier;
// apps/api/src/super-admin/controllers/tenants.controller.ts
// CRUD administrativo exclusivo do super admin com checagens de unicidade e mensagens amigaveis.
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_2 = require("../../prisma/client");
const httpErrors_1 = require("../../utils/httpErrors");
function isPrismaKnownError(error) {
    return error instanceof client_1.Prisma.PrismaClientKnownRequestError;
}
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
function formatUniqueTarget(target) {
    if (!target)
        return "dados";
    if (Array.isArray(target))
        return target.join(", ");
    if (typeof target === "string") {
        const cleaned = target.replace(/[^A-Za-z0-9_,]+/g, " ").trim();
        return cleaned || "dados";
    }
    return "dados";
}
const buildTenantWhereCandidates = (identifier) => {
    const trimmed = identifier.trim();
    const digitsOnly = trimmed.replace(/\D/g, "");
    const candidates = [];
    if (digitsOnly.length === 14) {
        candidates.push({ cnpj: digitsOnly });
    }
    if (digitsOnly.length === 11) {
        candidates.push({ cpfResLoja: digitsOnly });
    }
    if (trimmed) {
        candidates.push({ id: trimmed });
        candidates.push({ name: trimmed });
    }
    const seen = new Set();
    return candidates.filter((candidate) => {
        const key = Object.entries(candidate)
            .map(([k, v]) => `${k}:${v}`)
            .join("-");
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
};
exports.buildTenantWhereCandidates = buildTenantWhereCandidates;
async function findTenantByIdentifier(identifier) {
    const candidates = (0, exports.buildTenantWhereCandidates)(identifier);
    for (const where of candidates) {
        const tenant = await client_2.prisma.tenant.findUnique({ where });
        if (tenant) {
            return tenant;
        }
    }
    return null;
}
const createTenant = async (req, res) => {
    const payload = (req.body ?? {});
    const { name, email, cnpj, cpfResLoja } = payload;
    const missingFields = [];
    if (!name)
        missingFields.push("name");
    if (!email)
        missingFields.push("email");
    if (missingFields.length) {
        return (0, httpErrors_1.respondWithError)(res, {
            status: 400,
            code: httpErrors_1.ErrorCodes.BAD_REQUEST,
            message: "Informe os campos obrigatorios name e email para criar um tenant.",
            details: { missing: missingFields },
        });
    }
    const ensuredName = name;
    const ensuredEmail = email;
    try {
        const [emailExists, cnpjExists, nameExists, cpfExists] = await Promise.all([
            client_2.prisma.tenant.findUnique({ where: { email: ensuredEmail } }),
            cnpj ? client_2.prisma.tenant.findUnique({ where: { cnpj } }) : Promise.resolve(null),
            client_2.prisma.tenant.findUnique({ where: { name: ensuredName } }),
            cpfResLoja ? client_2.prisma.tenant.findUnique({ where: { cpfResLoja } }) : Promise.resolve(null),
        ]);
        if (emailExists) {
            return (0, httpErrors_1.respondWithError)(res, {
                status: 409,
                code: httpErrors_1.ErrorCodes.TENANT_CONFLICT,
                message: "Email ja cadastrado.",
                details: { field: "email" },
            });
        }
        if (cnpj && cnpjExists) {
            return (0, httpErrors_1.respondWithError)(res, {
                status: 409,
                code: httpErrors_1.ErrorCodes.TENANT_CONFLICT,
                message: "CNPJ ja cadastrado.",
                details: { field: "cnpj" },
            });
        }
        if (nameExists) {
            return (0, httpErrors_1.respondWithError)(res, {
                status: 409,
                code: httpErrors_1.ErrorCodes.TENANT_CONFLICT,
                message: "Nome ja cadastrado.",
                details: { field: "name" },
            });
        }
        if (cpfResLoja && cpfExists) {
            return (0, httpErrors_1.respondWithError)(res, {
                status: 409,
                code: httpErrors_1.ErrorCodes.TENANT_CONFLICT,
                message: "CPF do responsavel da loja ja cadastrado.",
                details: { field: "cpfResLoja" },
            });
        }
        const tenant = await client_2.prisma.tenant.create({
            data: { name: ensuredName, email: ensuredEmail, cnpj, cpfResLoja },
        });
        return res.status(201).json(tenant);
    }
    catch (error) {
        console.error("Falha ao criar tenant [details]:", toLog(error));
        if (isPrismaKnownError(error) && error.code === "P2002") {
            const target = formatUniqueTarget(error.meta?.target);
            return (0, httpErrors_1.respondWithError)(res, {
                status: 409,
                code: httpErrors_1.ErrorCodes.TENANT_CONFLICT,
                message: "Ja existe um tenant com os dados fornecidos.",
                ...(target ? { details: { target } } : {}),
            });
        }
        return (0, httpErrors_1.respondWithError)(res, {
            status: 500,
            code: httpErrors_1.ErrorCodes.INTERNAL,
            message: "Falha ao criar tenant por conta do servidor.",
        });
    }
};
exports.createTenant = createTenant;
const deleteTenant = async (req, res) => {
    const { identifier } = req.params;
    const candidates = (0, exports.buildTenantWhereCandidates)(identifier);
    for (const where of candidates) {
        try {
            await client_2.prisma.tenant.delete({ where });
            return res.status(204).send();
        }
        catch (error) {
            if (isPrismaKnownError(error) && error.code === "P2025") {
                continue;
            }
            console.error("Falha ao deletar tenant:", toLog(error));
            return (0, httpErrors_1.respondWithError)(res, {
                status: 500,
                code: httpErrors_1.ErrorCodes.INTERNAL,
                message: "Falha ao deletar tenant.",
            });
        }
    }
    return (0, httpErrors_1.respondWithError)(res, {
        status: 404,
        code: httpErrors_1.ErrorCodes.TENANT_NOT_FOUND,
        message: "Tenant nao encontrado.",
        details: { identifier },
    });
};
exports.deleteTenant = deleteTenant;
const listTenants = async (_req, res) => {
    const tenants = await client_2.prisma.tenant.findMany();
    res.json(tenants);
};
exports.listTenants = listTenants;
const getTenant = async (req, res) => {
    const { identifier } = req.params;
    try {
        const tenant = await findTenantByIdentifier(identifier);
        if (!tenant) {
            return (0, httpErrors_1.respondWithError)(res, {
                status: 404,
                code: httpErrors_1.ErrorCodes.TENANT_NOT_FOUND,
                message: "Tenant nao encontrado.",
                details: { identifier },
            });
        }
        return res.json(tenant);
    }
    catch (error) {
        console.error("Falha ao obter tenant:", toLog(error));
        return (0, httpErrors_1.respondWithError)(res, {
            status: 500,
            code: httpErrors_1.ErrorCodes.INTERNAL,
            message: "Falha ao obter tenant.",
        });
    }
};
exports.getTenant = getTenant;
const updateTenant = async (req, res) => {
    const { identifier } = req.params;
    const { name, email, cnpj, cpfResLoja, isActive, password } = req.body ?? {};
    const data = {};
    if (name !== undefined)
        data.name = name;
    if (email !== undefined)
        data.email = email;
    if (cnpj !== undefined)
        data.cnpj = cnpj;
    if (cpfResLoja !== undefined)
        data.cpfResLoja = cpfResLoja;
    if (isActive !== undefined)
        data.isActive = isActive;
    if (password) {
        data.passwordHash = await bcryptjs_1.default.hash(password, 10);
        data.mustChangePassword = true;
    }
    const candidates = (0, exports.buildTenantWhereCandidates)(identifier);
    const updatePayload = data;
    for (const where of candidates) {
        try {
            const tenant = await client_2.prisma.tenant.update({
                where,
                data: updatePayload,
            });
            return res.json(tenant);
        }
        catch (error) {
            if (isPrismaKnownError(error)) {
                if (error.code === "P2025") {
                    continue;
                }
                if (error.code === "P2002") {
                    const target = formatUniqueTarget(error.meta?.target);
                    return (0, httpErrors_1.respondWithError)(res, {
                        status: 409,
                        code: httpErrors_1.ErrorCodes.TENANT_CONFLICT,
                        message: "Ja existe um tenant com os dados fornecidos.",
                        ...(target ? { details: { target } } : {}),
                    });
                }
            }
            console.error("Falha ao atualizar tenant:", toLog(error));
            return (0, httpErrors_1.respondWithError)(res, {
                status: 500,
                code: httpErrors_1.ErrorCodes.INTERNAL,
                message: "Falha ao atualizar tenant.",
            });
        }
    }
    return (0, httpErrors_1.respondWithError)(res, {
        status: 404,
        code: httpErrors_1.ErrorCodes.TENANT_NOT_FOUND,
        message: "Tenant nao encontrado.",
        details: { identifier },
    });
};
exports.updateTenant = updateTenant;
exports.default = { createTenant: exports.createTenant, deleteTenant: exports.deleteTenant, listTenants: exports.listTenants, getTenant: exports.getTenant, updateTenant: exports.updateTenant };
//# sourceMappingURL=tenants.controller.js.map