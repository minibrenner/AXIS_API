"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fiscalRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const rbac_1 = require("../security/rbac");
const service_1 = require("./service");
const listQuerySchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.FiscalStatus).optional(),
});
const resendSchema = zod_1.z.object({
    saleIds: zod_1.z.array(zod_1.z.string()).min(1),
});
exports.fiscalRouter = (0, express_1.Router)();
exports.fiscalRouter.get("/documents", (0, rbac_1.allowRoles)("ADMIN", "OWNER"), async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const items = await (0, service_1.listFiscalDocuments)(req.user.tenantId, query.status);
    res.json({ items });
});
exports.fiscalRouter.post("/documents/resend", (0, rbac_1.allowRoles)("ADMIN", "OWNER"), async (req, res) => {
    const body = resendSchema.parse(req.body);
    const result = await (0, service_1.retryFiscalDocuments)(req.user.tenantId, body.saleIds);
    res.json({ items: result });
});
exports.default = exports.fiscalRouter;
//# sourceMappingURL=routes.js.map