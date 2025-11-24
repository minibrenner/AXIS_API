const TOKEN_KEY = "axis.auth.tokens";
const TENANT_KEY = "axis.auth.tenantId";
const USER_KEY = "axis.auth.user";
const TIMESTAMP_KEY = "axis.auth.timestamp";

export type AxisRole = "OWNER" | "ADMIN" | "ATTENDANT";

export type AxisCurrentUser = {
  userId: string;
  tenantId: string;
  role: AxisRole;
  type: "access" | "refresh";
  name?: string | null;
};

export type AuthTokens = { access: string };

type DecodedToken = { tid?: string };

let inMemoryAccessToken: string | null = null;

const safeParse = <T>(value: string | null) => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const decodeJwt = (token: string) => {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded) as DecodedToken;
  } catch {
    return null;
  }
};

export function storeTokens(tokens: AuthTokens) {
  inMemoryAccessToken = tokens.access;
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString());

  const decoded = decodeJwt(tokens.access);
  if (decoded?.tid) {
    localStorage.setItem(TENANT_KEY, decoded.tid);
  }
}

export function storeCurrentUser(user: AxisCurrentUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(TENANT_KEY, user.tenantId);
}

export const clearSession = () => {
  inMemoryAccessToken = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TENANT_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TIMESTAMP_KEY);
};

export const setAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const getStoredTokens = (): AuthTokens | null =>
  safeParse<AuthTokens>(localStorage.getItem(TOKEN_KEY));

export const getAccessToken = () => {
  if (inMemoryAccessToken) {
    return inMemoryAccessToken;
  }

  const stored = getStoredTokens();
  if (stored?.access) {
    inMemoryAccessToken = stored.access;
    return stored.access;
  }

  return "";
};

export const getTenantId = () => localStorage.getItem(TENANT_KEY) ?? "";

export const getCurrentUser = (): AxisCurrentUser | null =>
  safeParse<AxisCurrentUser>(localStorage.getItem(USER_KEY));

export const hasAdminAccess = (user: AxisCurrentUser | null) =>
  user?.role === "ADMIN" || user?.role === "OWNER";

export const getAuthHeaders = () => {
  const access = getAccessToken();
  const tenantId = getTenantId();
  if (!access || !tenantId) {
    return null;
  }
  return { Authorization: `Bearer ${access}`, "x-tenant-id": tenantId };
};
