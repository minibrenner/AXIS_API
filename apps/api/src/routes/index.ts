// apps/api/src/routes/index.ts
import { Router } from "express";

import tenantRouter from "../modules/tenant/routes";
import adminRouter from "../modules/admin/routes";
import { authRouter } from "../auth/routes";
import { tenantMiddleware } from "../tenancy/tenant.middleware";
import { jwtAuth, requireRole } from "../auth/middleware";
import { categoriesRouter } from "../categories/routes";
import { productsRouter } from "../products/rotes";
import stockRouter from "../stock/routes";
import salesRouter from "../sales/routes";
import fiscalRouter from "../fiscal/routes";
import { cashRouter } from "../cash/routes";
import { syncRouter } from "../sync/routes";

/**
 * Router raiz da API. Centraliza o registro de todos os sub-routers.
 */
const router = Router();

/**
 * Rotas públicas de autenticação: /api/auth/...
 */
router.use("/auth", authRouter);

/**
 * Rotas multi-tenant (/api/t/:tenantId/...).
 * tenantMiddleware descobre o tenant atual e os módulos internos cuidam da autenticação/roles.
 */
router.use("/t/:tenantId", tenantMiddleware, tenantRouter);

/**
 * Rotas administrativas globais com RBAC.
 */
router.use("/admin", jwtAuth(false), requireRole("ADMIN", "OWNER"), adminRouter);

/**
 * Rotas autenticadas que utilizam o tenant do token (painel principal).
 */
const secureRoutes: Array<[string, Router]> = [
  ["/categories", categoriesRouter],
  ["/products", productsRouter],
  ["/stock", stockRouter],
  ["/sales", salesRouter],
  ["/fiscal", fiscalRouter],
  ["/cash", cashRouter],
  ["/sync", syncRouter],
];

for (const [prefix, childRouter] of secureRoutes) {
  router.use(prefix, jwtAuth(false), tenantMiddleware, childRouter);
}

export default router;
