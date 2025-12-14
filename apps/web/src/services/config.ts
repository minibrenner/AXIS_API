const configuredApiUrl =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).trim()
    : "";

const base = configuredApiUrl || "http://localhost:3000/api";
const normalized = base.replace(/\/+$/, "");
const apiBase = /\/api$/i.test(normalized) ? normalized : `${normalized}/api`;

export const API_URL = apiBase;
