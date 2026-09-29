import { outputDimensions } from "@core/dimensions";
import type { FileDescriptor, JobSettings } from "@shared/index";

export const DEFAULT_LOCAL_MEMORY_BUDGET = 256 * 1024 * 1024;
export const MAX_LOCAL_PIXELS = 80_000_000;

export function localMemoryBudget(deviceMemory?: number): number {
  if (deviceMemory !== undefined && deviceMemory <= 2) return 128 * 1024 * 1024;
  if (deviceMemory !== undefined && deviceMemory >= 8) return 384 * 1024 * 1024;
  return DEFAULT_LOCAL_MEMORY_BUDGET;
}

export function estimatedImageBytes(descriptor: FileDescriptor, settings: JobSettings): number {
  if (!descriptor.width || !descriptor.height) return Infinity;
  const [width, height] = outputDimensions(descriptor.width, descriptor.height, settings.width, settings.height);
  const largestPixels = Math.max(descriptor.width * descriptor.height, width * height);
  if (largestPixels > MAX_LOCAL_PIXELS) return Infinity;
  // Estimated decode + drawing + encode buffers. This is not measured peak RSS.
  return largestPixels * 4 * 3;
}

interface Waiter { cost: number; resolve: () => void; reject: (error: Error) => void; signal: AbortSignal; onAbort: () => void }

export class LocalImageScheduler {
  private active = 0;
  private used = 0;
  private waiting: Waiter[] = [];

  constructor(readonly budget: number, readonly maxParallel = 2) {}

  async run<T>(cost: number, signal: AbortSignal, work: () => Promise<T>): Promise<T> {
    if (!Number.isFinite(cost) || cost > this.budget) throw new Error("Image exceeds the local memory budget.");
    await this.reserve(cost, signal);
    try { return await work(); }
    finally { this.active--; this.used -= cost; this.drain(); }
  }

  private reserve(cost: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(new DOMException("Cancelled", "AbortError")); return; }
      const waiter: Waiter = {
        cost, resolve, reject, signal,
        onAbort: () => { this.waiting = this.waiting.filter(item => item !== waiter); reject(new DOMException("Cancelled", "AbortError")); this.drain(); },
      };
      signal.addEventListener("abort", waiter.onAbort, { once: true });
      this.waiting.push(waiter);
      this.drain();
    });
  }

  private drain(): void {
    while (this.waiting.length && this.active < this.maxParallel && this.used + this.waiting[0].cost <= this.budget) {
      const next = this.waiting.shift()!;
      next.signal.removeEventListener("abort", next.onAbort);
      this.active++;
      this.used += next.cost;
      next.resolve();
    }
  }
}
