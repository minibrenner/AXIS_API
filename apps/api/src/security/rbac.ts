import { Request, Response, NextFunction } from "express";
import { ErrorCodes, respondWithError } from "../utils/httpErrors";

type AuthRole = "ADMIN" | "ATTENDANT" | "OWNER";

/**
 * Middleware genérico de RBAC que garante que o usuário autenticado possui uma das roles informadas.
 */
export function allowRoles(...roles: AuthRole[]) {
  const allowed = new Set<AuthRole>(roles);

  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role;

    if (!role || !allowed.has(role)) {
      return respondWithError(res, {
        status: 403,
        code: ErrorCodes.FORBIDDEN,
        message: "Acesso negado.",
        details: { requiredRoles: Array.from(allowed) },
      });
    }

    return next();
  };
}
