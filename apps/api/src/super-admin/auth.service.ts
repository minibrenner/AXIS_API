import { timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import jwt, { JwtPayload } from "jsonwebtoken";
import { getSuperAdminEnv } from "./config";

export type SuperAdminTokenPayload = JwtPayload & {
  email: string;
  scope: "super-admin";
};

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  try {
    return timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

export async function verifySuperAdminCredentials(email: string, password: string) {
  const env = getSuperAdminEnv();

  if (!safeCompare(env.email, email)) {
    return false;
  }

  if (env.passwordHash) {
    try {
      return await argon2.verify(env.passwordHash, password);
    } catch {
      return false;
    }
  }

  if (env.passwordPlain) {
    return safeCompare(env.passwordPlain, password);
  }

  return false;
}

export function issueSuperAdminToken() {
  const env = getSuperAdminEnv();
  const payload: SuperAdminTokenPayload = {
    scope: "super-admin",
    email: env.email,
  };

  const token = jwt.sign(payload, env.tokenSecret, { expiresIn: env.tokenTtl });
  return { token, expiresIn: env.tokenTtl };
}

export function verifySuperAdminToken(token: string): SuperAdminTokenPayload {
  const env = getSuperAdminEnv();
  const payload = jwt.verify(token, env.tokenSecret) as SuperAdminTokenPayload;

  if (payload.scope !== "super-admin") {
    throw new Error("Token nao pertence ao super admin.");
  }

  if (!safeCompare(payload.email, env.email)) {
    throw new Error("Token de super admin com email invalido.");
  }

  return payload;
}
