"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// apps/api/src/routes/index.ts
const express_1 = require("express");
const routes_1 = __importDefault(require("../modules/tenant/routes"));
const routes_2 = __importDefault(require("../modules/admin/routes"));
const routes_3 = require("../auth/routes");
const tenant_middleware_1 = require("../tenancy/tenant.middleware");
const middleware_1 = require("../auth/middleware");
/**
 * Router raiz da API. Centraliza o registro de todos os sub-routers.
 */
const router = (0, express_1.Router)();
/**
 * Rotas públicas de autenticação: /api/auth/...
 */
router.use("/auth", routes_3.authRouter);
/**
 * Rotas multi-tenant (/api/t/:tenantId/...).
 * tenantMiddleware descobre o tenant atual e os módulos internos cuidam da autenticação/roles.
 */
router.use("/t/:tenantId", tenant_middleware_1.tenantMiddleware, routes_1.default);
/**
 * Rotas administrativas globais com RBAC.
 */
router.use("/admin", (0, middleware_1.jwtAuth)(false), (0, middleware_1.requireRole)("ADMIN", "OWNER"), routes_2.default);
exports.default = router;
//# sourceMappingURL=index.js.map