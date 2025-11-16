"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const superAdmin_guard_1 = require("../security/superAdmin.guard");
const validateBody_1 = require("../middlewares/validateBody");
const tenants_controller_1 = require("./controllers/tenants.controller");
const tenant_schemas_1 = require("../modules/admin/validators/tenant.schemas");
const user_schemas_1 = require("./validators/user.schemas");
const users_controller_1 = require("./controllers/users.controller");
const superAdminRouter = (0, express_1.Router)();
superAdminRouter.get("/tenants", superAdmin_guard_1.superAdminGuard, tenants_controller_1.listTenants);
superAdminRouter.get("/tenants/:identifier", superAdmin_guard_1.superAdminGuard, tenants_controller_1.getTenant);
superAdminRouter.post("/tenants", superAdmin_guard_1.superAdminGuard, (0, validateBody_1.validateBody)(tenant_schemas_1.createTenantSchema), tenants_controller_1.createTenant);
superAdminRouter.put("/tenants/:identifier", superAdmin_guard_1.superAdminGuard, (0, validateBody_1.validateBody)(tenant_schemas_1.updateTenantSchema), tenants_controller_1.updateTenant);
superAdminRouter.delete("/tenants/:identifier", superAdmin_guard_1.superAdminGuard, tenants_controller_1.deleteTenant);
superAdminRouter.post("/tenants/:identifier/users", superAdmin_guard_1.superAdminGuard, (req, _res, next) => {
    req.body.tenantIdentifier = req.params.identifier;
    next();
}, (0, validateBody_1.validateBody)(user_schemas_1.createTenantUserSchema), users_controller_1.createTenantUser);
exports.default = superAdminRouter;
//# sourceMappingURL=routes.js.map