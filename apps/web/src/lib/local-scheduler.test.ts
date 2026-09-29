import { describe, expect, it } from "vitest";
import { estimatedImageBytes, LocalImageScheduler } from "./local-scheduler";
import type { FileDescriptor } from "@shared/index";

function descriptor(width: number, height: number): FileDescriptor {
  return { name: "x.png", extension: "png", mime: "image/png", detectedType: "png", size: 1, category: "image", signature: "png", supportedConversions: ["jpg"], width, height };
}

describe("local memory scheduler", () => {
  it("estimates decoded and output buffers before starting", () => {
    expect(estimatedImageBytes(descriptor(100, 200), { output: "jpg", quality: 85 })).toBe(100 * 200 * 12);
    expect(estimatedImageBytes(descriptor(100, 200), { output: "jpg", quality: 85, width: 400 })).toBe(400 * 800 * 12);
    expect(estimatedImageBytes(descriptor(10000, 10000), { output: "jpg", quality: 85 })).toBe(Infinity);
  });

  it("runs small tasks together but gives a large task the budget alone", async () => {
    const scheduler = new LocalImageScheduler(100, 3);
    let releaseSmall!: () => void;
    let releaseLarge!: () => void;
    const smallGate = new Promise<void>(resolve => { releaseSmall = resolve; });
    const largeGate = new Promise<void>(resolve => { releaseLarge = resolve; });
    const running: string[] = [];
    const signal = new AbortController().signal;
    const a = scheduler.run(30, signal, async () => { running.push("a"); await smallGate; });
    const b = scheduler.run(30, signal, async () => { running.push("b"); await smallGate; });
    const c = scheduler.run(90, signal, async () => { running.push("c"); await largeGate; });
    await Promise.resolve();
    expect(running).toEqual(["a", "b"]);
    releaseSmall();
    await Promise.all([a, b]);
    await Promise.resolve();
    expect(running).toEqual(["a", "b", "c"]);
    releaseLarge();
    await c;
    await expect(scheduler.run(101, signal, async () => {})).rejects.toThrow("memory budget");
  });
});
