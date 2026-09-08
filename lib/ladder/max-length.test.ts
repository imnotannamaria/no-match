import { describe, expect, it } from "vitest";
import { checkMaxLength } from "@/lib/ladder/max-length";

describe("checkMaxLength", () => {
  it("counts bytes, not characters: accented letters are 2 bytes each", () => {
    // c-a-f-é: é is 2 bytes in UTF-8, so 4 characters but 5 bytes.
    const result = checkMaxLength("café", 39);
    expect(result.chars).toBe(4);
    expect(result.bytes).toBe(5);
    expect(result.exceeds).toBe(false);
  });

  it("flags a token over the default limit of 39 bytes", () => {
    // Verified against the real WASM module: this 48-byte ASCII word is
    // dropped at the default limit and kept at 255. See docs/DECISIONS.md, phase 3.
    const word = "paralelepipedico".repeat(3);
    const result = checkMaxLength(word, 39);
    expect(result.bytes).toBe(48);
    expect(result.exceeds).toBe(true);
  });

  it("the same word does not exceed a high limit", () => {
    const word = "paralelepipedico".repeat(3);
    expect(checkMaxLength(word, 255).exceeds).toBe(false);
  });
});
