const configuredApiUrl =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL)
    : "";

const apiBase = configuredApiUrl || "http://localhost:3000/api";

export const API_URL = apiBase.replace(/\/$/, "");

