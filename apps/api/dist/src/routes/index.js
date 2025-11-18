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
const routes_4 = require("../categories/routes");
const rotes_1 = require("../products/rotes");
const routes_5 = __importDefault(require("../stock/routes"));
const routes_6 = __importDefault(require("../sales/routes"));
const routes_7 = __importDefault(require("../fiscal/routes"));
const routes_8 = require("../cash/routes");
const routes_9 = require("../sync/routes");
const customers_routes_1 = require("../customers/customers.routes");
const ledger_routes_1 = require("../customers/ledger.routes");
const statement_pdf_routes_1 = require("../customers/statement.pdf.routes");
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
/**
 * Rotas autenticadas que utilizam o tenant do token (painel principal).
 */
const secureRoutes = [
    ["/categories", routes_4.categoriesRouter],
    ["/products", rotes_1.productsRouter],
    ["/stock", routes_5.default],
    ["/sales", routes_6.default],
    ["/fiscal", routes_7.default],
    ["/cash", routes_8.cashRouter],
    ["/sync", routes_9.syncRouter],
    ["/customers", customers_routes_1.customersRouter],
    ["/customers", ledger_routes_1.ledgerRouter],
    ["/customers", statement_pdf_routes_1.statementPdfRouter],
];
for (const [prefix, childRouter] of secureRoutes) {
    router.use(prefix, (0, middleware_1.jwtAuth)(false), tenant_middleware_1.tenantMiddleware, childRouter);
}
exports.default = router;
//# sourceMappingURL=index.js.map