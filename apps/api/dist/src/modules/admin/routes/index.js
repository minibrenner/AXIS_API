"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tenants_controller_1 = require("../controllers/tenants.controller");
const validateBody_1 = require("../../../middlewares/validateBody");
const tenant_schemas_1 = require("../validators/tenant.schemas");
/**
 * Router responsavel por endpoints administrativos.
 * Aqui ficam rotas que nao dependem de um tenant ja existente.
 */
const adminRouter = (0, express_1.Router)();
// POST /api/admin/tenants -> cria um novo tenant na plataforma
adminRouter.post("/tenants", (0, validateBody_1.validateBody)(tenant_schemas_1.createTenantSchema), tenants_controller_1.createTenant);
// DELETE /api/admin/tenants/:identifier -> remove um tenant via ID ou CNPJ
adminRouter.delete("/tenants/:identifier", tenants_controller_1.deleteTenant);
// GET /api/admin/tenants -> lista todos os tenants cadastrados
adminRouter.get("/tenants", tenants_controller_1.listTenants);
// GET /api/admin/tenants/:identifier -> consulta tenant pelo ID ou CNPJ
adminRouter.get("/tenants/:identifier", tenants_controller_1.getTenant);
// PUT /api/admin/tenants/:id -> atualiza os dados de um tenant (via ID)
adminRouter.put("/tenants/:identifier", (0, validateBody_1.validateBody)(tenant_schemas_1.updateTenantSchema), tenants_controller_1.updateTenant);
adminRouter.get("/__ping", (_req, res) => res.json({ ok: true, area: "admin" }));
exports.default = adminRouter;
//# sourceMappingURL=index.js.map