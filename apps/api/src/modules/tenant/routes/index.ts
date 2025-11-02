// Rotas multi-tenant relacionadas a usuarios. Aplica guardas de autenticacao e valida o corpo.
import { Router } from "express";
import {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  updateUser,
} from "../controllers/users.controller";
import { validateBody } from "../../../middlewares/validateBody";
import { createUserSchema, updateUserSchema } from "../validators/user.schemas";
import { jwtAuth, requireRole } from "../../../auth/middleware";
import { bootstrapOwnerGuard } from "../middlewares/bootstrapOwner.guard";

// mergeParams permite acessar :tenantId definido no router pai (/t/:tenantId/...)
const tenantRouter = Router({ mergeParams: true });
const usersRouter = Router({ mergeParams: true });

// POST /api/t/:tenantId/users -> cria um novo usuario associado ao tenant atual.
// Permite bootstrap sem token APENAS quando nenhum usuario/owner existe no tenant.
usersRouter.post("/", bootstrapOwnerGuard, validateBody(createUserSchema), createUser);

// Demais operacoes exigem autenticacao e role de ADMIN ou OWNER.
usersRouter.use(jwtAuth(true), requireRole("ADMIN", "OWNER"));

// GET /api/t/:tenantId/users -> lista todos os usuarios visiveis no tenant atual.
usersRouter.get("/", listUsers);

// GET /api/t/:tenantId/users/:id -> busca dados de um usuario especifico do tenant.
usersRouter.get("/:id", getUser);

// PUT /api/t/:tenantId/users/:id -> atualiza o usuario informado dentro do mesmo tenant.
usersRouter.put("/:id", validateBody(updateUserSchema), updateUser);

// DELETE /api/t/:tenantId/users/:id -> remove um usuario pertencente ao tenant atual.
usersRouter.delete("/:id", deleteUser);

// Anexa as rotas de usuarios sob /users no contexto do tenant.
tenantRouter.use("/users", usersRouter);

export default tenantRouter;
