export interface ServerCapability {
  input: string;
  outputs: string[];
  note: string;
}

export interface ServerCapabilities {
  version: number;
  server: ServerCapability[];
  pdfOperations: string[];
  maxUploadSize: number;
}

export interface ServerJob {
  id: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress: number | null;
  error: string | null;
  outputName: string | null;
  outputSize: number | null;
}

async function check(response: Response): Promise<Response> {
  if (response.ok) return response;
  let message = `Server error (${response.status})`;
  try {
    const body = await response.json() as { detail?: string };
    if (body.detail) message = body.detail;
  } catch { /* keep HTTP error */ }
  throw new Error(message);
}

export async function getServerCapabilities(): Promise<ServerCapabilities> {
  return (await check(await fetch("/api/capabilities", { cache: "no-store" }))).json() as Promise<ServerCapabilities>;
}

export async function createServerJob(
  files: File[], output: string, operation: string,
  settings: Record<string, string | number | boolean>, signal: AbortSignal,
): Promise<ServerJob> {
  const form = new FormData();
  for (const file of files) form.append("files", file, file.name);
  form.append("output", output);
  form.append("operation", operation);
  form.append("settings", JSON.stringify(settings));
  return (await check(await fetch("/api/jobs", { method: "POST", body: form, signal }))).json() as Promise<ServerJob>;
}

export async function pollServerJob(id: string, onUpdate: (job: ServerJob) => void, signal: AbortSignal): Promise<ServerJob> {
  while (true) {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    const job = await (await check(await fetch(`/api/jobs/${encodeURIComponent(id)}`, { signal, cache: "no-store" }))).json() as ServerJob;
    onUpdate(job);
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) return job;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 600);
      const abort = () => { window.clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError")); };
      signal.addEventListener("abort", abort, { once: true });
    });
  }
}

export function downloadServerJob(id: string): void {
  const anchor = document.createElement("a");
  anchor.href = `/api/jobs/${encodeURIComponent(id)}/download`;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

export async function deleteServerJob(id: string): Promise<void> {
  await check(await fetch(`/api/jobs/${encodeURIComponent(id)}`, { method: "DELETE" }));
}
