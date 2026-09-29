"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ConversionJob } from "@shared/index";
import { DEFAULT_LOCAL_MEMORY_BUDGET, LocalImageScheduler } from "@/lib/local-scheduler";

const MAX_BATCH_RUNNERS = 4;

/** Owns local memory reservations and bounded batch execution. */
export function useConversionQueue() {
  const controllers = useRef(new Map<string, AbortController>());
  const localScheduler = useRef(new LocalImageScheduler(DEFAULT_LOCAL_MEMORY_BUDGET));

  useEffect(() => {
    const activeControllers = controllers.current;
    return () => activeControllers.forEach(controller => controller.abort());
  }, []);

  const runJobs = useCallback(async (pending: ConversionJob[], execute: (job: ConversionJob) => Promise<void>) => {
    let cursor = 0;
    const runner = async () => {
      while (cursor < pending.length) await execute(pending[cursor++]);
    };
    await Promise.all(Array.from({ length: Math.min(MAX_BATCH_RUNNERS, pending.length) }, runner));
  }, []);

  return { controllers, localScheduler, runJobs };
}
