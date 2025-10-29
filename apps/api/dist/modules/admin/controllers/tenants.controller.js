"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTenant = exports.getTenant = exports.listTenants = exports.deleteTenant = exports.createTenant = void 0;
const client_1 = require("@prisma/client");
const client_2 = require("../../../prisma/client");
/**
 * Controller responsavel por lidar com operacoes administrativas de tenants.
 * A criacao de tenants acontece fora do fluxo multi-tenant, portanto estes
 * handlers nao dependem do tenantMiddleware.
 */
const createTenant = async (req, res) => {
    /**
     * Campos minimos para criar um tenant. Esses valores chegam via JSON no corpo da requisicao.
     */
    const { name, email, cnpj, cpfResLoja } = req.body ?? {};
    if (!name || !email) {
        return res
            .status(400)
            .json({ error: "Informe pelo menos os campos name e email para criar um tenant." });
    }
    try {
        const tenant = await client_2.prisma.tenant.create({
            data: { name, email, cnpj, cpfResLoja },
        });
        return res.status(201).json(tenant);
    }
    catch (error) {
        console.error("Falha ao criar tenant:", error);
    }
    return res.status(500).json({ error: "Falha ao criar tenant por conta do servidor." });
};
exports.createTenant = createTenant;
/**
 * Converte o identificador recebido em rota (id ou cnpj) para o formato aceito
 * pelo Prisma. CNPJs sao detectados quando contem 14 digitos (ignorando
 * caracteres especiais). Caso contrario assumimos que se trata do ID (cuid).
 */
const resolveTenantUniqueWhere = (identifier) => {
    const digitsOnly = identifier.replace(/\D/g, "");
    if (digitsOnly.length === 14) {
        return { cnpj: digitsOnly };
    }
    return { id: identifier };
};
const deleteTenant = async (req, res) => {
    const { identifier } = req.params;
    try {
        await client_2.prisma.tenant.delete({
            where: resolveTenantUniqueWhere(identifier),
        });
        return res.status(204).send();
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return res.status(404).json({ error: "Tenant nao encontrado." });
        }
        console.error("Falha ao deletar tenant:", error);
        return res.status(500).json({ error: "Falha ao deletar tenant." });
    }
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
        const tenant = await client_2.prisma.tenant.findUnique({
            where: resolveTenantUniqueWhere(identifier),
        });
        if (!tenant) {
            return res.status(404).json({ error: "Tenant nao encontrado." });
        }
        return res.json(tenant);
    }
    catch (error) {
        console.error("Falha ao obter tenant:", error);
        return res.status(500).json({ error: "Falha ao obter tenant." });
    }
};
exports.getTenant = getTenant;
const updateTenant = async (req, res) => {
    const { identifier } = req.params;
    const { name, email, cnpj, cpfResLoja, isActive } = req.body;
    try {
        const tenant = await client_2.prisma.tenant.update({
            where: resolveTenantUniqueWhere(identifier),
            // Campos "undefined" são ignorados pelo Prisma; só atualiza o que vier
            data: { name, email, cnpj, cpfResLoja, isActive },
        });
        return res.json(tenant);
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            // P2025 = registro não encontrado
            if (error.code === "P2025") {
                return res.status(404).json({ error: "Tenant nao encontrado." });
            }
            // P2002 = violação de unique (email/cnpj/cpfResLoja duplicado)
            if (error.code === "P2002") {
                return res.status(409).json({
                    error: `Conflito de unicidade no(s) campo(s): ${error.meta?.target?.join(", ")}`,
                });
            }
        }
        console.error("Falha ao atualizar tenant:", error);
        return res.status(500).json({ error: "Falha ao atualizar tenant." });
    }
};
exports.updateTenant = updateTenant;
exports.default = { createTenant: exports.createTenant, deleteTenant: exports.deleteTenant, listTenants: exports.listTenants, getTenant: exports.getTenant, updateTenant: exports.updateTenant };
//# sourceMappingURL=tenants.controller.js.map