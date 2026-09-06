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

export interface DocumentVerdict extends MatchResult {
  /**
   * True when the document shares tokens with the query and exact phrase
   * order is the only thing that removed it. The words are all there, they
   * just are not next to each other, so no analysis stage is responsible
   * and the ladder must not blame one. See lib/ladder, and CLAUDE.md's
   * review note on attribution correctness.
   */
  phraseOnlyMiss: boolean;
}
