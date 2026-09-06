// Decides whether one document matches the query. This is a separate
// concern from ranking (lib/bm25, phase 4) and from explaining a miss
// (lib/ladder, phase 3): matching only answers yes or no.
//
// Both functions take already-analyzed tokens. Analyzing text is the
// worker's job (lib/alyze/client.ts); this module is pure and has no
// dependency on the WASM module, which is what keeps it cheap to test.

import type { Token } from "@/lib/alyze/types";
import type { MatchOptions, MatchResult } from "@/lib/search/types";

/**
 * A document matches if it shares at least one token with the query. This
 * is the OR behind "matched or did not match": a document with only one of
 * several query words still comes back.
 */
export function orMatch(queryTokens: Token[], docTokens: Token[]): MatchResult {
  const docTexts = new Set(docTokens.map((t) => t.text));
  const queryTexts = [...new Set(queryTokens.map((t) => t.text))];
  const matchedTerms = queryTexts.filter((text) => docTexts.has(text));
  return { matched: matchedTerms.length > 0, matchedTerms };
}

/**
 * A document matches if the query's tokens appear as a contiguous run, in
 * order. "Contiguous" is measured in position deltas, not array indices:
 * every word-like token spends a position even when a filter drops it
 * afterwards (see CLAUDE.md, "alyze"), so a stopword dropped from both the
 * query and the document at the same relative spot doesn't break the
 * phrase. That's the reason alyze keeps the gaps instead of compacting
 * positions after filtering.
 */
export function phraseMatch(queryTokens: Token[], docTokens: Token[]): MatchResult {
  if (queryTokens.length === 0) return { matched: false, matchedTerms: [] };

  const queryBase = queryTokens[0].position;

  for (let start = 0; start <= docTokens.length - queryTokens.length; start++) {
    if (docTokens[start].text !== queryTokens[0].text) continue;

    const docBase = docTokens[start].position;
    let allMatch = true;

    for (let j = 1; j < queryTokens.length; j++) {
      const doc = docTokens[start + j];
      const query = queryTokens[j];
      const sameText = doc.text === query.text;
      const sameGap = doc.position - docBase === query.position - queryBase;
      if (!sameText || !sameGap) {
        allMatch = false;
        break;
      }
    }

    if (allMatch) {
      return { matched: true, matchedTerms: queryTokens.map((t) => t.text) };
    }
  }

  return { matched: false, matchedTerms: [] };
}

export function matchDocument(
  queryTokens: Token[],
  docTokens: Token[],
  options: MatchOptions,
): MatchResult {
  return options.phrase ? phraseMatch(queryTokens, docTokens) : orMatch(queryTokens, docTokens);
}
