// BM25 decides the order of results after the matching set is already
// settled. It never decides whether a document comes back: that is
// lib/search/match.ts. See CLAUDE.md, "BM25".

export interface BM25Params {
  /** How fast term frequency saturates. */
  k1: number;
  /** How much document length penalizes. */
  b: number;
  /** How much a repeated term in the query weighs. */
  k3: number;
}

/** Defaults matching turbopuffer's documented full_text_search parameters. */
export const DEFAULT_BM25: BM25Params = { k1: 1.2, b: 0.75, k3: 8.0 };

/**
 * Everything about the corpus that scoring needs. Computed once from the
 * analyzed tokens, and reused for every parameter change: moving k1, b or
 * k3 must never send anything back to the analyzer.
 */
export interface CorpusStats {
  documentCount: number;
  averageLength: number;
  /** How many documents contain each term. */
  documentFrequency: Map<string, number>;
}

export interface Scored<T> {
  item: T;
  score: number;
}
