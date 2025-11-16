import { Router } from "express";
import { superAdminGuard } from "../security/superAdmin.guard";
import { validateBody } from "../middlewares/validateBody";
import { createTenant, updateTenant, deleteTenant, listTenants, getTenant } from "./controllers/tenants.controller";
import { createTenantSchema, updateTenantSchema } from "../modules/admin/validators/tenant.schemas";
import { createTenantUserSchema } from "./validators/user.schemas";
import { createTenantUser } from "./controllers/users.controller";
import { loginSuperAdmin } from "./controllers/auth.controller";
import { superAdminLoginSchema } from "./validators/auth.schemas";

const superAdminRouter = Router();

superAdminRouter.post("/login", validateBody(superAdminLoginSchema), loginSuperAdmin);

superAdminRouter.use(superAdminGuard);

superAdminRouter.get("/tenants", listTenants);
superAdminRouter.get("/tenants/:identifier", getTenant);
superAdminRouter.post("/tenants", validateBody(createTenantSchema), createTenant);
superAdminRouter.put("/tenants/:identifier", validateBody(updateTenantSchema), updateTenant);
superAdminRouter.delete("/tenants/:identifier", deleteTenant);
superAdminRouter.post("/tenants/:identifier/users", (req, _res, next) => {
  req.body.tenantIdentifier = req.params.identifier;
  next();
}, validateBody(createTenantUserSchema), createTenantUser);

export default superAdminRouter;
