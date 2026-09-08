// Shared between the worker (workers/analyzer.ts) and the main-thread client
// (lib/alyze/client.ts). Kept independent of the wasm-bindgen generated
// alyze.d.ts on purpose: that file also describes low-level exports
// (memory, malloc) neither side of the message boundary needs.

/** Snake_case, matching the `full_text_search` parameters in turbopuffer's API. */
export interface AnalysisOptions {
  case_sensitive: boolean;
  ascii_folding: boolean;
  stemming: boolean;
  remove_stopwords: boolean;
  language: string;
  max_token_length: number;
}

export const DEFAULT_OPTIONS: AnalysisOptions = {
  case_sensitive: false,
  ascii_folding: false,
  stemming: false,
  remove_stopwords: false,
  language: "english",
  max_token_length: 39,
};

/**
 * One token, as `alyze` returns it. `start`/`end` are the UTF-8 byte range of
 * the raw token in the original text, before any normalization. `position`
 * is spent by every word-like token, even one a later filter drops, so
 * positions can have gaps. See CLAUDE.md, "alyze" section.
 */
export interface Token {
  text: string;
  position: number;
  start: number;
  end: number;
}

// -- Worker message contract --------------------------------------------
//
// Every message that crosses the worker boundary, both directions. The UI
// never calls the wasm module directly; it only ever talks to the worker
// through lib/alyze/client.ts, which speaks this contract.

export interface AnalyzeRequest {
  id: number;
  type: "analyze";
  text: string;
  options: AnalysisOptions;
}

export type WorkerRequest = AnalyzeRequest;

export interface AnalyzeResponse {
  id: number;
  type: "analyze";
  ok: true;
  tokens: Token[];
}

export interface ErrorResponse {
  id: number;
  type: "analyze";
  ok: false;
  message: string;
}

export type WorkerResponse = AnalyzeResponse | ErrorResponse;

/** Sent once, unprompted, when the wasm module has finished loading. */
export interface ReadyMessage {
  type: "ready";
}

/**
 * Sent once, unprompted, when the wasm module could not be loaded at all.
 * Without this the page waits on `ready` forever and tells the person it
 * is still loading, which is a lie.
 */
export interface FatalMessage {
  type: "fatal";
  message: string;
}

export type WorkerMessage = WorkerResponse | ReadyMessage | FatalMessage;
