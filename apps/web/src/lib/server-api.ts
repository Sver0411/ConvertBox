export interface ServerCapability {
  input: string;
  outputs: string[];
  note: string;
}

export interface ServerCapabilities {
  version: number;
  tools?: Record<string, { available: boolean; inputs: string[]; outputs: string[] }>;
  server: ServerCapability[];
  pdfOperations: string[];
  maxUploadSize: number;
}

export interface ServerJob {
  id: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress: number | null;
  error: string | null;
  errorCode: string | null;
  outputName: string | null;
  outputSize: number | null;
}

export class ServerApiError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number) {
    super(message);
  }
}

async function check(response: Response): Promise<Response> {
  if (response.ok) return response;
  let message = `Server error (${response.status})`;
  let code = "SERVER_ERROR";
  try {
    const body = await response.json() as { detail?: string | { code?: string; message?: string } };
    if (typeof body.detail === "string") message = body.detail;
    else if (body.detail) { message = body.detail.message ?? message; code = body.detail.code ?? code; }
  } catch { /* keep HTTP error */ }
  throw new ServerApiError(message, code, response.status);
}

export async function getServerCapabilities(): Promise<ServerCapabilities> {
  return (await check(await fetch("/api/capabilities", { cache: "no-store" }))).json() as Promise<ServerCapabilities>;
}

export async function createServerJob(
  files: File[], output: string, operation: string,
  settings: Record<string, string | number | boolean>, signal: AbortSignal, toolId?: string, onRateWait?:()=>void,
): Promise<ServerJob> {
  const form = new FormData();
  for (const file of files) form.append("files", file, file.name);
  if (toolId) form.append("toolId", toolId);
  form.append("output", output);
  form.append("operation", operation);
  form.append("settings", JSON.stringify(settings));
  for(let attempt=0;;attempt++){
    const response=await fetch("/api/jobs",{method:"POST",body:form,signal});
    if(response.status!==429||attempt>=2)return (await check(response)).json() as Promise<ServerJob>;
    onRateWait?.();
    await new Promise<void>((resolve,reject)=>{const stop=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve();},Math.max(1,Math.min(60,Number(response.headers.get('Retry-After'))||60))*1000);signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop();});
  }
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
