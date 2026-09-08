// Two columns, A and B, are the same thing with different values. Nothing
// here knows which is which beyond its label: any behaviour that differed
// between them would be a bug by definition. See CLAUDE.md, review notes
// on standardization.

import { DEFAULT_OPTIONS, type AnalysisOptions, type Token } from "@/lib/alyze/types";
import { DEFAULT_BM25, type BM25Params, type CorpusStats } from "@/lib/bm25/types";
import type { ExampleDocument } from "@/lib/corpora/example-pt";

export type ColumnId = "A" | "B";
export const COLUMN_IDS: ColumnId[] = ["A", "B"];

export interface ColumnConfig {
  options: AnalysisOptions;
  phrase: boolean;
  bm25: BM25Params;
}

export interface DocResult {
  doc: ExampleDocument;
  /** Kept so ranking can re-run without going back to the analyzer. */
  tokens: Token[];
  matched: boolean;
  matchedTerms: string[];
  phraseOnlyMiss: boolean;
}

export interface ColumnResult {
  queryTokens: Token[];
  results: DocResult[];
  stats: CorpusStats;
  /** Set when the query analyzed down to nothing, which is not the same as no matches. */
  emptyQueryNote: string | null;
}

/**
 * A opens with the real defaults, everything off, which is the
 * configuration that returns nothing for an accented corpus. B opens with
 * ascii_folding on. The contrast between the two counts is the demo.
 */
export function initialConfigs(): Record<ColumnId, ColumnConfig> {
  return {
    A: {
      options: { ...DEFAULT_OPTIONS, language: "portuguese" },
      phrase: false,
      bm25: { ...DEFAULT_BM25 },
    },
    B: {
      options: { ...DEFAULT_OPTIONS, language: "portuguese", ascii_folding: true },
      phrase: false,
      bm25: { ...DEFAULT_BM25 },
    },
  };
}

export function otherColumn(id: ColumnId): ColumnId {
  return id === "A" ? "B" : "A";
}

export type BM25Key = keyof BM25Params;
