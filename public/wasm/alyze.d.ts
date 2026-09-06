/* tslint:disable */
/* eslint-disable */

/**
 * Analyze `text` and return the resulting tokens.
 *
 * `options` is a plain JS object matching [`Options`]. On an invalid
 * configuration (e.g. stemming with case sensitivity, or an unsupported
 * language) this throws an `Error` whose message matches what the turbopuffer
 * API would return.
 */
export function analyze(text: string, options: any): any;

/**
 * Returns the supported languages and whether each supports stemming and/or
 * stopword removal.
 */
export function languages(): any;

/**
 * Segment `text` into sentences (UAX #29), returning each sentence's byte
 * range. Ranges are contiguous and cover the whole input; trailing whitespace
 * attaches to the preceding sentence.
 */
export function sentences(text: string): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly analyze: (a: number, b: number, c: any) => [number, number, number];
    readonly languages: () => [number, number, number];
    readonly sentences: (a: number, b: number) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
