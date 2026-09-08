// BM25, written for this project in TypeScript over the tokens alyze
// returns. It is not turbopuffer's code and should not be read as a
// reference for how their production ranking behaves. It follows the
// documented meaning of k1, b and k3. See README.md and CLAUDE.md.
//
// Kept short on purpose. The formula is public; the value here is that it
// is correct and explainable, not that it is clever.

import type { Token } from "@/lib/alyze/types";
import type { BM25Params, CorpusStats, Scored } from "@/lib/bm25/types";

/** Document length is the number of tokens that survived analysis. */
export function documentLength(tokens: Token[]): number {
  return tokens.length;
}

export function buildCorpusStats(documents: Token[][]): CorpusStats {
  const documentFrequency = new Map<string, number>();

  for (const tokens of documents) {
    for (const term of new Set(tokens.map((t) => t.text))) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const total = documents.reduce((sum, tokens) => sum + documentLength(tokens), 0);

  return {
    documentCount: documents.length,
    averageLength: documents.length === 0 ? 0 : total / documents.length,
    documentFrequency,
  };
}

/**
 * The smoothed IDF, the same shape Lucene uses:
 *
 *   ln(1 + (N - n + 0.5) / (n + 0.5))
 *
 * The classic textbook form has the 1 outside the log, which goes negative
 * once a term appears in more than half the documents. On a corpus of five
 * pasted sentences that happens constantly, and a negative score on screen
 * costs more trust than it could ever buy in accuracy. The argument here is
 * always greater than 1, so the result is always positive.
 */
export function idf(term: string, stats: CorpusStats): number {
  const n = stats.documentFrequency.get(term) ?? 0;
  return Math.log(1 + (stats.documentCount - n + 0.5) / (n + 0.5));
}

function frequencies(tokens: Token[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token.text, (counts.get(token.text) ?? 0) + 1);
  }
  return counts;
}

export function scoreDocument(
  queryTokens: Token[],
  docTokens: Token[],
  stats: CorpusStats,
  params: BM25Params,
): number {
  const { k1, b, k3 } = params;
  const docFrequencies = frequencies(docTokens);
  const queryFrequencies = frequencies(queryTokens);
  const length = documentLength(docTokens);
  const lengthNorm =
    stats.averageLength === 0 ? 1 : 1 - b + b * (length / stats.averageLength);

  let score = 0;

  for (const [term, qtf] of queryFrequencies) {
    const tf = docFrequencies.get(term) ?? 0;
    if (tf === 0) continue;

    const saturation = (tf * (k1 + 1)) / (tf + k1 * lengthNorm);
    const queryWeight = ((k3 + 1) * qtf) / (k3 + qtf);
    score += idf(term, stats) * saturation * queryWeight;
  }

  return score;
}

/**
 * Orders an already-matched set. Takes analyzed tokens and parameters,
 * nothing else: no analyzer, no worker, no corpus text. That is what makes
 * moving a slider cost zero analysis calls.
 */
export function rank<T>(
  items: { item: T; tokens: Token[] }[],
  queryTokens: Token[],
  stats: CorpusStats,
  params: BM25Params,
): Scored<T>[] {
  return items
    .map(({ item, tokens }) => ({
      item,
      score: scoreDocument(queryTokens, tokens, stats, params),
    }))
    .sort((a, b) => b.score - a.score);
}
