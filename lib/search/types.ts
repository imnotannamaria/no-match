export interface MatchOptions {
  /**
   * When true, the document only matches if the query's tokens appear as a
   * contiguous run, in order. When false, a document matches if it shares
   * at least one token with the query (OR). See lib/search/match.ts.
   */
  phrase: boolean;
}

export interface MatchResult {
  matched: boolean;
  /** Query terms found in the document. Empty for a phrase match. */
  matchedTerms: string[];
}
