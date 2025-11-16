"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productsRouter = void 0;
// apps/api/src/products/routes.ts
const express_1 = require("express");
const zodMiddleware_1 = require("../utils/zodMiddleware");
const dto_1 = require("./dto");
const service_1 = require("./service");
exports.productsRouter = (0, express_1.Router)();
exports.productsRouter.get("/", async (req, res) => {
    const q = req.query.q ?? undefined;
    const products = await (0, service_1.listProducts)(req.user.tenantId, q);
    res.json(products);
});
exports.productsRouter.get("/:id", async (req, res) => {
    const product = await (0, service_1.getProduct)(req.user.tenantId, req.params.id);
    if (!product)
        return res.status(404).json({ error: "Produto não encontrado" });
    res.json(product);
});
exports.productsRouter.post("/", (0, zodMiddleware_1.withZod)(dto_1.createProductSchema), async (req, res) => {
    const created = await (0, service_1.createProduct)(req.user.tenantId, req.body);
    res.status(201).json(created);
});
exports.productsRouter.patch("/:id", (0, zodMiddleware_1.withZod)(dto_1.updateProductSchema), async (req, res) => {
    const updated = await (0, service_1.updateProduct)(req.user.tenantId, req.params.id, req.body);
    res.json(updated);
});
exports.productsRouter.delete("/:id", async (req, res) => {
    await (0, service_1.softDeleteProduct)(req.user.tenantId, req.params.id);
    res.status(204).end();
});
//# sourceMappingURL=rotes.js.map