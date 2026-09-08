// Every word-like token spends a position, even when a filter drops it
// afterwards. That is why positions have holes, and it is what keeps
// phrase distance correct. CLAUDE.md is explicit that the interface has to
// render the holes rather than hide them, so this turns a token list into
// a list of slots with the gaps made visible.

import type { Token } from "@/lib/alyze/types";

export type PositionSlot =
  | { kind: "token"; position: number; token: Token }
  | { kind: "hole"; position: number };

/**
 * Expands a token list into one slot per position, from the first position
 * present to the last. A position with no token is a hole: a word that was
 * there, spent its place in the sequence, and was dropped by a filter.
 */
export function withHoles(tokens: Token[]): PositionSlot[] {
  if (tokens.length === 0) return [];

  const byPosition = new Map<number, Token>();
  for (const token of tokens) byPosition.set(token.position, token);

  const positions = tokens.map((t) => t.position);
  const first = Math.min(...positions);
  const last = Math.max(...positions);

  const slots: PositionSlot[] = [];
  for (let position = first; position <= last; position++) {
    const token = byPosition.get(position);
    slots.push(token ? { kind: "token", position, token } : { kind: "hole", position });
  }
  return slots;
}
