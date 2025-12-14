import { existsSync } from "node:fs";
import { config } from "dotenv";
import { resolve } from "node:path";

function findEnvFile(): string | null {
  let directory = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(directory, ".env");
    if (existsSync(candidate)) {
      return candidate;
    }
    directory = resolve(directory, "..");
  }
  const fallback = resolve(process.cwd(), "../.env");
  return existsSync(fallback) ? fallback : null;
}

const envFilePath = findEnvFile();
if (envFilePath) {
  config({ path: envFilePath });
} else {
  console.warn("Arquivo .env nao encontrado; usando variaveis de ambiente existentes.");
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string, fallback?: string) {
  return process.env[name] ?? fallback;
}

export const env = {
  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET"),
  JWT_ACCESS_TTL: required("JWT_ACCESS_TTL"), // ex.: "15m"
  JWT_REFRESH_TTL: required("JWT_REFRESH_TTL"), // ex.: "7d"
  APP_WEB_URL: optional("APP_WEB_URL", "http://localhost:5173")!,
  CORS_ALLOWED_ORIGINS: optional("CORS_ALLOWED_ORIGINS"),
  REDIS_URL: optional("REDIS_URL"),
  SMTP_HOST: optional("SMTP_HOST", "smtp.gmail.com")!,
  SMTP_PORT: Number(optional("SMTP_PORT", "587")),
  SMTP_SECURE: optional("SMTP_SECURE", "false") === "true",
  SMTP_USER: required("EMAIL_USER"),
  SMTP_PASS: required("EMAIL_PASS"),
  SMTP_FROM: optional("SMTP_FROM", required("EMAIL_USER")),

  // Cloudflare R2 (S3 compatible) para imagens de categorias/produtos
  R2_ENDPOINT: required("R2_ENDPOINT"),
  R2_BUCKET: required("R2_BUCKET"),
  R2_ACCESS_KEY_ID: required("R2_ACCESS_KEY_ID"),
  R2_SECRET_ACCESS_KEY: required("R2_SECRET_ACCESS_KEY"),
};
