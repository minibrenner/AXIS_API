// apps/api/src/categories/routes.ts (resumo)
import { Router } from "express";
import { prisma } from "../prisma/client";
import { jwtAuth } from "../auth/middleware";

export const categoriesRouter = Router();
categoriesRouter.use(jwtAuth);

categoriesRouter.post("/", async (req, res) => {
  const created = await prisma.category.create({ data: { tenantId: req.user!.tenantId, name: req.body.name } });
  res.status(201).json(created);
});

categoriesRouter.get("/", async (req, res) => {
  const list = await prisma.category.findMany({ where: { tenantId: req.user!.tenantId }, orderBy: { name: "asc" } });
  res.json(list);
});

categoriesRouter.put("/:id", async (req, res) => {
  const updated = await prisma.category.updateMany({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
    data: { name: req.body.name },
  });
  if (updated.count === 0) {
    return res.status(404).json({ message: "Category not found" });
  }
  res.json(updated);
});

categoriesRouter.delete("/:id", async (req, res) => {
  const deleted = await prisma.category.deleteMany({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
  }); 
  if (deleted.count === 0) {
    return res.status(404).json({ message: "Category not found" });
  }
  res.json(deleted);
});

