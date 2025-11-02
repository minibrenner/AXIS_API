import { Request, Response, NextFunction } from "express";
import { TenantContext } from "./tenant.context";

/**
 * Middleware responsavel por descobrir o tenant atual e salva-lo em:
 * - `req.tenantId`, facilitando o uso nas rotas/controllers.
 * - `TenantContext`, que alimenta o middleware do Prisma.
 *
 * Ele procura o tenant em `req.user` (quando autenticacao estiver ativa) ou no
 * header `x-tenant-id` (util para ambientes de desenvolvimento e testes).
 */
export function tenantMiddleware(req: Request, _res: Response, next: NextFunction) {
  // Preferimos o tenant proveniente do usuario autenticado, caso o middleware de auth esteja ativo.
  const tenantFromUser = (req.user && (req.user.tid || req.user.tenantId)) as string | undefined;
  // Em ambientes de desenvolvimento/teste, permitimos informar o tenant diretamente no header.
  const tenantFromHeader = req.headers["x-tenant-id"] as string | undefined;
  // Como as rotas usam o padrao /t/:tenantId, usamos o parametro como ultimo recurso.
  const tenantFromParams = req.params?.tenantId as string | undefined;
  // Escolhemos o primeiro valor disponivel; se ambos existirem, o do usuario tem prioridade.
  const tenantId = tenantFromUser || tenantFromHeader || tenantFromParams;

  if (!tenantId) {
    return next(new Error("Tenant nao identificado"));
  }

  // Disponibiliza o tenant no objeto da request para que controllers possam reutilizar.
  req.tenantId = tenantId;
  // Mantem o tenant acessivel para camadas que nao recebem `req` (ex.: Prisma).
  TenantContext.run(tenantId, () => next());
}
