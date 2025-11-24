// apps/api/src/products/routes.ts
import { Router } from "express";
import { withZod } from "../utils/zodMiddleware";
import { uploadSingleImage } from "../middlewares/uploadImage";
import {
  deleteImageFromStorage,
  ensurePlaceholderImage,
  processAndUploadImage,
} from "../utils/imageStorage";
import { createProductSchema, updateProductSchema } from "./dto";
import {
  listProducts,
  createProduct,
  updateProduct,
  softDeleteProduct,
  getProduct,
} from "./service";
import { TenantContext } from "../tenancy/tenant.context";

export const productsRouter = Router();

productsRouter.get("/", async (req, res, next) => {
  const tenantId = req.user!.tenantId;
  const q = (req.query.q as string | undefined) ?? undefined;

  try {
    const products = await TenantContext.run(tenantId, async () =>
      listProducts(tenantId, q),
    );
    res.json(products);
  } catch (err) {
    next(err);
  }
});

productsRouter.get("/:id", async (req, res, next) => {
  const tenantId = req.user!.tenantId;

  try {
    const product = await TenantContext.run(tenantId, async () =>
      getProduct(tenantId, req.params.id),
    );

    if (!product) {
      return res.status(404).json({ error: "Produto nao encontrado" });
    }

    res.json(product);
  } catch (err) {
    next(err);
  }
});

productsRouter.post(
  "/",
  uploadSingleImage("image"),
  withZod(createProductSchema),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenantId;

      await TenantContext.run(tenantId, async () => {
        const created = await createProduct(tenantId, req.body);

        if (req.file) {
          try {
            const imagePath = await processAndUploadImage(
              "product",
              tenantId,
              created.id,
              req.file,
            );

            const updated = await updateProduct(tenantId, created.id, {
              ...req.body,
              imagePath,
            });

            return res.status(201).json(updated);
          } catch (err) {
            await softDeleteProduct(tenantId, created.id);
            throw err;
          }
        } else {
          // Nenhuma imagem enviada (ou formato incompatível) -> usar placeholder genérico
          const placeholderPath = await ensurePlaceholderImage("product");

          const updated = await updateProduct(tenantId, created.id, {
            ...req.body,
            imagePath: placeholderPath,
          });

          return res.status(201).json(updated);
        }
      });
    } catch (err) {
      next(err);
    }
  },
);

productsRouter.patch(
  "/:id",
  uploadSingleImage("image"),
  withZod(updateProductSchema),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenantId;
      const id = req.params.id;

      await TenantContext.run(tenantId, async () => {
        const existing = await getProduct(tenantId, id);

        if (!existing) {
          res.status(404).json({ error: "Produto nao encontrado" });
          return;
        }

        let newImagePath = existing.imagePath ?? null;

        if (req.file) {
          const uploadedPath = await processAndUploadImage(
            "product",
            tenantId,
            existing.id,
            req.file,
          );
          newImagePath = uploadedPath;
        }

        const updated = await updateProduct(tenantId, id, {
          ...req.body,
          imagePath: newImagePath ?? undefined,
        });

        if (
          req.file &&
          existing.imagePath &&
          existing.imagePath !== newImagePath
        ) {
          await deleteImageFromStorage(existing.imagePath);
        }

        res.json(updated);
      });
    } catch (err) {
      next(err);
    }
  },
);

productsRouter.patch("/:id/active", async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = req.params.id;
    const body = (req.body ?? {}) as { active?: unknown };

    if (typeof body.active !== "boolean") {
      return res.status(400).json({ error: "Campo 'active' deve ser booleano." });
    }

    const active = body.active;

    await TenantContext.run(tenantId, async () => {
      const existing = await getProduct(tenantId, id);

      if (!existing) {
        res.status(404).json({ error: "Produto nao encontrado" });
        return;
      }

      const updated = await updateProduct(tenantId, id, { isActive: active });

      res.json(updated);
    });
  } catch (err) {
    next(err);
  }
});

productsRouter.delete("/:id", async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = req.params.id;

    await TenantContext.run(tenantId, async () => {
      const existing = await getProduct(tenantId, id);

      if (!existing) {
        res.status(404).json({ error: "Produto nao encontrado" });
        return;
      }

      await softDeleteProduct(tenantId, id);

      if (existing.imagePath) {
        await deleteImageFromStorage(existing.imagePath);
      }

      res.status(204).end();
    });
  } catch (err) {
    next(err);
  }
});
