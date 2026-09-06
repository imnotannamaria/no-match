// max_token_length is orthogonal to the stage ladder: it drops a token
// before any of the five stages get to run on it, and it counts bytes, not
// characters. See CLAUDE.md, "alyze". Evaluated and reported separately.

import type { MaxLengthCheck } from "@/lib/ladder/types";

export function checkMaxLength(word: string, maxTokenLength: number): MaxLengthCheck {
  const bytes = new TextEncoder().encode(word).length;
  const chars = [...word].length;
  return { word, bytes, chars, exceeds: bytes > maxTokenLength };
}
