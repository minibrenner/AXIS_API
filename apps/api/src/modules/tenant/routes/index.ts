import { Router } from "express";
import { createUser, listUsers } from "../controllers/users.controller";

/**
 * Router especifico para funcionalidades do tenant.
 * Aqui ficam apenas declaracoes de rotas; a logica vive nos controllers.
 */
const tenantRouter = Router();

/**
 * POST /api/tenant/users -> cria um novo usuario vinculado ao tenant atual.
 */
tenantRouter.post("/users", createUser);

/**
 * GET /api/tenant/users -> lista usuarios do tenant atual em ordem recem-criada.
 */
tenantRouter.get("/users", listUsers);

export default tenantRouter;
