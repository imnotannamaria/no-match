// The configuration, shaped the way turbopuffer's full_text_search
// parameters are named. The point of the panel this feeds is that a person
// can read what the tool is doing and paste it somewhere useful, so the
// key names have to match exactly. See CLAUDE.md, "Options and defaults".

import type { AnalysisOptions } from "@/lib/alyze/types";

export interface FullTextSearchSchema {
  type: "string";
  full_text_search: {
    language: string;
    stemming: boolean;
    remove_stopwords: boolean;
    case_sensitive: boolean;
    ascii_folding: boolean;
    max_token_length: number;
  };
}

export function toSchema(options: AnalysisOptions): FullTextSearchSchema {
  return {
    type: "string",
    full_text_search: {
      language: options.language,
      stemming: options.stemming,
      remove_stopwords: options.remove_stopwords,
      case_sensitive: options.case_sensitive,
      ascii_folding: options.ascii_folding,
      max_token_length: options.max_token_length,
    },
  };
}

export function toSchemaJson(options: AnalysisOptions): string {
  return JSON.stringify(toSchema(options), null, 2);
}
