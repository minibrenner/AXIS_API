"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantMiddleware = tenantMiddleware;
const tenant_context_1 = require("./tenant.context");
const httpErrors_1 = require("../utils/httpErrors");
/**
 * Middleware responsavel por descobrir o tenant atual e salva-lo em:
 * - `req.tenantId`, facilitando o uso nas rotas/controllers.
 * - `TenantContext`, que alimenta o middleware do Prisma.
 *
 * Ele procura o tenant em `req.user` (quando autenticacao estiver ativa) ou no
 * header `x-tenant-id` (util para ambientes de desenvolvimento e testes).
 */
function tenantMiddleware(req, _res, next) {
    // Preferimos o tenant proveniente do usuario autenticado, caso o middleware de auth esteja ativo.
    const tenantFromUser = (req.user && (req.user.tid || req.user.tenantId));
    // Em ambientes de desenvolvimento/teste, permitimos informar o tenant diretamente no header.
    const tenantFromHeader = req.headers["x-tenant-id"];
    // Como as rotas usam o padrao /t/:tenantId, usamos o parametro como ultimo recurso.
    const tenantFromParams = req.params?.tenantId;
    // Escolhemos o primeiro valor disponivel; se ambos existirem, o do usuario tem prioridade.
    const tenantId = tenantFromUser || tenantFromHeader || tenantFromParams;
    if (!tenantId) {
        return next(new httpErrors_1.HttpError({
            status: 400,
            code: httpErrors_1.ErrorCodes.TENANT_NOT_RESOLVED,
            message: "Tenant nao identificado.",
        }));
    }
    // Disponibiliza o tenant no objeto da request para que controllers possam reutilizar.
    req.tenantId = tenantId;
    // Mantem o tenant acessivel para camadas que nao recebem `req` (ex.: Prisma).
    tenant_context_1.TenantContext.run(tenantId, () => next());
}
//# sourceMappingURL=tenant.middleware.js.map