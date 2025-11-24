"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoriesRouter = void 0;
// apps/api/src/categories/routes.ts
const express_1 = require("express");
const client_1 = require("../prisma/client");
const uploadImage_1 = require("../middlewares/uploadImage");
const imageStorage_1 = require("../utils/imageStorage");
const tenant_context_1 = require("../tenancy/tenant.context");
exports.categoriesRouter = (0, express_1.Router)();
exports.categoriesRouter.post("/", (0, uploadImage_1.uploadSingleImage)("image"), async (req, res, next) => {
    const tenantId = req.user.tenantId;
    try {
        await tenant_context_1.TenantContext.run(tenantId, async () => {
            const name = String(req.body.name ?? "").trim();
            if (!name) {
                res.status(400).json({ error: "Nome da categoria é obrigatório." });
                return;
            }
            const created = await client_1.prisma.category.create({ data: { tenantId, name } });
            if (req.file) {
                try {
                    const imagePath = await (0, imageStorage_1.processAndUploadImage)("category", tenantId, created.id, req.file);
                    const updated = await client_1.prisma.category.update({
                        where: { id: created.id },
                        data: { imagePath },
                    });
                    res.status(201).json(updated);
                }
                catch (err) {
                    await client_1.prisma.category.delete({ where: { id: created.id } });
                    throw err;
                }
            }
            else {
                // Nenhuma imagem enviada (ou formato incompatível) -> usar placeholder genérico
                const placeholderPath = await (0, imageStorage_1.ensurePlaceholderImage)("category");
                const updated = await client_1.prisma.category.update({
                    where: { id: created.id },
                    data: { imagePath: placeholderPath },
                });
                res.status(201).json(updated);
            }
        });
    }
    catch (err) {
        next(err);
    }
});
exports.categoriesRouter.get("/", async (req, res, next) => {
    const tenantId = req.user.tenantId;
    try {
        const list = await tenant_context_1.TenantContext.run(tenantId, async () => client_1.prisma.category.findMany({
            where: { tenantId },
            orderBy: { name: "asc" },
        }));
        res.json(list);
    }
    catch (err) {
        next(err);
    }
});
exports.categoriesRouter.put("/:id", (0, uploadImage_1.uploadSingleImage)("image"), async (req, res, next) => {
    const tenantId = req.user.tenantId;
    const id = req.params.id;
    try {
        await tenant_context_1.TenantContext.run(tenantId, async () => {
            const existing = await client_1.prisma.category.findFirst({
                where: { id, tenantId },
            });
            if (!existing) {
                res.status(404).json({ message: "Category not found" });
                return;
            }
            const name = req.body.name ? String(req.body.name).trim() : existing.name;
            let newImagePath = existing.imagePath ?? null;
            if (req.file) {
                const uploadedPath = await (0, imageStorage_1.processAndUploadImage)("category", tenantId, existing.id, req.file);
                newImagePath = uploadedPath;
            }
            const updated = await client_1.prisma.category.update({
                where: { id: existing.id },
                data: { name, imagePath: newImagePath },
            });
            if (req.file && existing.imagePath && existing.imagePath !== newImagePath) {
                await (0, imageStorage_1.deleteImageFromStorage)(existing.imagePath);
            }
            res.json(updated);
        });
    }
    catch (err) {
        next(err);
    }
});
exports.categoriesRouter.delete("/:id", async (req, res, next) => {
    const tenantId = req.user.tenantId;
    const id = req.params.id;
    try {
        await tenant_context_1.TenantContext.run(tenantId, async () => {
            const existing = await client_1.prisma.category.findFirst({
                where: { id, tenantId },
            });
            if (!existing) {
                res.status(404).json({ message: "Category not found" });
                return;
            }
            await client_1.prisma.category.delete({
                where: { id: existing.id },
            });
            if (existing.imagePath) {
                await (0, imageStorage_1.deleteImageFromStorage)(existing.imagePath);
            }
            res.status(204).end();
        });
    }
    catch (err) {
        next(err);
    }
});
//# sourceMappingURL=routes.js.map