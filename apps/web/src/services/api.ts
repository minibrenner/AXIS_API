export const API_URL = "http://localhost:3000/api";
export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (!res.ok) throw new Error("Login falhou");
  return res.json() as Promise<{ access: string; refresh: string }>;
}
export async function ping(access: string, tenantId: string) {
  const res = await fetch(`${API_URL}/ping`, { headers: { "Authorization": `Bearer ${access}`, "x-tenant-id": tenantId } });
  if (!res.ok) throw new Error("Ping falhou");
  return res.json();
}
