import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";

export type SuperAdminEnv = {
  email: string;
  passwordHash?: string;
  passwordPlain?: string;
  tokenSecret: string;
  tokenTtl: string | number;
};

const ENV_FILENAMES = [".env.superadmin", ".env"];
let cachedEnv: SuperAdminEnv | null = null;

function findEnvFile(fileName: string): string | null {
  let currentDir = __dirname;
  const { root } = path.parse(currentDir);

  while (true) {
    const candidate = path.resolve(currentDir, fileName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    if (currentDir === root) {
      break;
    }

    currentDir = path.dirname(currentDir);
  }

  return null;
}

function ensureEnvLoaded() {
  if (cachedEnv) {
    return;
  }

  for (const name of ENV_FILENAMES) {
    const envPath = findEnvFile(name);
    if (envPath) {
      loadEnv({ path: envPath, override: false });
    }
  }
}

export function getSuperAdminEnv(): SuperAdminEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  ensureEnvLoaded();

  const email = process.env.SUPER_ADMIN_EMAIL;
  const passwordHash = process.env.SUPER_ADMIN_PASSWORD_HASH;
  const passwordPlain = process.env.SUPER_ADMIN_PASSWORD || process.env.SUPER_ADMIN_KEY;
  const tokenSecret =
    process.env.SUPER_ADMIN_TOKEN_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_REFRESH_SECRET;
  const tokenTtl = process.env.SUPER_ADMIN_TOKEN_TTL || "30m";

  if (!email) {
    throw new Error(
      "SUPER_ADMIN_EMAIL nao configurado. Defina-o no arquivo .env.superadmin (gitignored)."
    );
  }

  if (!passwordHash && !passwordPlain) {
    throw new Error(
      "Configure SUPER_ADMIN_PASSWORD ou SUPER_ADMIN_PASSWORD_HASH nas variaveis de ambiente."
    );
  }

  if (!tokenSecret) {
    throw new Error(
      "SUPER_ADMIN_TOKEN_SECRET ou JWT_ACCESS_SECRET nao configurado. Defina um segredo para tokens do super admin."
    );
  }

  cachedEnv = {
    email,
    passwordHash,
    passwordPlain,
    tokenSecret,
    tokenTtl,
  };

  return cachedEnv;
}
