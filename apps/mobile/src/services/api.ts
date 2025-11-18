import Constants from "expo-constants";

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

const apiBase =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  (typeof process !== "undefined" ? process?.env?.EXPO_PUBLIC_API_URL : undefined) ??
  "http://localhost:3000/api";

export const API_URL = apiBase.replace(/\/$/, "");

export type AuthTokens = { access: string; refresh: string };

const defaultHeaders = { "Content-Type": "application/json" } as const;

const parseJson = async <T>(res: Response): Promise<T | null> => {
  const raw = await res.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export async function login(email: string, password: string): Promise<AuthTokens> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: defaultHeaders,
    body: JSON.stringify({ email, password }),
  });
  const payload = await parseJson<AuthTokens & { message?: string }>(res);

  if (!res.ok || !payload) {
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : "Não foi possível realizar o login.";
    throw new Error(message);
  }

  return { access: payload.access, refresh: payload.refresh };
}

export async function requestPasswordReset(email: string) {
  const res = await fetch(`${API_URL}/auth/forgot-password`, {
    method: "POST",
    headers: defaultHeaders,
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const payload = await parseJson<{ message?: string }>(res);
    throw new Error(
      typeof payload?.message === "string"
        ? payload.message
        : "Falha ao solicitar redefinição.",
    );
  }
}

export async function resetPassword(token: string, newPassword: string) {
  const res = await fetch(`${API_URL}/auth/reset-password`, {
    method: "POST",
    headers: defaultHeaders,
    body: JSON.stringify({ token, newPassword }),
  });

  if (!res.ok) {
    const payload = await parseJson<{ message?: string }>(res);
    throw new Error(
      typeof payload?.message === "string"
        ? payload.message
        : "Falha ao redefinir a senha.",
    );
  }
}
