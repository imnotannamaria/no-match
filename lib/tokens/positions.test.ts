import { describe, expect, it } from "vitest";
import { withHoles } from "@/lib/tokens/positions";
import type { Token } from "@/lib/alyze/types";

function tok(text: string, position: number): Token {
  return { text, position, start: 0, end: 0 };
}

describe("withHoles", () => {
  it("returns one slot per token when nothing was dropped", () => {
    const tokens = [tok("o", 0), tok("café", 1), tok("da", 2)];
    expect(withHoles(tokens).map((s) => s.kind)).toEqual(["token", "token", "token"]);
  });

  it("shows a hole where a filter dropped a token that still spent its position", () => {
    // "O café da manhã" with remove_stopwords on: "o" and "da" are gone,
    // but positions 0 and 2 were spent and stay spent.
    const tokens = [tok("café", 1), tok("manhã", 3)];
    const slots = withHoles(tokens);
    expect(slots.map((s) => s.kind)).toEqual(["token", "hole", "token"]);
    expect(slots.map((s) => s.position)).toEqual([1, 2, 3]);
  });

  it("does not invent holes before the first surviving token", () => {
    // Position 0 was dropped, but there is nothing to anchor a leading hole
    // to, so the run starts at the first token that survived.
    const slots = withHoles([tok("café", 1)]);
    expect(slots).toHaveLength(1);
    expect(slots[0].kind).toBe("token");
  });

  it("handles several holes in a row", () => {
    const slots = withHoles([tok("café", 0), tok("manhã", 4)]);
    expect(slots.map((s) => s.kind)).toEqual(["token", "hole", "hole", "hole", "token"]);
  });

  it("is empty for no tokens", () => {
    expect(withHoles([])).toEqual([]);
  });
});

