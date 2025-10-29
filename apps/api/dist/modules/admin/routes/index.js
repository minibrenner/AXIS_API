"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tenants_controller_1 = require("../controllers/tenants.controller");
/**
 * Router responsavel por endpoints administrativos.
 * Aqui ficam rotas que nao dependem de um tenant ja existente.
 */
const adminRouter = (0, express_1.Router)();
// POST /api/admin/tenants -> cria um novo tenant na plataforma
adminRouter.post("/tenants", tenants_controller_1.createTenant);
// DELETE /api/admin/tenants/:identifier -> remove um tenant via ID ou CNPJ
adminRouter.delete("/tenants/:identifier", tenants_controller_1.deleteTenant);
// GET /api/admin/tenants -> lista todos os tenants cadastrados
adminRouter.get("/tenants", tenants_controller_1.listTenants);
// GET /api/admin/tenants/:identifier -> consulta tenant pelo ID ou CNPJ
adminRouter.get("/tenants/:identifier", tenants_controller_1.getTenant);
// PUT /api/admin/tenants/:id -> atualiza os dados de um tenant (via ID)
adminRouter.put("/tenants/:identifier", tenants_controller_1.updateTenant);
exports.default = adminRouter;
//# sourceMappingURL=index.js.map