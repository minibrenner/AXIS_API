"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtAuth = jwtAuth;
exports.requireRole = requireRole;
const jwt_1 = require("./jwt");
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
            return res.status(401).json({ error: "Token ausente" });
        }
        try {
            const payload = (0, jwt_1.verifyAccess)(token); // decodifica e valida assinatura/expiracao
            if (!isAuthRole(payload.role)) {
                return res.status(403).json({ error: "Role invalida no token" });
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
                    return res.status(400).json({ error: "Tenant nao resolvido no contexto" });
                }
                // Evita que um token de outro tenant seja aceito na rota atual.
                if (req.tenantId !== payload.tid) {
                    return res.status(403).json({ error: "Tenant do token nao corresponde ao tenant da rota" });
                }
            }
            return next(); // requisicao autenticada com sucesso
        }
        catch {
            return res.status(401).json({ error: "Token invalido" });
        }
    };
}
// Guard de autorizacao que limita o acesso a determinadas roles.
function requireRole(...roles) {
    const allowed = new Set(roles); // conjunto de roles autorizadas para o handler
    return (req, res, next) => {
        const userRole = req.user?.role; // role proveniente do token ja validado
        if (!userRole) {
            return res.status(403).json({ error: "Acesso negado" });
        }
        if (!allowed.has(userRole)) {
            return res.status(403).json({ error: "Acesso negado" });
        }
        return next(); // role autorizada, libera o fluxo para o handler seguinte
    };
}
//# sourceMappingURL=middleware.js.map