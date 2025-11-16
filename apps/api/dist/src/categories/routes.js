"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoriesRouter = void 0;
// apps/api/src/categories/routes.ts (resumo)
const express_1 = require("express");
const client_1 = require("../prisma/client");
exports.categoriesRouter = (0, express_1.Router)();
exports.categoriesRouter.post("/", async (req, res) => {
    const created = await client_1.prisma.category.create({ data: { tenantId: req.user.tenantId, name: req.body.name } });
    res.status(201).json(created);
});
exports.categoriesRouter.get("/", async (req, res) => {
    const list = await client_1.prisma.category.findMany({ where: { tenantId: req.user.tenantId }, orderBy: { name: "asc" } });
    res.json(list);
});
exports.categoriesRouter.put("/:id", async (req, res) => {
    const updated = await client_1.prisma.category.updateMany({
        where: { id: req.params.id, tenantId: req.user.tenantId },
        data: { name: req.body.name },
    });
    if (updated.count === 0) {
        return res.status(404).json({ message: "Category not found" });
    }
    res.json(updated);
});
exports.categoriesRouter.delete("/:id", async (req, res) => {
    const deleted = await client_1.prisma.category.deleteMany({
        where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (deleted.count === 0) {
        return res.status(404).json({ message: "Category not found" });
    }
    res.json(deleted);
});
//# sourceMappingURL=routes.js.map