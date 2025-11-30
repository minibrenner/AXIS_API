import "dotenv/config";

export const API_BASE = process.env.AXIS_API_BASE?.replace(/\/$/, "") ?? "http://localhost:3000/api";
export const TOKEN = process.env.AXIS_PRINT_TOKEN ?? "";
export const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? "3000");
export const PRINT_JOB_TYPE = process.env.PRINT_JOB_TYPE ?? "SALE_RECEIPT";
export const PRINT_JOB_STATUS = process.env.PRINT_JOB_STATUS ?? "PENDING";
export const PRINTER_HOST = process.env.PRINTER_HOST ?? "127.0.0.1";
export const PRINTER_PORT = Number(process.env.PRINTER_PORT ?? "9100");

if (!TOKEN) {
  console.warn("[print-worker] AXIS_PRINT_TOKEN ausente; configure o token de acesso.");
}
