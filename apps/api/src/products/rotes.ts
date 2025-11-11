// apps/api/src/products/routes.ts
import { Router } from "express";
import { jwtAuth } from "../auth/middleware";
import { withZod } from "../utils/zodMiddleware";
import { createProductSchema, updateProductSchema } from "./dto";
import { listProducts, createProduct, updateProduct, softDeleteProduct, getProduct } from "./service";

export const productsRouter = Router();

productsRouter.use(jwtAuth());

productsRouter.get("/", async (req, res) => {
  const q = (req.query.q as string | undefined) ?? undefined;
  const products = await listProducts(req.user!.tenantId, q);
  res.json(products);
});

productsRouter.get("/:id", async (req, res) => {
  const product = await getProduct(req.user!.tenantId, req.params.id);
  if (!product) return res.status(404).json({ error: "Produto não encontrado" });
  res.json(product);
});

productsRouter.post("/", withZod(createProductSchema), async (req, res) => {
  const created = await createProduct(req.user!.tenantId, req.body);
  res.status(201).json(created);
});

productsRouter.patch("/:id", withZod(updateProductSchema), async (req, res) => {
  const updated = await updateProduct(req.user!.tenantId, req.params.id, req.body);
  res.json(updated);
});

productsRouter.delete("/:id", async (req, res) => {
  await softDeleteProduct(req.user!.tenantId, req.params.id);
  res.status(204).end();
});
