// Hosts the alyze WASM module. The UI never calls the WASM module directly;
// every call is a postMessage into this worker. See CLAUDE.md, "Architecture".
//
// The wasm-bindgen glue (public/wasm/alyze.js) is loaded at runtime from
// public/, not through the bundler: it is `alyze-wasm` compiled straight
// from the turbopuffer/alyze source, not an npm package, and it needs to be
// swapped out by copying a new build over these files, never rebuilt by
// Turbopack. webpackIgnore skips bundling for both webpack and Turbopack.
// See CLAUDE.md, "Building the WASM artifact".

import type { WorkerRequest, WorkerResponse, Token, LanguageInfo } from "@/lib/alyze/types";

type AlyzeModule = {
  default: (input?: string | URL) => Promise<unknown>;
  analyze: (text: string, options: unknown) => Token[];
  languages: () => LanguageInfo[];
};

let modulePromise: Promise<AlyzeModule> | null = null;

function loadModule(): Promise<AlyzeModule> {
  if (!modulePromise) {
    // @ts-expect-error runtime-only asset served from public/, not part of
    // the TS module graph. See the file header.
    modulePromise = import(/* webpackIgnore: true */ "/wasm/alyze.js").then(
      async (mod) => {
        const alyze = mod as AlyzeModule;
        await alyze.default();
        return alyze;
      },
    );
  }
  return modulePromise;
}

// Start loading immediately. The main thread's boot shimmer
// ("abrindo o analisador...") covers this.
loadModule()
  .then(() => {
    postMessage({ type: "ready" });
  })
  .catch((err) => {
    // There is no request id to reply to yet, so this gets its own message.
    // Without it the main thread waits on "ready" forever and the page
    // keeps saying it is loading. See CLAUDE.md on loading and error states.
    postMessage({
      type: "fatal",
      message: err instanceof Error ? err.message : String(err),
    });
  });

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  try {
    const alyze = await loadModule();

    if (request.type === "analyze") {
      const tokens = alyze.analyze(request.text, request.options);
      const response: WorkerResponse = {
        id: request.id,
        type: "analyze",
        ok: true,
        tokens,
      };
      postMessage(response);
      return;
    }

    if (request.type === "languages") {
      const languages = alyze.languages();
      const response: WorkerResponse = {
        id: request.id,
        type: "languages",
        ok: true,
        languages,
      };
      postMessage(response);
      return;
    }
  } catch (err) {
    const response: WorkerResponse = {
      id: request.id,
      type: request.type,
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
    postMessage(response);
  }
};
