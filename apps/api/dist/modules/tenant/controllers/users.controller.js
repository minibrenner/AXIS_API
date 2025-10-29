"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUser = exports.getUser = exports.listUsers = exports.createUser = void 0;
const client_1 = require("../../../prisma/client");
/**
 * Cria um novo usuario associado ao tenant presente no contexto.
 */
const createUser = async (req, res) => {
    const { email, passwordHash, role = "ATTENDANT" } = req.body;
    // tenantMiddleware garante que `req.tenantId` esteja presente antes de chegar aqui.
    const tenantId = req.tenantId;
    const user = await client_1.prisma.user.create({
        data: { tenantId, email, passwordHash, role },
    });
    res.status(201).json(user);
};
exports.createUser = createUser;
/**
 * Lista os usuarios pertencentes ao tenant atual, ordenados por criacao.
 */
const listUsers = async (_req, res) => {
    // `prisma.user.findMany` ja aplica o filtro de tenant via withTenantExtension.
    const users = await client_1.prisma.user.findMany({ orderBy: { createdAt: "desc" } });
    res.json(users);
};
exports.listUsers = listUsers;
const getUser = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await client_1.prisma.user.findFirst({
            where: { id },
        });
        if (!user) {
            return res.status(404).json({ error: "Usuario nao encontrado." });
        }
        return res.json(user);
    }
    catch (error) {
        console.error("Falha ao obter usuario:", error);
        return res.status(500).json({ error: "Falha ao obter usuario." });
    }
};
exports.getUser = getUser;
const updateUser = async (req, res) => {
    const { id } = req.params;
    const { email, passwordHash, role } = req.body;
    try {
        const user = await client_1.prisma.user.update({
            where: { id },
            data: { email, passwordHash, role },
        });
        return res.json(user);
    }
    catch (error) {
        console.error("Falha ao atualizar usuario:", error);
        return res.status(500).json({ error: "Falha ao atualizar usuario." });
    }
};
exports.updateUser = updateUser;
const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        await client_1.prisma.user.delete({
            where: { id },
        });
        return res.status(204).send();
    }
    catch (error) {
        console.error("Falha ao deletar usuario:", error);
        return res.status(500).json({ error: "Falha ao deletar usuario." });
    }
};
exports.deleteUser = deleteUser;
//# sourceMappingURL=users.controller.js.map