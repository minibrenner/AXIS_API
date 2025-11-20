import { Router, type Request, type Response } from "express";
import { superAdminGuard } from "../security/superAdmin.guard";
import { validateBody } from "../middlewares/validateBody";
import { createTenant, updateTenant, deleteTenant, listTenants, getTenant } from "./controllers/tenants.controller";
import { createTenantSchema, updateTenantSchema } from "../modules/admin/validators/tenant.schemas";
import { createTenantUserSchema } from "./validators/user.schemas";
import { createTenantUser } from "./controllers/users.controller";
import { loginSuperAdmin } from "./controllers/auth.controller";
import { superAdminLoginSchema } from "./validators/auth.schemas";
import { basePrisma } from "../prisma/client";

async function getOverview(_req: Request, res: Response) {
  console.log("super-admin overview requested");
  const [totalLojasAtivas, totalLojasDesativadas, totalUsuariosAtivos, totalUsuariosDesativados] =
    await Promise.all([
      basePrisma.tenant.count({ where: { isActive: true } }),
      basePrisma.tenant.count({ where: { isActive: false } }),
      basePrisma.user.count({ where: { isActive: true } }),
      basePrisma.user.count({ where: { isActive: false } }),
    ]);

  return res.json({
    totalLojasAtivas,
    totalUsuariosAtivos,
    totalLojasDesativadas,
    totalUsuariosDesativados,
  });
}

const superAdminRouter = Router();

superAdminRouter.post("/login", validateBody(superAdminLoginSchema), loginSuperAdmin);

superAdminRouter.use(superAdminGuard);

superAdminRouter.get("/tenants", listTenants);
superAdminRouter.get("/tenants/:identifier", getTenant);
superAdminRouter.post("/tenants", validateBody(createTenantSchema), createTenant);
// Aceita tanto PUT quanto PATCH para atualiza��o parcial de tenants
superAdminRouter.put("/tenants/:identifier", validateBody(updateTenantSchema), updateTenant);
superAdminRouter.patch("/tenants/:identifier", validateBody(updateTenantSchema), updateTenant);
superAdminRouter.delete("/tenants/:identifier", deleteTenant);
superAdminRouter.post("/tenants/:identifier/users", (req, _res, next) => {
  req.body.tenantIdentifier = req.params.identifier;
  next();
}, validateBody(createTenantUserSchema), createTenantUser);

superAdminRouter.get("/overview", getOverview);

export default superAdminRouter;
