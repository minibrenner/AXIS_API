import { Request, Response, NextFunction } from "express";
import { TenantContext } from "./tenant.context";

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      user?: any;
    }
  }
}

export function tenantMiddleware(req: Request, _res: Response, next: NextFunction) {
  const tenantFromUser = (req.user && (req.user.tid || req.user.tenantId)) as string | undefined;
  const tenantFromHeader = req.headers["x-tenant-id"] as string | undefined;
  const tenantId = tenantFromUser || tenantFromHeader;
  if (!tenantId) return next(new Error("Tenant não identificado"));

  req.tenantId = tenantId;
  TenantContext.run(tenantId, () => next());
}
export {};
