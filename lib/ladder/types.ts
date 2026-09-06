// The stage ladder: a fixed, five-stage cascade used to explain why one
// query word and one document word did or didn't end up as the same token.
// See CLAUDE.md, "The stage ladder". The cascade is context-free: it always
// walks S0 through S4 in this order, regardless of what a column's active
// options actually are. The active options only decide which documents are
// absent in the first place (lib/search/match.ts); the ladder explains it.

export type StageId = "S0" | "S1" | "S2" | "S3" | "S4";

export interface StageDef {
  id: StageId;
  label: string;
  caseSensitive: boolean;
  removeStopwords: boolean;
  stemming: boolean;
  asciiFolding: boolean;
}

export const STAGES: StageDef[] = [
  { id: "S0", label: "tokenize only", caseSensitive: true, removeStopwords: false, stemming: false, asciiFolding: false },
  { id: "S1", label: "+ lowercase", caseSensitive: false, removeStopwords: false, stemming: false, asciiFolding: false },
  { id: "S2", label: "+ remove stopwords", caseSensitive: false, removeStopwords: true, stemming: false, asciiFolding: false },
  { id: "S3", label: "+ stemming", caseSensitive: false, removeStopwords: true, stemming: true, asciiFolding: false },
  { id: "S4", label: "+ ascii folding", caseSensitive: false, removeStopwords: true, stemming: true, asciiFolding: true },
];

export type LadderVerdict = "match" | "no-match" | "query-dropped" | "doc-dropped" | "both-dropped";

export interface LadderRow {
  stage: StageId;
  label: string;
  queryForm: string | null;
  docForm: string | null;
  verdict: LadderVerdict;
}

export type LadderKind = "converge" | "disappeared" | "never";

export interface LadderExplanation {
  queryWord: string;
  /** The document word picked as the closest candidate. Null only when kind is "never" and nothing came close. */
  docWord: string | null;
  kind: LadderKind;
  /** For "converge": the stage where they first became equal. For "disappeared": the stage that dropped the document word. Null for "never". */
  stage: StageId | null;
  rows: LadderRow[] | null;
  /**
   * The word never made it into the search at all: the active options
   * dropped it from the query itself, so no document could match on it.
   * Reported instead of the ladder verdict, because "different words" is
   * not what happened.
   */
  droppedFromQuery: null | { reason: "stopword" | "length"; bytes: number };
}

/** One absent document, explained. */
export interface DocumentExplanation {
  /** The words are all here, just not adjacent. No stage is responsible. */
  phraseOnlyMiss: boolean;
  /** One story per query word. Kept even for a phrase miss: it is the proof the words really are all there. */
  words: LadderExplanation[];
}

export interface MaxLengthCheck {
  word: string;
  bytes: number;
  chars: number;
  exceeds: boolean;
}
