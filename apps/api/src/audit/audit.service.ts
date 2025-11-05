import { prisma } from "../prisma/client";
export async function audit({ tenantId, userId, action, entity, entityId, diffJson, ip, device, hmac }:
  { tenantId: string; userId?: string; action: string; entity: string; entityId?: string; diffJson?: string; ip?: string; device?: string; hmac: string; }) {
  await prisma.auditLog.create({ data: { tenantId, userId, action, entity, entityId, diffJson, ip, device, hmac } });
}
