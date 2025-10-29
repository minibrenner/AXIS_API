"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const users_controller_1 = require("../controllers/users.controller");
/**
 * Router especifico para funcionalidades do tenant.
 * Aqui ficam apenas declaracoes de rotas; a logica vive nos controllers.
 */
const tenantRouter = (0, express_1.Router)();
/**
 * POST /api/tenant/users -> cria um novo usuario vinculado ao tenant atual.
 */
tenantRouter.post("/users", users_controller_1.createUser);
/**
 * GET /api/tenant/users -> lista usuarios do tenant atual em ordem recem-criada.
 */
tenantRouter.get("/users", users_controller_1.listUsers);
tenantRouter.get("/users/:id", users_controller_1.getUser);
tenantRouter.put("/users/:id", users_controller_1.updateUser);
tenantRouter.delete("/users/:id", users_controller_1.deleteUser);
exports.default = tenantRouter;
//# sourceMappingURL=index.js.map