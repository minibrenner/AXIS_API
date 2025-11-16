import argon2 from "argon2";
import { Role } from "@prisma/client";
import { prisma } from "../prisma/client";
import { BadRequest } from "../utils/httpErrors";
import { TenantContext } from "../tenancy/tenant.context";

const SUPERVISOR_ROLES: Role[] = ["ADMIN", "OWNER"];

async function matchesPin(stored: string | null | undefined, credential: string): Promise<boolean> {
  if (!stored) {
    return false;
  }

  if (stored.startsWith("$argon2")) {
    try {
      return await argon2.verify(stored, credential);
    } catch {
      return false;
    }
  }

  return stored === credential;
}

async function matchesPassword(hash: string | null | undefined, credential: string): Promise<boolean> {
  if (!hash) {
    return false;
  }

  try {
    return await argon2.verify(hash, credential);
  } catch {
    return false;
  }
}

export type SupervisorApproval = {
  approverId: string;
  approverRole: Role;
  via: "PIN" | "PASSWORD";
};

const resolveSupervisors = async (tenantId: string) => {
  const query = () =>
    prisma.user.findMany({
      where: { tenantId, role: { in: SUPERVISOR_ROLES }, isActive: true },
      select: { id: true, role: true, pinSupervisor: true, passwordHash: true },
    });

  if (TenantContext.get() === tenantId) {
    return query();
  }

  return TenantContext.run(tenantId, query);
};

export async function requireSupervisorApproval(
  tenantId: string,
  credential: string | undefined,
  actionDescription: string
): Promise<SupervisorApproval> {
  const normalized = credential?.trim();
  if (!normalized) {
    throw new BadRequest(`${actionDescription}: credencial de supervisor obrigat\u00f3ria.`);
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

  throw new BadRequest(`${actionDescription}: credencial n\u00e3o corresponde a nenhum ADMIN/OWNER ativo.`);
}
