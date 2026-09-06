import { describe, expect, it } from "vitest";
import { STAGE_COPY, VERDICT_COPY, convergeAdvice, stageLabel } from "@/lib/ladder/copy";
import { STAGES } from "@/lib/ladder/types";

// CLAUDE.md: "A stage explanation that names an option without saying what
// it does is a finding." These tests are the cheapest way to keep that
// from rotting back in.

describe("stage copy", () => {
  it("covers every stage in the cascade", () => {
    for (const stage of STAGES) {
      expect(STAGE_COPY[stage.id]).toBeDefined();
      expect(STAGE_COPY[stage.id].does.length).toBeGreaterThan(0);
    }
  });

  it("names the option for every stage that actually turns one on", () => {
    // S0 turns nothing on. Every other stage has to name its option.
    expect(STAGE_COPY.S0.option).toBe("");
    for (const id of ["S1", "S2", "S3", "S4"] as const) {
      expect(STAGE_COPY[id].option.length).toBeGreaterThan(0);
    }
  });

  it("advice for a real stage names the option, not just the stage id", () => {
    const advice = convergeAdvice("S4");
    expect(advice).toContain("ascii_folding");
    expect(advice).not.toMatch(/^S4/);
  });

  it("does not tell anyone to turn on something already on by default", () => {
    // S1 is case_sensitive: false, which is the default. Telling someone to
    // enable it is a dead end, so the advice has to say something else.
    expect(convergeAdvice("S1")).toContain("já é o padrão");
  });

  it("does not tell anyone to turn on an option at S0, where there is none", () => {
    expect(convergeAdvice("S0")).not.toContain("ligue");
  });

  it("labels a stage with its option so no bare id reaches a person", () => {
    expect(stageLabel("S4")).toBe("S4 · ascii_folding");
    expect(stageLabel("S0")).toBe("S0");
  });
});

describe("verdict copy", () => {
  it("translates every verdict the classifier can produce", () => {
    const verdicts = ["match", "no-match", "doc-dropped", "query-dropped", "both-dropped"] as const;
    for (const v of verdicts) {
      expect(VERDICT_COPY[v]).toBeDefined();
      expect(VERDICT_COPY[v]).not.toContain("-"); // no internal identifier leaking through
    }
  });
});
