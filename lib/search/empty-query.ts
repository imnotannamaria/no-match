// A query can tokenize down to nothing: type a single stopword with
// remove_stopwords on, and there's nothing left to compare against any
// document. That's a different situation from an empty search box, and it
// deserves its own message: it is one of the moments the tool teaches the
// most. See CLAUDE.md.

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
      return `the search came out empty: every word you typed is a stopword in ${options.language}, and remove_stopwords drops all of them.`;
    }
  }

  return `the search came out empty after analysis. Check max_token_length (${options.max_token_length} bytes): it may be dropping your terms.`;
}
