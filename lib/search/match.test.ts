import { describe, expect, it } from "vitest";
import { orMatch, phraseMatch } from "@/lib/search/match";
import type { Token } from "@/lib/alyze/types";

// Tokens are hand-built here rather than run through the real WASM module:
// these tests are about the matching logic, not the analyzer. The end to
// end path (WASM -> worker -> match) is covered by the Playwright smoke
// test against the running app.
function tok(text: string, position: number): Token {
  return { text, position, start: 0, end: 0 };
}

describe("orMatch", () => {
  it("is the founding example: café and cafe are different tokens with ascii_folding off", () => {
    const doc = [tok("o", 0), tok("café", 1), tok("da", 2), tok("manhã", 3)];
    const query = [tok("cafe", 0)];
    expect(orMatch(query, doc).matched).toBe(false);
  });

  it("matches once ascii_folding has already folded café to cafe", () => {
    const doc = [tok("o", 0), tok("cafe", 1), tok("da", 2), tok("manha", 3)];
    const query = [tok("cafe", 0)];
    const result = orMatch(query, doc);
    expect(result.matched).toBe(true);
    expect(result.matchedTerms).toEqual(["cafe"]);
  });

  it("is OR, not AND: a document matching only one of two query terms still comes back", () => {
    const doc = [tok("café", 0), tok("da", 1), tok("manhã", 2)];
    const query = [tok("manhã", 0), tok("inexistente", 1)];
    const result = orMatch(query, doc);
    expect(result.matched).toBe(true);
    expect(result.matchedTerms).toEqual(["manhã"]);
  });

  it("does not match when there is no overlap at all", () => {
    const doc = [tok("restaurante", 0), tok("fechou", 1)];
    const query = [tok("café", 0)];
    expect(orMatch(query, doc).matched).toBe(false);
  });
});

describe("phraseMatch", () => {
  it("matches an exact, adjacent phrase", () => {
    const doc = [tok("café", 0), tok("da", 1), tok("manhã", 2)];
    const query = [tok("café", 0), tok("da", 1), tok("manhã", 2)];
    expect(phraseMatch(query, doc).matched).toBe(true);
  });

  it("does not match when a real word sits between the query's words in the document", () => {
    // Doc keeps "da" (stopwords off). Query was typed without it, so its
    // own tokens are adjacent — but that's not the same phrase.
    const doc = [tok("café", 0), tok("da", 1), tok("manhã", 2)];
    const query = [tok("café", 0), tok("manhã", 1)];
    expect(phraseMatch(query, doc).matched).toBe(false);
  });

  it("still matches when a stopword is dropped identically from both sides", () => {
    // remove_stopwords on: "da" consumes position 1 in both the query and
    // the document but neither emits it. Positions have identical gaps
    // (0, then 2), so the phrase still lines up. See CLAUDE.md, "alyze":
    // this is the reason positions aren't compacted after filtering.
    const doc = [tok("café", 0), tok("manhã", 2)];
    const query = [tok("café", 0), tok("manhã", 2)];
    expect(phraseMatch(query, doc).matched).toBe(true);
  });

  it("does not match out of order words", () => {
    const doc = [tok("manhã", 0), tok("café", 1)];
    const query = [tok("café", 0), tok("manhã", 1)];
    expect(phraseMatch(query, doc).matched).toBe(false);
  });

  it("finds the phrase anywhere in the document, not just at the start", () => {
    const doc = [tok("ela", 0), tok("tomou", 1), tok("café", 2), tok("da", 3), tok("manhã", 4)];
    const query = [tok("café", 0), tok("da", 1), tok("manhã", 2)];
    expect(phraseMatch(query, doc).matched).toBe(true);
  });

  it("an empty query never matches", () => {
    const doc = [tok("café", 0)];
    expect(phraseMatch([], doc).matched).toBe(false);
  });
});
