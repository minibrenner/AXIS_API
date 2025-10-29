import { Router } from "express";
import tenantRouter from "../modules/tenant/routes";
import adminRouter from "../modules/admin/routes"; // confirme o caminho


/**
 * Router raiz da API. Este arquivo concentra a uniao de todos os sub-routers
 * da aplicacao para que o servidor (`server.ts`) tenha um unico ponto de importacao.
 */
const router = Router();

/**
 * Agrupa rotas relacionadas a tenants sob o prefixo `/tenant`.
 * Resultado final: endpoints expostos como `/api/tenant/...`.
 */
router.use("/tenant", tenantRouter);
router.use("/admin", adminRouter);   // expõe /api/admin/...

export default router;
