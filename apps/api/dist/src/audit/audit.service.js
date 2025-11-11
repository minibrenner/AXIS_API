"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.audit = audit;
const client_1 = require("../prisma/client");
async function audit({ tenantId, userId, action, entity, entityId, diffJson, ip, device, hmac }) {
    await client_1.prisma.auditLog.create({ data: { tenantId, userId, action, entity, entityId, diffJson, ip, device, hmac } });
}
//# sourceMappingURL=audit.service.js.map