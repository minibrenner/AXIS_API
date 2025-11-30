import axios from "axios";
import { API_BASE, TOKEN, POLL_INTERVAL_MS, PRINT_JOB_TYPE, PRINT_JOB_STATUS } from "./config";
import { sendToThermalPrinter } from "./printer";

type PrintJob = {
  id: string;
  tenantId: string;
  type: string;
  status: string;
  payload: { escposBase64?: string; [key: string]: unknown };
};

async function fetchPendingJobs(): Promise<PrintJob[]> {
  const res = await axios.get<{ jobs: PrintJob[] }>(`${API_BASE}/printing/jobs`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    params: { status: PRINT_JOB_STATUS, type: PRINT_JOB_TYPE, limit: 10 },
  });
  return res.data.jobs ?? [];
}

async function markJob(jobId: string, status: "DONE" | "FAILED", errorMessage?: string) {
  await axios.patch(
    `${API_BASE}/printing/jobs/${jobId}`,
    { status, errorMessage },
    { headers: { Authorization: `Bearer ${TOKEN}` } },
  );
}

async function processJob(job: PrintJob) {
  const escposBase64 = job.payload?.escposBase64;
  if (typeof escposBase64 !== "string" || !escposBase64.length) {
    throw new Error("Job sem escposBase64");
  }
  await sendToThermalPrinter(escposBase64);
  await markJob(job.id, "DONE");
}

async function loop() {
  try {
    const jobs = await fetchPendingJobs();
    for (const job of jobs) {
      try {
        await processJob(job);
      } catch (err) {
        console.error("[print-worker] Erro ao imprimir job", job.id, err);
        await markJob(job.id, "FAILED", err instanceof Error ? err.message : String(err));
      }
    }
  } catch (err) {
    console.error("[print-worker] Falha ao buscar jobs:", err);
  }
}

console.log("[print-worker] Iniciado. API:", API_BASE, "Intervalo(ms):", POLL_INTERVAL_MS);
setInterval(loop, POLL_INTERVAL_MS);
