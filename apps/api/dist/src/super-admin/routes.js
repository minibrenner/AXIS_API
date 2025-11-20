"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const superAdmin_guard_1 = require("../security/superAdmin.guard");
const validateBody_1 = require("../middlewares/validateBody");
const tenants_controller_1 = require("./controllers/tenants.controller");
const tenant_schemas_1 = require("../modules/admin/validators/tenant.schemas");
const user_schemas_1 = require("./validators/user.schemas");
const users_controller_1 = require("./controllers/users.controller");
const auth_controller_1 = require("./controllers/auth.controller");
const auth_schemas_1 = require("./validators/auth.schemas");
const client_1 = require("../prisma/client");
async function getOverview(_req, res) {
    console.log("super-admin overview requested");
    const [totalLojasAtivas, totalLojasDesativadas, totalUsuariosAtivos, totalUsuariosDesativados] = await Promise.all([
        client_1.basePrisma.tenant.count({ where: { isActive: true } }),
        client_1.basePrisma.tenant.count({ where: { isActive: false } }),
        client_1.basePrisma.user.count({ where: { isActive: true } }),
        client_1.basePrisma.user.count({ where: { isActive: false } }),
    ]);
    return res.json({
        totalLojasAtivas,
        totalUsuariosAtivos,
        totalLojasDesativadas,
        totalUsuariosDesativados,
    });
}
const superAdminRouter = (0, express_1.Router)();
superAdminRouter.post("/login", (0, validateBody_1.validateBody)(auth_schemas_1.superAdminLoginSchema), auth_controller_1.loginSuperAdmin);
superAdminRouter.use(superAdmin_guard_1.superAdminGuard);
superAdminRouter.get("/tenants", tenants_controller_1.listTenants);
superAdminRouter.get("/tenants/:identifier", tenants_controller_1.getTenant);
superAdminRouter.post("/tenants", (0, validateBody_1.validateBody)(tenant_schemas_1.createTenantSchema), tenants_controller_1.createTenant);
superAdminRouter.put("/tenants/:identifier", (0, validateBody_1.validateBody)(tenant_schemas_1.updateTenantSchema), tenants_controller_1.updateTenant);
superAdminRouter.delete("/tenants/:identifier", tenants_controller_1.deleteTenant);
superAdminRouter.post("/tenants/:identifier/users", (req, _res, next) => {
    req.body.tenantIdentifier = req.params.identifier;
    next();
}, (0, validateBody_1.validateBody)(user_schemas_1.createTenantUserSchema), users_controller_1.createTenantUser);
superAdminRouter.get("/overview", getOverview);
exports.default = superAdminRouter;
//# sourceMappingURL=routes.js.map