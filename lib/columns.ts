// Two columns, A and B, are the same thing with different values. Nothing
// here knows which is which beyond its label: any behaviour that differed
// between them would be a bug by definition. See CLAUDE.md, review notes
// on standardization.

import { DEFAULT_OPTIONS, type AnalysisOptions, type Token } from "@/lib/alyze/types";
import { DEFAULT_BM25, type BM25Params, type CorpusStats } from "@/lib/bm25/types";
import type { Corpus, ExampleDocument } from "@/lib/corpora";

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
 * configuration that finds almost nothing. B opens with the one option
 * that brings the missing documents back for this corpus. The contrast
 * between the two counts is the demo, and it has to be there before
 * anyone clicks anything.
 */
export function initialConfigs(corpus: Corpus): Record<ColumnId, ColumnConfig> {
  const { language } = corpus;
  return {
    A: {
      options: { ...DEFAULT_OPTIONS, language },
      phrase: false,
      bm25: { ...DEFAULT_BM25 },
    },
    B: {
      options: { ...DEFAULT_OPTIONS, language, [corpus.fix]: true },
      phrase: false,
      bm25: { ...DEFAULT_BM25 },
    },
  };
}

export function otherColumn(id: ColumnId): ColumnId {
  return id === "A" ? "B" : "A";
}

export type BM25Key = keyof BM25Params;
