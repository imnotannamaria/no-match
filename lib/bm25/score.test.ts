import { describe, expect, it } from "vitest";
import { buildCorpusStats, idf, rank, scoreDocument } from "@/lib/bm25/score";
import { DEFAULT_BM25 } from "@/lib/bm25/types";
import type { Token } from "@/lib/alyze/types";

function toks(...words: string[]): Token[] {
  return words.map((text, position) => ({ text, position, start: 0, end: 0 }));
}

// The three-document corpus the numbers below were worked out on, by hand,
// before any of this code existed.
//
//   D1  cafe manha              length 2
//   D2  cafe cafe gelado        length 3
//   D3  restaurante almoco      length 2
//
//   N = 3,  avgdl = 7/3 = 2.333333...,  df(cafe) = 2
//   k1 = 1.2,  b = 0.75,  k3 = 8.0,  query = "cafe" so qtf = 1
//
//   idf(cafe) = ln(1 + (3 - 2 + 0.5) / (2 + 0.5))
//             = ln(1 + 0.6) = ln(1.6) = 0.47000362924573563
//
//   query weight = ((8 + 1) * 1) / (8 + 1) = 1
//
//   D1: norm  = 1 - 0.75 + 0.75 * (2 / 2.333333) = 0.8928571428571428
//       denom = 1 + 1.2 * 0.8928571428571428     = 2.071428571428571
//       tf    = (1 * 2.2) / 2.071428571428571    = 1.0620689655172415
//       score = 0.47000362924573563 * 1.0620689655172415 * 1
//             = 0.49917626830236755
//
//   D2: norm  = 1 - 0.75 + 0.75 * (3 / 2.333333) = 1.2142857142857142
//       denom = 2 + 1.2 * 1.2142857142857142     = 3.4571428571428573
//       tf    = (2 * 2.2) / 3.4571428571428573   = 1.2727272727272727
//       score = 0.47000362924573563 * 1.2727272727272727 * 1
//             = 0.5981864372218454
//
//   D3: does not contain the term, so it scores 0.

const D1 = toks("cafe", "manha");
const D2 = toks("cafe", "cafe", "gelado");
const D3 = toks("restaurante", "almoco");
const CORPUS = [D1, D2, D3];
const QUERY = toks("cafe");

describe("buildCorpusStats", () => {
  it("counts documents, average length and document frequency", () => {
    const stats = buildCorpusStats(CORPUS);
    expect(stats.documentCount).toBe(3);
    expect(stats.averageLength).toBeCloseTo(7 / 3, 10);
    expect(stats.documentFrequency.get("cafe")).toBe(2);
    expect(stats.documentFrequency.get("gelado")).toBe(1);
  });

  it("counts a term once per document, however often it repeats inside one", () => {
    // "cafe" appears twice in D2 but D2 is still one document.
    expect(buildCorpusStats([D2]).documentFrequency.get("cafe")).toBe(1);
  });
});

describe("idf", () => {
  it("matches the hand calculation", () => {
    expect(idf("cafe", buildCorpusStats(CORPUS))).toBeCloseTo(0.47000362924573563, 12);
  });

  it("stays positive for a term that is in every document", () => {
    // The classic form goes negative here, and a negative score on screen
    // costs more trust than it could buy. See lib/bm25/score.ts.
    const everywhere = [toks("cafe"), toks("cafe"), toks("cafe")];
    expect(idf("cafe", buildCorpusStats(everywhere))).toBeGreaterThan(0);
  });

  it("stays positive on a two-document corpus where both contain the term", () => {
    const both = [toks("cafe", "manha"), toks("cafe", "gelado")];
    expect(idf("cafe", buildCorpusStats(both))).toBeGreaterThan(0);
  });
});

describe("scoreDocument", () => {
  const stats = buildCorpusStats(CORPUS);

  it("matches the hand calculation for D1", () => {
    expect(scoreDocument(QUERY, D1, stats, DEFAULT_BM25)).toBeCloseTo(0.49917626830236755, 12);
  });

  it("matches the hand calculation for D2", () => {
    expect(scoreDocument(QUERY, D2, stats, DEFAULT_BM25)).toBeCloseTo(0.5981864372218454, 12);
  });

  it("scores zero for a document with none of the query's terms", () => {
    expect(scoreDocument(QUERY, D3, stats, DEFAULT_BM25)).toBe(0);
  });

  it("ranks the longer document above the shorter one here, because it has the term twice", () => {
    const short = scoreDocument(QUERY, D1, stats, DEFAULT_BM25);
    const long = scoreDocument(QUERY, D2, stats, DEFAULT_BM25);
    expect(long).toBeGreaterThan(short);
  });

  it("b = 0 removes the length penalty, and then the extra occurrence wins by more", () => {
    const withPenalty =
      scoreDocument(QUERY, D2, stats, DEFAULT_BM25) - scoreDocument(QUERY, D1, stats, DEFAULT_BM25);
    const noPenalty =
      scoreDocument(QUERY, D2, stats, { ...DEFAULT_BM25, b: 0 }) -
      scoreDocument(QUERY, D1, stats, { ...DEFAULT_BM25, b: 0 });
    expect(noPenalty).toBeGreaterThan(withPenalty);
  });

  it("k1 controls how fast a repeated term stops helping", () => {
    // A small k1 saturates almost immediately, so a second occurrence adds
    // little. A large k1 keeps rewarding it.
    const gapSmallK1 =
      scoreDocument(QUERY, D2, stats, { ...DEFAULT_BM25, k1: 0.1 }) -
      scoreDocument(QUERY, D1, stats, { ...DEFAULT_BM25, k1: 0.1 });
    const gapLargeK1 =
      scoreDocument(QUERY, D2, stats, { ...DEFAULT_BM25, k1: 5 }) -
      scoreDocument(QUERY, D1, stats, { ...DEFAULT_BM25, k1: 5 });
    expect(gapLargeK1).toBeGreaterThan(gapSmallK1);
  });

  it("k3 only matters when the query repeats a term", () => {
    const once = toks("cafe");
    const twice = toks("cafe", "cafe");
    const lowK3 = { ...DEFAULT_BM25, k3: 0 };

    // With qtf = 1 the query weight is 1 whatever k3 is.
    expect(scoreDocument(once, D2, stats, DEFAULT_BM25)).toBeCloseTo(
      scoreDocument(once, D2, stats, lowK3),
      12,
    );
    // With qtf = 2 it is not.
    expect(scoreDocument(twice, D2, stats, DEFAULT_BM25)).not.toBeCloseTo(
      scoreDocument(twice, D2, stats, lowK3),
      6,
    );
  });
});

describe("rank", () => {
  const stats = buildCorpusStats(CORPUS);
  const items = [
    { item: "D1", tokens: D1 },
    { item: "D2", tokens: D2 },
    { item: "D3", tokens: D3 },
  ];

  it("orders by score, highest first", () => {
    const ordered = rank(items, QUERY, stats, DEFAULT_BM25).map((r) => r.item);
    expect(ordered).toEqual(["D2", "D1", "D3"]);
  });

  it("reordering needs nothing but tokens and parameters", () => {
    // The whole point of keeping ranking separate: this call takes no
    // analyzer, no worker and no corpus text, so moving a slider cannot
    // cost an analysis pass.
    const ordered = rank(items, QUERY, stats, { k1: 1.2, b: 0.75, k3: 8 });
    expect(ordered).toHaveLength(3);
  });
});
