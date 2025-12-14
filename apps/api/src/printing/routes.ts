import { Router, type Request, type Response, type NextFunction } from "express";
import { withZod } from "../utils/zodMiddleware";
import { allowRoles } from "../security/rbac";
import { TenantContext } from "../tenancy/tenant.context";
import { HttpError, ErrorCodes } from "../utils/httpErrors";
import {
  createDeviceSchema,
  createLocationSchema,
  deleteLocationQuerySchema,
  listDevicesQuerySchema,
  listJobsQuerySchema,
  updateDeviceSchema,
  updateJobSchema,
  updateLocationSchema,
} from "./dto";
import { printingService } from "./service";

export const printingRouter = Router();

// Middleware opcional para worker local (token simples via header)
const printingTokenAuth = (req: Request, _res: Response, next: NextFunction) => {
  const expected = process.env.PRINTING_WORKER_TOKEN;
  const token = req.header("x-print-token");
  if (expected && token && token === expected) {
    const tenantId = req.header("x-tenant-id");
    if (!tenantId) {
      return next(
        new HttpError({
          status: 400,
          code: ErrorCodes.BAD_REQUEST,
          message: "Tenant ausente para o worker de impressao (header x-tenant-id).",
        }),
      );
    }
    // injeta um user tecnico com role ATTENDANT, suficiente para listar/atualizar jobs
    req.user = { tenantId, userId: "print-worker", role: "ATTENDANT" } as Request["user"];
  }
  next();
};

// ---- Locations ----
printingRouter.post(
  "/locations",
  printingTokenAuth,
  allowRoles("OWNER", "ADMIN"),
  withZod(createLocationSchema),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenantId;
      const created = await TenantContext.run(tenantId, () =>
        printingService.createLocation(req.body),
      );
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);

printingRouter.get(
  "/locations",
  printingTokenAuth,
  allowRoles("OWNER", "ADMIN", "ATTENDANT"),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenantId;
      const list = await TenantContext.run(tenantId, () =>
        printingService.listLocations(),
      );
      res.json(list);
    } catch (err) {
      next(err);
    }
  },
);

printingRouter.patch(
  "/locations/:id",
  printingTokenAuth,
  allowRoles("OWNER", "ADMIN"),
  withZod(updateLocationSchema),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenantId;
      const updated = await TenantContext.run(tenantId, () =>
        printingService.updateLocation(req.params.id, req.body),
      );
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

printingRouter.delete(
  "/locations/:id",
  printingTokenAuth,
  allowRoles("OWNER", "ADMIN"),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenantId;
      const query = deleteLocationQuerySchema.parse(req.query);
      await TenantContext.run(tenantId, () =>
        printingService.deleteLocation(req.params.id, query),
      );
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// ---- Devices ----
printingRouter.post(
  "/devices",
  printingTokenAuth,
  allowRoles("OWNER", "ADMIN"),
  withZod(createDeviceSchema),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenantId;
      const created = await TenantContext.run(tenantId, () =>
        printingService.createDevice(req.body),
      );
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);

printingRouter.get(
  "/devices",
  printingTokenAuth,
  allowRoles("OWNER", "ADMIN", "ATTENDANT"),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenantId;
      const query = listDevicesQuerySchema.parse(req.query);
      const list = await TenantContext.run(tenantId, () =>
        printingService.listDevices(query),
      );
      res.json(list);
    } catch (err) {
      next(err);
    }
  },
);

printingRouter.patch(
  "/devices/:id",
  printingTokenAuth,
  allowRoles("OWNER", "ADMIN"),
  withZod(updateDeviceSchema),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenantId;
      const updated = await TenantContext.run(tenantId, () =>
        printingService.updateDevice(req.params.id, req.body),
      );
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

printingRouter.delete(
  "/devices/:id",
  printingTokenAuth,
  allowRoles("OWNER", "ADMIN"),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenantId;
      await TenantContext.run(tenantId, () =>
        printingService.deleteDevice(req.params.id),
      );
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

printingRouter.post(
  "/devices/:id/test",
  printingTokenAuth,
  allowRoles("OWNER", "ADMIN"),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenantId;
      const job = await TenantContext.run(tenantId, () =>
        printingService.enqueueTestPrint(req.params.id),
      );
      res.status(201).json(job);
    } catch (err) {
      next(err);
    }
  },
);

// ---- Jobs ----
printingRouter.get(
  "/jobs",
  printingTokenAuth,
  allowRoles("OWNER", "ADMIN", "ATTENDANT"),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenantId;
      const query = listJobsQuerySchema.parse(req.query);
      const list = await TenantContext.run(tenantId, () =>
        printingService.listJobs(query),
      );
      res.json(list);
    } catch (err) {
      next(err);
    }
  },
);

printingRouter.patch(
  "/jobs/:id",
  printingTokenAuth,
  allowRoles("OWNER", "ADMIN", "ATTENDANT"),
  withZod(updateJobSchema),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenantId;
      const updated = await TenantContext.run(tenantId, () =>
        printingService.updateJob(req.params.id, req.body),
      );
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

printingRouter.post(
  "/jobs/reprint/:id",
  printingTokenAuth,
  allowRoles("OWNER", "ADMIN"),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenantId;
      const newJob = await TenantContext.run(tenantId, () =>
        printingService.reprintJob(req.params.id),
      );
      res.status(201).json(newJob);
    } catch (err) {
      next(err);
    }
  },
);
