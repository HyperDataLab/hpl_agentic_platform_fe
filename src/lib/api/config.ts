/** Where the i2h-worker answers: it starts runs, controls them and streams their events. Public, baked in at build. */
export function getWorkerUrl() {
  return (process.env.NEXT_PUBLIC_I2H_WORKER_URL || "http://localhost:8787").replace(/\/+$/, "");
}

/** The worker's versioned API: `/v1/projects/:p/runs/…`. */
export function getApiBaseUrl() {
  return `${getWorkerUrl()}/v1`;
}

/** PaperLab's PDF worker, which lists the lab's corpora for the corpus picker. */
export function getPaperLabUrl() {
  return (
    process.env.NEXT_PUBLIC_PAPERLAB_WORKER_URL || "https://paperlab-pdf-worker.hyperdatalab.workers.dev"
  ).replace(/\/+$/, "");
}

/** The Writing Bank's read-only API, which names and defines the claim types shown as hints. */
export function getWritingBankUrl() {
  return (process.env.NEXT_PUBLIC_WRITING_BANK_URL || "https://writingbank-worker.hyperdatalab.workers.dev").replace(
    /\/+$/,
    "",
  );
}
