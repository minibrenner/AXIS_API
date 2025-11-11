"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Rotas multi-tenant relacionadas a usuarios. Aplica guardas de autenticacao e valida o corpo.
const express_1 = require("express");
const users_controller_1 = require("../controllers/users.controller");
const validateBody_1 = require("../../../middlewares/validateBody");
const user_schemas_1 = require("../validators/user.schemas");
const middleware_1 = require("../../../auth/middleware");
const bootstrapOwner_guard_1 = require("../middlewares/bootstrapOwner.guard");
// mergeParams permite acessar :tenantId definido no router pai (/t/:tenantId/...)
const tenantRouter = (0, express_1.Router)({ mergeParams: true });
const usersRouter = (0, express_1.Router)({ mergeParams: true });
// POST /api/t/:tenantId/users -> cria um novo usuario associado ao tenant atual.
// Permite bootstrap sem token APENAS quando nenhum usuario/owner existe no tenant.
usersRouter.post("/", bootstrapOwner_guard_1.bootstrapOwnerGuard, (0, validateBody_1.validateBody)(user_schemas_1.createUserSchema), users_controller_1.createUser);
// Demais operacoes exigem autenticacao e role de ADMIN ou OWNER.
usersRouter.use((0, middleware_1.jwtAuth)(true), (0, middleware_1.requireRole)("ADMIN", "OWNER"));
// GET /api/t/:tenantId/users -> lista todos os usuarios visiveis no tenant atual.
usersRouter.get("/", users_controller_1.listUsers);
// GET /api/t/:tenantId/users/:id -> busca dados de um usuario especifico do tenant.
usersRouter.get("/:id", users_controller_1.getUser);
// PUT /api/t/:tenantId/users/:id -> atualiza o usuario informado dentro do mesmo tenant.
usersRouter.put("/:id", (0, validateBody_1.validateBody)(user_schemas_1.updateUserSchema), users_controller_1.updateUser);
// DELETE /api/t/:tenantId/users/:id -> remove um usuario pertencente ao tenant atual.
usersRouter.delete("/:id", users_controller_1.deleteUser);
// Anexa as rotas de usuarios sob /users no contexto do tenant.
tenantRouter.use("/users", usersRouter);
exports.default = tenantRouter;
//# sourceMappingURL=index.js.map