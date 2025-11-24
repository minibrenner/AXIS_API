"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productsRouter = void 0;
// apps/api/src/products/routes.ts
const express_1 = require("express");
const zodMiddleware_1 = require("../utils/zodMiddleware");
const uploadImage_1 = require("../middlewares/uploadImage");
const imageStorage_1 = require("../utils/imageStorage");
const dto_1 = require("./dto");
const service_1 = require("./service");
const tenant_context_1 = require("../tenancy/tenant.context");
exports.productsRouter = (0, express_1.Router)();
exports.productsRouter.get("/", async (req, res, next) => {
    const tenantId = req.user.tenantId;
    const q = req.query.q ?? undefined;
    try {
        const products = await tenant_context_1.TenantContext.run(tenantId, async () => (0, service_1.listProducts)(tenantId, q));
        res.json(products);
    }
    catch (err) {
        next(err);
    }
});
exports.productsRouter.get("/:id", async (req, res, next) => {
    const tenantId = req.user.tenantId;
    try {
        const product = await tenant_context_1.TenantContext.run(tenantId, async () => (0, service_1.getProduct)(tenantId, req.params.id));
        if (!product) {
            return res.status(404).json({ error: "Produto nao encontrado" });
        }
        res.json(product);
    }
    catch (err) {
        next(err);
    }
});
exports.productsRouter.post("/", (0, uploadImage_1.uploadSingleImage)("image"), (0, zodMiddleware_1.withZod)(dto_1.createProductSchema), async (req, res, next) => {
    try {
        const tenantId = req.user.tenantId;
        await tenant_context_1.TenantContext.run(tenantId, async () => {
            const created = await (0, service_1.createProduct)(tenantId, req.body);
            if (req.file) {
                try {
                    const imagePath = await (0, imageStorage_1.processAndUploadImage)("product", tenantId, created.id, req.file);
                    const updated = await (0, service_1.updateProduct)(tenantId, created.id, {
                        ...req.body,
                        imagePath,
                    });
                    return res.status(201).json(updated);
                }
                catch (err) {
                    await (0, service_1.softDeleteProduct)(tenantId, created.id);
                    throw err;
                }
            }
            else {
                // Nenhuma imagem enviada (ou formato incompatível) -> usar placeholder genérico
                const placeholderPath = await (0, imageStorage_1.ensurePlaceholderImage)("product");
                const updated = await (0, service_1.updateProduct)(tenantId, created.id, {
                    ...req.body,
                    imagePath: placeholderPath,
                });
                return res.status(201).json(updated);
            }
        });
    }
    catch (err) {
        next(err);
    }
});
exports.productsRouter.patch("/:id", (0, uploadImage_1.uploadSingleImage)("image"), (0, zodMiddleware_1.withZod)(dto_1.updateProductSchema), async (req, res, next) => {
    try {
        const tenantId = req.user.tenantId;
        const id = req.params.id;
        await tenant_context_1.TenantContext.run(tenantId, async () => {
            const existing = await (0, service_1.getProduct)(tenantId, id);
            if (!existing) {
                res.status(404).json({ error: "Produto nao encontrado" });
                return;
            }
            let newImagePath = existing.imagePath ?? null;
            if (req.file) {
                const uploadedPath = await (0, imageStorage_1.processAndUploadImage)("product", tenantId, existing.id, req.file);
                newImagePath = uploadedPath;
            }
            const updated = await (0, service_1.updateProduct)(tenantId, id, {
                ...req.body,
                imagePath: newImagePath ?? undefined,
            });
            if (req.file &&
                existing.imagePath &&
                existing.imagePath !== newImagePath) {
                await (0, imageStorage_1.deleteImageFromStorage)(existing.imagePath);
            }
            res.json(updated);
        });
    }
    catch (err) {
        next(err);
    }
});
exports.productsRouter.patch("/:id/active", async (req, res, next) => {
    try {
        const tenantId = req.user.tenantId;
        const id = req.params.id;
        const body = (req.body ?? {});
        if (typeof body.active !== "boolean") {
            return res.status(400).json({ error: "Campo 'active' deve ser booleano." });
        }
        const active = body.active;
        await tenant_context_1.TenantContext.run(tenantId, async () => {
            const existing = await (0, service_1.getProduct)(tenantId, id);
            if (!existing) {
                res.status(404).json({ error: "Produto nao encontrado" });
                return;
            }
            const updated = await (0, service_1.updateProduct)(tenantId, id, { isActive: active });
            res.json(updated);
        });
    }
    catch (err) {
        next(err);
    }
});
exports.productsRouter.delete("/:id", async (req, res, next) => {
    try {
        const tenantId = req.user.tenantId;
        const id = req.params.id;
        await tenant_context_1.TenantContext.run(tenantId, async () => {
            const existing = await (0, service_1.getProduct)(tenantId, id);
            if (!existing) {
                res.status(404).json({ error: "Produto nao encontrado" });
                return;
            }
            await (0, service_1.softDeleteProduct)(tenantId, id);
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
//# sourceMappingURL=rotes.js.map