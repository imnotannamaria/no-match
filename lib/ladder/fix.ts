// Turns an explanation into the one change that would bring the document
// back. The button built on this writes into the other column, never the
// one being inspected: the tool is a comparison, and the button's job is to
// build the comparison that proves the fix. See IMPLEMENTATION.md, phase 5.

import type { AnalysisOptions } from "@/lib/alyze/types";
import type { DocumentExplanation, FixableOption } from "@/lib/ladder/types";
import { checkMaxLength } from "@/lib/ladder/max-length";

export type Fix =
  | { kind: "enable"; option: "remove_stopwords" | "stemming" | "ascii_folding" }
  | { kind: "disable"; option: "remove_stopwords" }
  | { kind: "disable-phrase" }
  | { kind: "raise-max-token-length"; to: number };

/** Narrow to broad, by how much of the corpus each one changes. */
const NARROWEST_FIRST: FixableOption[] = ["ascii_folding", "stemming"];

/** Which option each stage turns on. S0 and S1 turn on nothing actionable. */
const STAGE_OPTION = {
  S2: "remove_stopwords",
  S3: "stemming",
  S4: "ascii_folding",
} as const;

/**
 * The cheapest single change that would bring this document back, or null
 * when nothing in the configuration would help. Reads the explanation
 * against the configuration that produced it, because the ladder itself is
 * context-free: a "disappeared" verdict only becomes an instruction to
 * turn something off if that something is actually on.
 */
export function suggestFix(
  explanation: DocumentExplanation,
  options: AnalysisOptions,
  phrase: boolean,
): Fix | null {
  // The words are all there and only phrase order removed the document.
  // No analysis stage is responsible, so no analysis option can fix it.
  if (explanation.phraseOnlyMiss) {
    return phrase ? { kind: "disable-phrase" } : null;
  }

  // A search term too long to become a token never reaches any stage.
  for (const word of explanation.words) {
    if (word.droppedFromQuery?.reason === "length") {
      const { bytes } = checkMaxLength(word.queryWord, options.max_token_length);
      return { kind: "raise-max-token-length", to: Math.min(255, bytes) };
    }
  }

  // The document holds the word and a filter that is actually on is eating it.
  for (const word of explanation.words) {
    if (word.kind === "disappeared" && word.stage === "S2" && options.remove_stopwords) {
      return { kind: "disable", option: "remove_stopwords" };
    }
  }

  // The narrowest single option that actually makes a pair equal. Narrowest
  // first, not cheapest stage first: the cascade order says how alyze
  // applies filters, not how much each one changes. ascii_folding only
  // touches accents, while stemming collapses whole families of words, so
  // recommending stemming for an accent problem is the wrong hammer even
  // when the cascade converges there first.
  for (const option of NARROWEST_FIRST) {
    if (options[option]) continue;
    if (explanation.words.some((w) => w.fixableBy.includes(option))) {
      return { kind: "enable", option };
    }
  }

  // Nothing single-handedly fixes it, so fall back to the cascade: the
  // earliest stage where the pair converges, if it turns on something off.
  const stages: (keyof typeof STAGE_OPTION)[] = ["S2", "S3", "S4"];
  for (const stage of stages) {
    const converged = explanation.words.some((w) => w.kind === "converge" && w.stage === stage);
    if (!converged) continue;
    const option = STAGE_OPTION[stage];
    if (!options[option]) return { kind: "enable", option };
  }

  return null;
}

/** Applies a fix, returning the options and phrase flag it produces. */
export function applyFix(
  fix: Fix,
  options: AnalysisOptions,
  phrase: boolean,
): { options: AnalysisOptions; phrase: boolean } {
  switch (fix.kind) {
    case "enable":
      // stemming and remove_stopwords both require case_sensitive: false.
      return { options: { ...options, [fix.option]: true, case_sensitive: false }, phrase };
    case "disable":
      return { options: { ...options, [fix.option]: false }, phrase };
    case "disable-phrase":
      return { options, phrase: false };
    case "raise-max-token-length":
      return { options: { ...options, max_token_length: fix.to }, phrase };
  }
}
