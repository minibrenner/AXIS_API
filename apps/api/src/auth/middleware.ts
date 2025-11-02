// apps/api/src/auth/middleware.ts
// Middleware de autenticacao JWT + guard de RBAC baseado em roles.
// Valida tokens, injeta dados do usuario na request e bloqueia acesso de roles nao autorizadas.
import { Request, Response, NextFunction } from "express";
import { verifyAccess } from "./jwt";
import { ErrorCodes, respondWithError } from "../utils/httpErrors";
import { allowRoles } from "../security/rbac";

// Enum textual das roles aceitas pela aplicacao.
type AuthRole = "ADMIN" | "ATTENDANT" | "OWNER";

// Garante que a claim `role` recebida pertence ao conjunto suportado.
function isAuthRole(value: string): value is AuthRole {
  return value === "ADMIN" || value === "ATTENDANT" || value === "OWNER";
}

// Extrai o token Bearer do cabecalho Authorization e remove o prefixo padrao.
function getBearer(req: Request) {
  const header = req.header("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }
  return header.slice(7);
}

// Middleware principal: valida o token, injeta req.user e opcionalmente verifica o tenant.
export function jwtAuth(requireTenantMatch = true) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = getBearer(req); // token bruto vindo do header
    if (!token) {
      return respondWithError(res, {
        status: 401,
        code: ErrorCodes.TOKEN_MISSING,
        message: "Token ausente.",
      });
    }

    try {
      const payload = verifyAccess(token); // decodifica e valida assinatura/expiracao

      if (!isAuthRole(payload.role)) {
        return respondWithError(res, {
          status: 403,
          code: ErrorCodes.FORBIDDEN,
          message: "Role invalida no token.",
        });
      }

      // Popula o usuario autenticado para uso posterior nas rotas protegidas.
      req.user = {
        userId: payload.sub,
        tenantId: payload.tid,
        role: payload.role,
        type: "access",
      };

      if (requireTenantMatch) {
        // Middleware de tenant deve ter preenchido req.tenantId previamente.
        if (!req.tenantId) {
          return respondWithError(res, {
            status: 400,
            code: ErrorCodes.TENANT_NOT_RESOLVED,
            message: "Tenant nao resolvido no contexto.",
          });
        }
        // Evita que um token de outro tenant seja aceito na rota atual.
        if (req.tenantId !== payload.tid) {
          return respondWithError(res, {
            status: 403,
            code: ErrorCodes.FORBIDDEN,
            message: "Tenant do token nao corresponde ao tenant da rota.",
          });
        }
      }

      return next(); // requisicao autenticada com sucesso
    } catch {
      return respondWithError(res, {
        status: 401,
        code: ErrorCodes.TOKEN_INVALID,
        message: "Token invalido.",
      });
    }
  };
}

// Guard de autorizacao que limita o acesso a determinadas roles.
export function requireRole(...roles: AuthRole[]) {
  return allowRoles(...roles);
}
