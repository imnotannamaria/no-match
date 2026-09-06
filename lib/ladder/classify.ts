// Pure classification logic: given one word's form at each of the 5 stages
// (query side and document side), decide how the pair relates. No WASM, no
// worker -- this is what lib/ladder/classify.test.ts exercises directly.

import { STAGES, type LadderKind, type LadderRow, type LadderVerdict, type StageId } from "@/lib/ladder/types";

export function buildLadderRows(
  queryForms: (string | null)[],
  docForms: (string | null)[],
): LadderRow[] {
  return STAGES.map((stage, i) => {
    const queryForm = queryForms[i];
    const docForm = docForms[i];
    let verdict: LadderVerdict;
    if (queryForm === null && docForm === null) verdict = "both-dropped";
    else if (queryForm === null) verdict = "query-dropped";
    else if (docForm === null) verdict = "doc-dropped";
    else if (queryForm === docForm) verdict = "match";
    else verdict = "no-match";
    return { stage: stage.id, label: stage.label, queryForm, docForm, verdict };
  });
}

/**
 * Classifies one (query word, document word) pair across the cascade.
 *
 * "disappeared" only fires when the pair genuinely matched at some early
 * stage and the document word is dropped later -- structurally, that drop
 * stage always comes after the match stage, because a dropped token (null)
 * can never satisfy the match check. In practice this only happens when
 * the document word is a stopword the query is also, literally, searching
 * for: S0/S1 have both sides equal (same raw or lowercased word), then S2
 * removes it once remove_stopwords turns on.
 */
export function classifyPair(
  queryForms: (string | null)[],
  docForms: (string | null)[],
): { kind: LadderKind; stage: StageId | null } {
  let convergeIndex: number | null = null;
  for (let i = 0; i < STAGES.length; i++) {
    if (queryForms[i] !== null && docForms[i] !== null && queryForms[i] === docForms[i]) {
      convergeIndex = i;
      break;
    }
  }

  let dropIndex: number | null = null;
  for (let i = 1; i < STAGES.length; i++) {
    if (docForms[i - 1] !== null && docForms[i] === null) {
      dropIndex = i;
      break;
    }
  }

  if (convergeIndex !== null && dropIndex !== null) {
    return { kind: "disappeared", stage: STAGES[dropIndex].id };
  }
  if (convergeIndex !== null) {
    return { kind: "converge", stage: STAGES[convergeIndex].id };
  }
  return { kind: "never", stage: null };
}
