import { Router } from "express";
import { z } from "zod";
import { withZod } from "../utils/zodMiddleware";
import { allowRoles } from "../security/rbac";
import { TenantContext } from "../tenancy/tenant.context";
import { comandasService } from "./service";
import {
  addComandaItemsSchema,
  createComandaSchema,
  listComandaQuerySchema,
  updateComandaSchema,
} from "./dto";

export const comandasRouter = Router();

const querySchema = listComandaQuerySchema;

comandasRouter.post(
  "/",
  allowRoles("ADMIN", "OWNER", "ATTENDANT"),
  withZod(createComandaSchema),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenantId;
      const created = await TenantContext.run(tenantId, () =>
        comandasService.create(req.body),
      );
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);

comandasRouter.get("/", async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const filters = querySchema.parse(req.query);
    const items = await TenantContext.run(tenantId, () =>
      comandasService.list(filters),
    );
    res.json(items);
  } catch (err) {
    next(err);
  }
});

comandasRouter.get("/:id", async (req, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const comanda = await TenantContext.run(tenantId, () =>
      comandasService.get(req.params.id),
    );
    res.json(comanda);
  } catch (err) {
    next(err);
  }
});

comandasRouter.patch(
  "/:id",
  allowRoles("ADMIN", "OWNER", "ATTENDANT"),
  withZod(updateComandaSchema),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenantId;
      const updated = await TenantContext.run(tenantId, () =>
        comandasService.update(req.params.id, req.body),
      );
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

comandasRouter.delete(
  "/:id",
  allowRoles("ADMIN", "OWNER"),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenantId;
      await TenantContext.run(tenantId, () =>
        comandasService.delete(req.params.id),
      );
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

comandasRouter.post(
  "/:id/items",
  allowRoles("ADMIN", "OWNER", "ATTENDANT"),
  withZod(addComandaItemsSchema),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenantId;
      const result = await TenantContext.run(tenantId, () =>
        comandasService.addItems(req.params.id, req.body, {
          userId: req.user!.userId,
          name: req.user!.name,
        }),
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);
