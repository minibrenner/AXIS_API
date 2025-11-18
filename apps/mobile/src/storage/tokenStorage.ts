import AsyncStorage from "@react-native-async-storage/async-storage";
import { decode as atob } from "base-64";
import type { AuthTokens } from "../services/api";

const TOKEN_KEY = "@axis/auth/tokens";
const TENANT_KEY = "@axis/auth/tenantId";
const EMAIL_KEY = "@axis/auth/email";

type JwtPayload = { tid?: string } | null;

const decode = (token: string): JwtPayload => {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

export async function persistTokens(email: string, tokens: AuthTokens) {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, JSON.stringify(tokens)],
    [EMAIL_KEY, email],
    ["@axis/auth/timestamp", new Date().toISOString()],
  ]);

  const payload = decode(tokens.access);
  if (payload?.tid) {
    await AsyncStorage.setItem(TENANT_KEY, payload.tid);
  }
}

export async function getTokens(): Promise<AuthTokens | null> {
  const value = await AsyncStorage.getItem(TOKEN_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as AuthTokens;
  } catch {
    return null;
  }
}

export async function getLastEmail() {
  return AsyncStorage.getItem(EMAIL_KEY);
}
