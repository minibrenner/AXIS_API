import { type NextFunction, type Request, type Response } from "express";
import { HttpError, ErrorCodes } from "../utils/httpErrors";
import { verifySuperAdminToken } from "../super-admin/auth.service";

function getBearer(req: Request) {
  const header = req.header("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }
  return header.slice(7);
}

export function superAdminGuard(req: Request, _res: Response, next: NextFunction) {
  const token = getBearer(req);

  if (!token) {
    return next(
      new HttpError({
        status: 401,
        code: ErrorCodes.UNAUTHENTICATED,
        message: "Token de super admin ausente.",
      })
    );
  }

  try {
    const payload = verifySuperAdminToken(token);
    req.superAdmin = { email: payload.email };
    return next();
  } catch (err) {
    return next(
      new HttpError({
        status: 401,
        code: ErrorCodes.UNAUTHENTICATED,
        message: "Token de super admin invalido.",
        details: { reason: err instanceof Error ? err.message : "unknown" },
      })
    );
  }
}
