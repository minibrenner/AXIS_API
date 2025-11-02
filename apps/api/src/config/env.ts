// apps/api/src/config/env.ts
import { config } from 'dotenv';
import { resolve } from 'node:path';

// O .env está em ../.env em relação a apps/api
config({ path: resolve(process.cwd(), '../.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  JWT_ACCESS_TTL: required('JWT_ACCESS_TTL'),     // ex.: "15m"
  JWT_REFRESH_TTL: required('JWT_REFRESH_TTL'),   // ex.: "7d"
};
