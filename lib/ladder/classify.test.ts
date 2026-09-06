import { describe, expect, it } from "vitest";
import { classifyPair, buildLadderRows } from "@/lib/ladder/classify";

// Forms are hand-built here, matching what a real analyze() call against
// each stage returns -- verified empirically against the WASM module
// (see DECISIONS.md, phase 3) rather than assumed. Index order is
// [S0, S1, S2, S3, S4].

describe("classifyPair", () => {
  it("converges at S4: café (doc) only equals cafe (query) once ascii_folding is on", () => {
    const query = ["cafe", "cafe", "cafe", "cafe", "cafe"];
    const doc = ["café", "café", "café", "café", "cafe"];
    expect(classifyPair(query, doc)).toEqual({ kind: "converge", stage: "S4" });
  });

  it("converges at S1: only a case difference", () => {
    const query = ["cafe", "cafe", "cafe", "cafe", "cafe"];
    const doc = ["Cafe", "cafe", "cafe", "cafe", "cafe"];
    expect(classifyPair(query, doc)).toEqual({ kind: "converge", stage: "S1" });
  });

  it("converges at S3: correr and correu both stem to corr", () => {
    const query = ["correr", "correr", "correr", "corr", "corr"];
    const doc = ["correu", "correu", "correu", "corr", "corr"];
    expect(classifyPair(query, doc)).toEqual({ kind: "converge", stage: "S3" });
  });

  it("disappeared at S2: 'de' is a Portuguese stopword the query is also searching for literally", () => {
    const query = ["de", "de", "de", "de", "de"];
    const doc = ["de", "de", null, null, null];
    expect(classifyPair(query, doc)).toEqual({ kind: "disappeared", stage: "S2" });
  });

  it("never converges: different words, not a configuration issue", () => {
    const query = ["manha", "manha", "manha", "manh", "manha"];
    const doc = ["restaurante", "restaurante", "restaurante", "restaur", "restaurante"];
    expect(classifyPair(query, doc)).toEqual({ kind: "never", stage: null });
  });

  it("a stopword dropped from the document that was never equal to the query isn't a disappeared story", () => {
    // "da" is dropped starting S2, but the query is "manha" -- they were
    // never the same word, so dropping "da" is irrelevant to this pair.
    const query = ["manha", "manha", "manha", "manh", "manha"];
    const doc = ["da", "da", null, null, null];
    expect(classifyPair(query, doc)).toEqual({ kind: "never", stage: null });
  });
});

describe("buildLadderRows", () => {
  it("labels every stage and carries both forms through", () => {
    const query = ["cafe", "cafe", "cafe", "cafe", "cafe"];
    const doc = ["café", "café", "café", "café", "cafe"];
    const rows = buildLadderRows(query, doc);
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.stage)).toEqual(["S0", "S1", "S2", "S3", "S4"]);
    expect(rows.map((r) => r.verdict)).toEqual([
      "no-match",
      "no-match",
      "no-match",
      "no-match",
      "match",
    ]);
  });

  it("marks a dropped document word distinctly from a plain mismatch", () => {
    const query = ["de", "de", "de", "de", "de"];
    const doc = ["de", "de", null, null, null];
    const rows = buildLadderRows(query, doc);
    expect(rows.map((r) => r.verdict)).toEqual([
      "match",
      "match",
      "doc-dropped",
      "doc-dropped",
      "doc-dropped",
    ]);
  });
});
