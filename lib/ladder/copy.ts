// Every string the ladder puts in front of a person. Kept in one file so
// it can be read end to end as prose, which is the only way to catch a
// stage explanation that names an option without saying what it does.
//
// CLAUDE.md: interface text is part of the product, not a caption. Written
// for someone who has never heard the word "token".

import type { Fix } from "@/lib/ladder/fix";
import type { LadderVerdict, StageId } from "@/lib/ladder/types";

interface StageCopy {
  /** The option to turn on to reach this stage. Empty when there is nothing to turn on. */
  option: string;
  /** What that option does, in plain words, with a concrete example where one helps. */
  does: string;
}

export const STAGE_COPY: Record<StageId, StageCopy> = {
  S0: {
    option: "",
    does: "only cuts the text into words, without changing any of them",
  },
  S1: {
    option: "case_sensitive: false",
    does: "lowercases everything, so Café and café become the same word",
  },
  S2: {
    option: "remove_stopwords",
    does: "drops very common words, like the, of and a",
  },
  S3: {
    option: "stemming",
    does: "cuts a word back to its root, so cafes becomes cafe",
  },
  S4: {
    option: "ascii_folding",
    does: "swaps an accented letter for the plain one, so café becomes cafe",
  },
};

export const VERDICT_COPY: Record<LadderVerdict, string> = {
  match: "same",
  "no-match": "different",
  "doc-dropped": "the document lost the word here",
  "query-dropped": "the search lost the word here",
  "both-dropped": "both lost the word here",
};

/** "S4 · ascii_folding", or just "S0" when the stage turns nothing on. */
export function stageLabel(stage: StageId): string {
  const { option } = STAGE_COPY[stage];
  return option ? `${stage} · ${option}` : stage;
}

/** What to do about a pair that only becomes equal at `stage`. */
export function convergeAdvice(stage: StageId): string {
  const { option, does } = STAGE_COPY[stage];
  if (!option) {
    return "these two are already the same word with nothing turned on. If the document is still missing, this word is not the reason.";
  }
  if (stage === "S1") {
    return `only the letter case differs, and ${option} is already the default. If the document is still missing, this word is not the reason.`;
  }
  return `Turn on ${option}, which ${does}.`;
}

/** What to say when a filter ate the document's copy of the word. */
export function disappearedAdvice(stage: StageId, word: string): string {
  const { option, does } = STAGE_COPY[stage];
  return `the document has exactly that word. Then ${option} ${does}, and it threw "${word}" away. Turn ${option} off to find this document.`;
}

/** Names the option that actually fixes the pair, and what it does. */
export function optionAdvice(option: "ascii_folding" | "stemming"): string {
  const stage = option === "ascii_folding" ? "S4" : "S3";
  return `Turn on ${option}, which ${STAGE_COPY[stage].does}.`;
}

export const NEVER_ADVICE =
  "no word in this document ever becomes the same as that one, at any stage. This is not a setting: they are different words.";

/** The word never entered the search, so no document could ever match on it. */
export function droppedFromQueryAdvice(
  reason: "stopword" | "length",
  bytes: number,
  limit: number,
): string {
  if (reason === "length") {
    return `that word is ${bytes} bytes, over the limit of ${limit}, so it was dropped from your search before any document was compared.`;
  }
  return "that word is too common, and remove_stopwords dropped it from your own search, before any document was compared. No document could have matched on it.";
}

export const PHRASE_ONLY_MISS =
  "every word in the search is in this document, just not next to each other. No analysis stage removed it: exact phrase did. Turn exact phrase off to bring this document back.";

/** The toggles, in the order the cascade applies them. */
export const OPTION_COPY: {
  key: "case_sensitive" | "remove_stopwords" | "stemming" | "ascii_folding";
  help: string;
}[] = [
  { key: "case_sensitive", help: "tells Café from café" },
  { key: "remove_stopwords", help: "drops very common words, like the, of and a" },
  { key: "stemming", help: "cuts a word to its root, cafes becomes cafe" },
  { key: "ascii_folding", help: "drops the accent, café becomes cafe" },
];

/** What the fix button says, naming both the change and where it lands. */
export function fixLabel(fix: Fix, target: string): string {
  switch (fix.kind) {
    case "enable":
      return `turn on ${fix.option} in column ${target}`;
    case "disable":
      return `turn off ${fix.option} in column ${target}`;
    case "disable-phrase":
      return `turn off exact phrase in column ${target}`;
    case "raise-max-token-length":
      return `raise max_token_length to ${fix.to} in column ${target}`;
  }
}
