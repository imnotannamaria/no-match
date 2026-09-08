"use client";

// Main-thread wrapper around the analyzer worker. This is the only door the
// UI gets: it never imports the WASM module or workers/analyzer.ts's
// internals directly. See CLAUDE.md, "Architecture".

import type { AnalysisOptions, Token, WorkerMessage, WorkerRequest } from "@/lib/alyze/types";

interface PendingEntry {
  resolve: (tokens: Token[]) => void;
  reject: (err: Error) => void;
}

class AnalyzerClient {
  private worker: Worker | null = null;
  /** Set once the worker is unusable. Every later call rejects with it. */
  private fatal: Error | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingEntry>();
  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private rejectReady: ((err: Error) => void) | null = null;

  /**
   * Resolves once the worker has finished loading the WASM module, and
   * rejects if it cannot be loaded. It has to be able to reject: a promise
   * that only ever resolves leaves the page saying "loading" forever when
   * the thing is actually broken.
   */
  ready(): Promise<void> {
    this.ensureWorker();
    return this.readyPromise!;
  }

  private fail(err: Error): void {
    this.fatal = err;
    this.rejectReady?.(err);
    for (const [, entry] of this.pending) entry.reject(err);
    this.pending.clear();
  }

  private ensureWorker(): void {
    if (this.worker) return;

    this.readyPromise = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    // Nobody may have called ready() yet, and an unhandled rejection on a
    // promise held only by this class would surface as a console error.
    this.readyPromise.catch(() => {});

    const worker = new Worker(new URL("../../workers/analyzer.ts", import.meta.url), {
      type: "module",
    });

    worker.onerror = (event) => {
      this.fail(new Error(`the analyzer worker failed to start: ${event.message || "unknown error"}`));
    };

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;

      if (message.type === "ready") {
        this.resolveReady?.();
        return;
      }

      if (message.type === "fatal") {
        this.fail(new Error(message.message));
        return;
      }

      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);

      if (!message.ok) {
        entry.reject(new Error(message.message));
        return;
      }

      entry.resolve(message.tokens);
    };

    this.worker = worker;
  }

  async analyze(text: string, options: AnalysisOptions): Promise<Token[]> {
    // A worker that failed to start never answers, so a request posted to
    // it would leave the caller waiting forever. Fail loudly instead.
    if (this.fatal) throw this.fatal;
    this.ensureWorker();
    const id = this.nextId++;
    const request: WorkerRequest = { id, type: "analyze", text, options };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage(request);
    });
  }
}

// One worker for the whole app. Every column, every document and every rung
// of the ladder goes through this instance.
export const analyzerClient = new AnalyzerClient();
