import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS } from "@/lib/alyze/types";
import { DEFAULT_BM25 } from "@/lib/bm25/types";
import { initialConfigs, needsReanalysis, type ColumnConfig } from "@/lib/columns";
import { CORPUS_EN, CORPUS_PT } from "@/lib/corpora";

const base: ColumnConfig = {
  options: { ...DEFAULT_OPTIONS },
  phrase: false,
  bm25: { ...DEFAULT_BM25 },
};

// The project's central claim is that analysis and ranking are separate
// concerns: analysis decides which documents come back, BM25 only orders
// the ones that already did. If a ranking parameter ever reaches the
// analyzer, that claim is false and the README is wrong.
describe("needsReanalysis", () => {
  it("does not re-analyse for any BM25 parameter", () => {
    for (const key of ["k1", "b", "k3"] as const) {
      const next = { ...base, bm25: { ...base.bm25, [key]: base.bm25[key] + 1 } };
      expect(needsReanalysis(base, next)).toBe(false);
    }
  });

  it("re-analyses for every analysis option", () => {
    for (const key of ["ascii_folding", "stemming", "remove_stopwords", "case_sensitive"] as const) {
      const next = { ...base, options: { ...base.options, [key]: !base.options[key] } };
      expect(needsReanalysis(base, next)).toBe(true);
    }
  });

  it("re-analyses when the language or the byte limit changes", () => {
    expect(
      needsReanalysis(base, { ...base, options: { ...base.options, language: "portuguese" } }),
    ).toBe(true);
    expect(
      needsReanalysis(base, { ...base, options: { ...base.options, max_token_length: 12 } }),
    ).toBe(true);
  });

  it("re-analyses when exact phrase is switched", () => {
    expect(needsReanalysis(base, { ...base, phrase: true })).toBe(true);
  });

  it("does not re-analyse when nothing changed", () => {
    expect(needsReanalysis(base, { ...base, options: { ...base.options } })).toBe(false);
  });
});

describe("initialConfigs", () => {
  it("opens A on the defaults and B on the one option that corpus needs", () => {
    for (const corpus of [CORPUS_PT, CORPUS_EN]) {
      const { A, B } = initialConfigs(corpus);
      expect(A.options[corpus.fix]).toBe(false);
      expect(B.options[corpus.fix]).toBe(true);
      expect(A.options.language).toBe(corpus.language);
      expect(B.options.language).toBe(corpus.language);
    }
  });
});
