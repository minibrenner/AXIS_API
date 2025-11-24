// apps/api/src/categories/routes.ts
import { Router } from "express";
import { prisma } from "../prisma/client";
import { uploadSingleImage } from "../middlewares/uploadImage";
import {
  deleteImageFromStorage,
  ensurePlaceholderImage,
  processAndUploadImage,
} from "../utils/imageStorage";
import { TenantContext } from "../tenancy/tenant.context";

export const categoriesRouter = Router();

categoriesRouter.post("/", uploadSingleImage("image"), async (req, res, next) => {
  const tenantId = req.user!.tenantId;

  try {
    await TenantContext.run(tenantId, async () => {
      const name = String(req.body.name ?? "").trim();

      if (!name) {
        res.status(400).json({ error: "Nome da categoria é obrigatório." });
        return;
      }

      const created = await prisma.category.create({ data: { tenantId, name } });

      if (req.file) {
        try {
          const imagePath = await processAndUploadImage("category", tenantId, created.id, req.file);
          const updated = await prisma.category.update({
            where: { id: created.id },
            data: { imagePath },
          });
          res.status(201).json(updated);
        } catch (err) {
          await prisma.category.delete({ where: { id: created.id } });
          throw err;
        }
      } else {
        // Nenhuma imagem enviada (ou formato incompatível) -> usar placeholder genérico
        const placeholderPath = await ensurePlaceholderImage("category");
        const updated = await prisma.category.update({
          where: { id: created.id },
          data: { imagePath: placeholderPath },
        });
        res.status(201).json(updated);
      }
    });
  } catch (err) {
    next(err);
  }
});

categoriesRouter.get("/", async (req, res, next) => {
  const tenantId = req.user!.tenantId;

  try {
    const list = await TenantContext.run(tenantId, async () =>
      prisma.category.findMany({
        where: { tenantId },
        orderBy: { name: "asc" },
      }),
    );

    res.json(list);
  } catch (err) {
    next(err);
  }
});

categoriesRouter.put("/:id", uploadSingleImage("image"), async (req, res, next) => {
  const tenantId = req.user!.tenantId;
  const id = req.params.id;

  try {
    await TenantContext.run(tenantId, async () => {
      const existing = await prisma.category.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        res.status(404).json({ message: "Category not found" });
        return;
      }

      const name = req.body.name ? String(req.body.name).trim() : existing.name;

      let newImagePath = existing.imagePath ?? null;

      if (req.file) {
        const uploadedPath = await processAndUploadImage("category", tenantId, existing.id, req.file);
        newImagePath = uploadedPath;
      }

      const updated = await prisma.category.update({
        where: { id: existing.id },
        data: { name, imagePath: newImagePath },
      });

      if (req.file && existing.imagePath && existing.imagePath !== newImagePath) {
        await deleteImageFromStorage(existing.imagePath);
      }

      res.json(updated);
    });
  } catch (err) {
    next(err);
  }
});

categoriesRouter.delete("/:id", async (req, res, next) => {
  const tenantId = req.user!.tenantId;
  const id = req.params.id;

  try {
    await TenantContext.run(tenantId, async () => {
      const existing = await prisma.category.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        res.status(404).json({ message: "Category not found" });
        return;
      }

      await prisma.category.delete({
        where: { id: existing.id },
      });

      if (existing.imagePath) {
        await deleteImageFromStorage(existing.imagePath);
      }

      res.status(204).end();
    });
  } catch (err) {
    next(err);
  }
});

