// Enforces the rule that stemming and remove_stopwords both require
// case_sensitive: false. See CLAUDE.md, "Rules the code has to keep": this
// has to be blocked in the UI, not just rejected once it reaches the WASM
// module.

import type { AnalysisOptions } from "@/lib/alyze/types";

/** True when case_sensitive can be turned on given the other two options. */
export function canEnableCaseSensitive(
  options: Pick<AnalysisOptions, "stemming" | "remove_stopwords">,
): boolean {
  return !options.stemming && !options.remove_stopwords;
}

/**
 * Forces case_sensitive off whenever stemming or remove_stopwords is on.
 * Call this whenever any of the three toggles changes, before the options
 * ever reach the worker.
 */
export function sanitizeOptions(options: AnalysisOptions): AnalysisOptions {
  if (!canEnableCaseSensitive(options) && options.case_sensitive) {
    return { ...options, case_sensitive: false };
  }
  return options;
}
