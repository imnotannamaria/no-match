// A query can tokenize down to nothing: type a single stopword with
// remove_stopwords on, and there's nothing left to compare against any
// document. That's a different situation from an empty search box, and it
// deserves its own message -- it's one of the moments the tool teaches the
// most. See CLAUDE.md and antes-do-implementation.md.

import { analyzerClient } from "@/lib/alyze/client";
import type { AnalysisOptions } from "@/lib/alyze/types";

export async function explainEmptyQuery(
  rawQuery: string,
  options: AnalysisOptions,
): Promise<string | null> {
  if (rawQuery.trim().length === 0) return null;

  if (options.remove_stopwords) {
    const withoutStopwords = await analyzerClient.analyze(rawQuery, {
      ...options,
      remove_stopwords: false,
    });
    if (withoutStopwords.length > 0) {
      return `a busca ficou vazia: toda palavra digitada é uma stopword em ${options.language}, e remove_stopwords descarta todas.`;
    }
  }

  return `a busca ficou vazia depois da análise. verifique max_token_length (${options.max_token_length} bytes): pode estar descartando os termos.`;
}
