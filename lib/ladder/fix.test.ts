import { describe, expect, it } from "vitest";
import { applyFix, suggestFix } from "@/lib/ladder/fix";
import { DEFAULT_OPTIONS } from "@/lib/alyze/types";
import type { DocumentExplanation, LadderExplanation } from "@/lib/ladder/types";

function word(partial: Partial<LadderExplanation>): LadderExplanation {
  return {
    queryWord: "cafe",
    docWord: "café",
    kind: "never",
    stage: null,
    rows: null,
    fixableBy: [],
    droppedFromQuery: null,
    ...partial,
  };
}

function explanation(
  words: LadderExplanation[],
  phraseOnlyMiss = false,
): DocumentExplanation {
  return { phraseOnlyMiss, words };
}

describe("suggestFix", () => {
  it("turns on ascii_folding when that is the stage the pair converges at", () => {
    const exp = explanation([word({ kind: "converge", stage: "S4" })]);
    expect(suggestFix(exp, DEFAULT_OPTIONS, false)).toEqual({
      kind: "enable",
      option: "ascii_folding",
    });
  });

  it("prefers the cheapest stage when more than one word would converge", () => {
    const exp = explanation([
      word({ queryWord: "a", kind: "converge", stage: "S4" }),
      word({ queryWord: "b", kind: "converge", stage: "S3" }),
    ]);
    expect(suggestFix(exp, DEFAULT_OPTIONS, false)).toEqual({ kind: "enable", option: "stemming" });
  });

  it("does not suggest turning on something already on", () => {
    const exp = explanation([word({ kind: "converge", stage: "S4" })]);
    const options = { ...DEFAULT_OPTIONS, ascii_folding: true };
    expect(suggestFix(exp, options, false)).toBeNull();
  });

  it("turns remove_stopwords off when it is on and eating the word the document has", () => {
    const exp = explanation([word({ queryWord: "da", docWord: "da", kind: "disappeared", stage: "S2" })]);
    const options = { ...DEFAULT_OPTIONS, remove_stopwords: true, case_sensitive: false };
    expect(suggestFix(exp, options, false)).toEqual({ kind: "disable", option: "remove_stopwords" });
  });

  it("does not suggest turning off a filter that is not on", () => {
    // The ladder is context-free, so it reports a stopword being dropped at
    // S2 whether or not the column actually has remove_stopwords on. Turning
    // off something already off would be a button that does nothing.
    const exp = explanation([word({ queryWord: "da", docWord: "da", kind: "disappeared", stage: "S2" })]);
    expect(suggestFix(exp, DEFAULT_OPTIONS, false)).toBeNull();
  });

  it("turns phrase off when phrase order is the only thing that removed the document", () => {
    const exp = explanation([word({ kind: "converge", stage: "S0" })], true);
    expect(suggestFix(exp, DEFAULT_OPTIONS, true)).toEqual({ kind: "disable-phrase" });
  });

  it("has nothing to offer for a phrase miss when phrase is already off", () => {
    const exp = explanation([word({ kind: "converge", stage: "S0" })], true);
    expect(suggestFix(exp, DEFAULT_OPTIONS, false)).toBeNull();
  });

  it("raises max_token_length when the search term is too long to become a token", () => {
    const long = "paralelepipedico".repeat(3); // 48 bytes
    const exp = explanation([
      word({ queryWord: long, droppedFromQuery: { reason: "length", bytes: 48 } }),
    ]);
    expect(suggestFix(exp, DEFAULT_OPTIONS, false)).toEqual({
      kind: "raise-max-token-length",
      to: 48,
    });
  });

  it("prefers the narrow option over the stage the cumulative cascade lands on", () => {
    // Real case, verified against the analyzer: with Portuguese stemming
    // both "cafe" and "café" reduce to "caf", so the cascade converges at
    // stemming before it ever reaches folding. Both would work, and folding
    // is the one that only touches accents.
    const exp = explanation([
      word({ kind: "converge", stage: "S3", fixableBy: ["ascii_folding", "stemming"] }),
    ]);
    expect(suggestFix(exp, DEFAULT_OPTIONS, false)).toEqual({
      kind: "enable",
      option: "ascii_folding",
    });
  });

  it("falls back to the cascade stage when no single option fixes the pair", () => {
    const exp = explanation([word({ kind: "converge", stage: "S3", fixableBy: [] })]);
    expect(suggestFix(exp, DEFAULT_OPTIONS, false)).toEqual({ kind: "enable", option: "stemming" });
  });

  it("offers nothing when the words are simply different", () => {
    expect(suggestFix(explanation([word({ kind: "never" })]), DEFAULT_OPTIONS, false)).toBeNull();
  });
});

describe("applyFix", () => {
  it("turning on stemming also forces case_sensitive off, because the pair is invalid", () => {
    const options = { ...DEFAULT_OPTIONS, case_sensitive: true };
    const result = applyFix({ kind: "enable", option: "stemming" }, options, false);
    expect(result.options.stemming).toBe(true);
    expect(result.options.case_sensitive).toBe(false);
  });

  it("disabling a filter leaves everything else alone", () => {
    const options = { ...DEFAULT_OPTIONS, remove_stopwords: true, ascii_folding: true };
    const result = applyFix({ kind: "disable", option: "remove_stopwords" }, options, false);
    expect(result.options.remove_stopwords).toBe(false);
    expect(result.options.ascii_folding).toBe(true);
  });

  it("disabling phrase touches the phrase flag and nothing in the options", () => {
    const result = applyFix({ kind: "disable-phrase" }, DEFAULT_OPTIONS, true);
    expect(result.phrase).toBe(false);
    expect(result.options).toEqual(DEFAULT_OPTIONS);
  });

  it("raising the byte limit never goes past what alyze accepts", () => {
    const result = applyFix({ kind: "raise-max-token-length", to: 255 }, DEFAULT_OPTIONS, false);
    expect(result.options.max_token_length).toBe(255);
  });
});
