// Orchestrates the ladder against the real analyzer: extracts raw words,
// walks each one through the five stages, and picks the best explanation
// for one query word against one document. This is the expensive part --
// it runs once per document per query, never on a keystroke. See
// CLAUDE.md, "The stage ladder".

import { analyzerClient } from "@/lib/alyze/client";
import type { AnalysisOptions } from "@/lib/alyze/types";
import { buildLadderRows, classifyPair } from "@/lib/ladder/classify";
import { checkMaxLength } from "@/lib/ladder/max-length";
import {
  STAGES,
  type DocumentExplanation,
  type LadderExplanation,
  type FixableOption,
  type StageId,
} from "@/lib/ladder/types";

/** case_sensitive: true, nothing else on. The rawest form alyze can give a word: original case, no stopword or length filtering. */
const RAW_OPTIONS = {
  case_sensitive: true,
  ascii_folding: false,
  stemming: false,
  remove_stopwords: false,
  language: "english",
  max_token_length: 255,
} as const;

/** Every word alyze tokenizes out of `text`, in original case, nothing dropped. */
export async function extractRawWords(text: string): Promise<string[]> {
  const tokens = await analyzerClient.analyze(text, RAW_OPTIONS);
  return tokens.map((t) => t.text);
}

// One cache per page load: the same word showing up in several documents
// (or the stopword list) should only cost 5 analyze() calls once.
const formsCache = new Map<string, Promise<(string | null)[]>>();

function wordFormsAcrossStages(word: string, language: string): Promise<(string | null)[]> {
  const key = `${language}::${word}`;
  const cached = formsCache.get(key);
  if (cached) return cached;

  const promise = Promise.all(
    STAGES.map(async (stage) => {
      const tokens = await analyzerClient.analyze(word, {
        case_sensitive: stage.caseSensitive,
        ascii_folding: stage.asciiFolding,
        stemming: stage.stemming,
        remove_stopwords: stage.removeStopwords,
        language,
        max_token_length: 255, // orthogonal here; checked separately in max-length.ts
      });
      return tokens.length > 0 ? tokens[0].text : null;
    }),
  );
  formsCache.set(key, promise);
  return promise;
}

/** Clears the per-word form cache. Exposed for tests; the running app never needs this. */
export function clearFormsCache(): void {
  formsCache.clear();
}

/**
 * Which single options, switched on over the configuration in use, make
 * these two words equal. Answers "what do I turn on" directly, instead of
 * inferring it from where the cumulative cascade first converges.
 */
const FIXABLE: FixableOption[] = ["ascii_folding", "stemming"];

async function fixableBy(
  queryWord: string,
  docWord: string,
  options: AnalysisOptions,
): Promise<FixableOption[]> {
  const found: FixableOption[] = [];

  for (const option of FIXABLE) {
    if (options[option]) continue; // already on, so it cannot be the fix
    // stemming requires case_sensitive: false, and so does the comparison.
    const candidate = { ...options, [option]: true, case_sensitive: false };
    const [q, d] = await Promise.all([
      analyzerClient.analyze(queryWord, candidate),
      analyzerClient.analyze(docWord, candidate),
    ]);
    if (q.length > 0 && d.length > 0 && q[0].text === d[0].text) found.push(option);
  }

  return found;
}

function stageOrder(id: StageId | null): number {
  return id ? STAGES.findIndex((s) => s.id === id) : Infinity;
}

/**
 * Did the active options drop this word from the query itself? If so it
 * never took part in matching, and no document could have matched on it.
 * That is a different fact from "no document contains it".
 */
async function droppedFromQuery(
  word: string,
  options: AnalysisOptions,
): Promise<LadderExplanation["droppedFromQuery"]> {
  const tokens = await analyzerClient.analyze(word, options);
  if (tokens.length > 0) return null;

  const { bytes, exceeds } = checkMaxLength(word, options.max_token_length);
  return { reason: exceeds ? "length" : "stopword", bytes };
}

/**
 * Explains why one query word never matched any word in `docWords`.
 * Tries every document word as a candidate partner and keeps the best
 * story: a "disappeared" finding (an exact match a filter is eating) beats
 * a "converge" finding, and the cheapest converge stage wins among those.
 */
export async function explainQueryWord(
  queryWord: string,
  docWords: string[],
  options: AnalysisOptions,
): Promise<LadderExplanation> {
  const language = options.language;

  const [queryForms, dropped, docFormsList] = await Promise.all([
    wordFormsAcrossStages(queryWord, language),
    droppedFromQuery(queryWord, options),
    Promise.all(docWords.map((w) => wordFormsAcrossStages(w, language))),
  ]);

  let best: LadderExplanation | null = null;

  for (let i = 0; i < docWords.length; i++) {
    const { kind, stage } = classifyPair(queryForms, docFormsList[i]);
    if (kind === "never") continue;

    const candidate: LadderExplanation = {
      queryWord,
      docWord: docWords[i],
      kind,
      stage,
      rows: buildLadderRows(queryForms, docFormsList[i]),
      fixableBy: [],
      droppedFromQuery: dropped,
    };

    if (kind === "disappeared") return candidate;
    if (!best || stageOrder(stage) < stageOrder(best.stage)) best = candidate;
  }

  if (!best) {
    return {
      queryWord,
      docWord: null,
      kind: "never",
      stage: null,
      rows: null,
      fixableBy: [],
      droppedFromQuery: dropped,
    };
  }

  return { ...best, fixableBy: await fixableBy(queryWord, best.docWord!, options) };
}

/**
 * Explains a whole absent document: one LadderExplanation per query word.
 * Under OR matching, every query word failed to match anything in this
 * document -- that's what "absent" means -- so each one gets its own story
 * rather than collapsing to a single verdict for the document.
 *
 * `phraseOnlyMiss` comes from lib/search/match.ts, which is the only place
 * that can know it: it compares the phrase result against the OR result on
 * the same tokens. The ladder cannot work it out on its own, and must not
 * guess, or it blames a stage for something no stage did.
 */
export async function explainDocument(
  queryWords: string[],
  docWords: string[],
  options: AnalysisOptions,
  phraseOnlyMiss: boolean,
): Promise<DocumentExplanation> {
  const words = await Promise.all(
    queryWords.map((word) => explainQueryWord(word, docWords, options)),
  );
  return { phraseOnlyMiss, words };
}
