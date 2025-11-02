import argon2 from "argon2";
import { prisma } from "../prisma/client";

/**
 * Verifica o PIN de supervisor de um usuário.
 * Suporta PIN armazenado em texto plano ou em hash Argon2 (preferível em produção).
 */
export async function verifySupervisorPIN(userId: string, pin: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pinSupervisor: true },
  });

  if (!user?.pinSupervisor) {
    return false;
  }

  const stored = user.pinSupervisor;

  if (stored.startsWith("$argon2")) {
    try {
      return await argon2.verify(stored, pin);
    } catch {
      return false;
    }
  }

  return stored === pin;
}
