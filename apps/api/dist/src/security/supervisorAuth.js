"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSupervisorApproval = requireSupervisorApproval;
const argon2_1 = __importDefault(require("argon2"));
const client_1 = require("../prisma/client");
const httpErrors_1 = require("../utils/httpErrors");
const tenant_context_1 = require("../tenancy/tenant.context");
const SUPERVISOR_ROLES = ["ADMIN", "OWNER"];
async function matchesPin(stored, credential) {
    if (!stored) {
        return false;
    }
    if (stored.startsWith("$argon2")) {
        try {
            return await argon2_1.default.verify(stored, credential);
        }
        catch {
            return false;
        }
    }
    return stored === credential;
}
async function matchesPassword(hash, credential) {
    if (!hash) {
        return false;
    }
    try {
        return await argon2_1.default.verify(hash, credential);
    }
    catch {
        return false;
    }
}
const resolveSupervisors = async (tenantId) => {
    const query = () => client_1.prisma.user.findMany({
        where: { tenantId, role: { in: SUPERVISOR_ROLES }, isActive: true },
        select: { id: true, role: true, pinSupervisor: true, passwordHash: true },
    });
    if (tenant_context_1.TenantContext.get() === tenantId) {
        return query();
    }
    return tenant_context_1.TenantContext.run(tenantId, query);
};
async function requireSupervisorApproval(tenantId, credential, actionDescription) {
    const normalized = credential?.trim();
    if (!normalized) {
        throw new httpErrors_1.BadRequest(`${actionDescription}: credencial de supervisor obrigat\u00f3ria.`);
    }
    const supervisors = await resolveSupervisors(tenantId);
    for (const supervisor of supervisors) {
        if (await matchesPin(supervisor.pinSupervisor, normalized)) {
            return { approverId: supervisor.id, approverRole: supervisor.role, via: "PIN" };
        }
        if (await matchesPassword(supervisor.passwordHash, normalized)) {
            return { approverId: supervisor.id, approverRole: supervisor.role, via: "PASSWORD" };
        }
    }
    throw new httpErrors_1.BadRequest(`${actionDescription}: credencial n\u00e3o corresponde a nenhum ADMIN/OWNER ativo.`);
}
//# sourceMappingURL=supervisorAuth.js.map