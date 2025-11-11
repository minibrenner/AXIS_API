"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtAuth = jwtAuth;
exports.requireRole = requireRole;
const jwt_1 = require("./jwt");
const httpErrors_1 = require("../utils/httpErrors");
const rbac_1 = require("../security/rbac");
// Garante que a claim `role` recebida pertence ao conjunto suportado.
function isAuthRole(value) {
    return value === "ADMIN" || value === "ATTENDANT" || value === "OWNER";
}
// Extrai o token Bearer do cabecalho Authorization e remove o prefixo padrao.
function getBearer(req) {
    const header = req.header("authorization");
    if (!header || !header.startsWith("Bearer ")) {
        return null;
    }
    return header.slice(7);
}
// Middleware principal: valida o token, injeta req.user e opcionalmente verifica o tenant.
function jwtAuth(requireTenantMatch = true) {
    return (req, res, next) => {
        const token = getBearer(req); // token bruto vindo do header
        if (!token) {
            return (0, httpErrors_1.respondWithError)(res, {
                status: 401,
                code: httpErrors_1.ErrorCodes.TOKEN_MISSING,
                message: "Token ausente.",
            });
        }
        try {
            const payload = (0, jwt_1.verifyAccess)(token); // decodifica e valida assinatura/expiracao
            if (!isAuthRole(payload.role)) {
                return (0, httpErrors_1.respondWithError)(res, {
                    status: 403,
                    code: httpErrors_1.ErrorCodes.FORBIDDEN,
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
                    return (0, httpErrors_1.respondWithError)(res, {
                        status: 400,
                        code: httpErrors_1.ErrorCodes.TENANT_NOT_RESOLVED,
                        message: "Tenant nao resolvido no contexto.",
                    });
                }
                // Evita que um token de outro tenant seja aceito na rota atual.
                if (req.tenantId !== payload.tid) {
                    return (0, httpErrors_1.respondWithError)(res, {
                        status: 403,
                        code: httpErrors_1.ErrorCodes.FORBIDDEN,
                        message: "Tenant do token nao corresponde ao tenant da rota.",
                    });
                }
            }
            return next(); // requisicao autenticada com sucesso
        }
        catch {
            return (0, httpErrors_1.respondWithError)(res, {
                status: 401,
                code: httpErrors_1.ErrorCodes.TOKEN_INVALID,
                message: "Token invalido.",
            });
        }
    };
}
// Guard de autorizacao que limita o acesso a determinadas roles.
function requireRole(...roles) {
    return (0, rbac_1.allowRoles)(...roles);
}
//# sourceMappingURL=middleware.js.map