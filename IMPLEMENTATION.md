# Implementation

Six phases. Each one ends with something that works. No phase starts with the previous one broken.

This file is the checklist. `DECISIONS.md` is the record of what was chosen and why. `CLAUDE.md` is the standing rules every phase is checked against.

The diagrams behind these phases are in [public/board.png](public/board.png): what the tool is and how a request travels from the interface to the WASM module, what recalculates when, and the states the screen can be in.

| Phase | What it is | Status |
|---|---|---|
| 1 | WASM in the worker, analyzing one sentence | Not started |
| 2 | Corpus, search, matched or did not match | Not started |
| 3 | The stage ladder | Not started |
| 4 | BM25 and ranking | Not started |
| 5 | A against B | Not started |
| 6 | Corpora and polish | Not started |

---

## Checks every phase has to pass

These repeat. They are not listed again inside each phase.

- `npx tsc --noEmit` clean
- `npm run lint` clean
- `npm run test` green
- Works in `npm run dev` **and** in a real `npm run build` + `npm run start`. The build is half the test: the worker and the WASM module break exactly on the crossing between the two
- Zero console errors in the browser, checked, not assumed
- Any non-obvious choice written into `DECISIONS.md` in the same commit
- Any new dependency has a line in `DECISIONS.md` saying why
- Nothing from the "what it does not do" list in `CLAUDE.md` crept in
- Every count shown to a person is in bytes, with characters beside it only when the two differ
- Every string a person reads was read once as someone who does not know what a token is

---

## Phase 1. WASM in the worker

Compile `alyze`, commit the artifact, load it inside a Web Worker, analyze one sentence, show the tokens. No design system, no styling.

- [ ] The artifact is committed and the exact `alyze` commit is in `DECISIONS.md`
- [ ] `LICENSE` travels with the binary
- [ ] The UI never calls the WASM module directly, every call goes through the worker
- [ ] Byte ranges are the raw token's, before normalization, and are shown as such
- [ ] A WASM load failure is visible to the person, not just in the console
- [ ] The client rejects pending work if the worker cannot start

**Done when:** you type a sentence, the tokens appear with position and byte range, and it works in dev and in a served production build.

---

## Phase 2. Corpus, search, matched or did not match

Paste several documents, type a search, get yes or no per document. No ranking, no reasons, no second column.

- [ ] Matching is OR: a document sharing one token with the query comes back
- [ ] `ausentes` means zero tokens in common, and the count says so
- [ ] Exact phrase compares position deltas, not array indices, so a stopword dropped identically from both sides does not break the phrase
- [ ] A real word between the query's terms in the document does break the phrase
- [ ] The invalid combination (`stemming` or `remove_stopwords` with `case_sensitive: true`) is unreachable in the UI, not merely rejected downstream
- [ ] `café` against `cafe` returns zero, and turning on `ascii_folding` returns the document
- [ ] A test pins each of the above

**Done when:** the founding example works end to end over a corpus, with tests that fail if it stops working.

---

## Phase 3. The stage ladder

The part that turns this into a product. Run the analysis in cascade, compare, and say which stage killed the match.

- [ ] The cascade is S0 to S4 in the documented order, with `ascii_folding` last
- [ ] `max_token_length` is evaluated and reported separately, never folded into the cascade, always in bytes
- [ ] Four known cases pass in tests: an accent, a Portuguese stopword, a stemming root, a token over the byte limit
- [ ] The ladder runs once per document per query, behind an explicit action, never on a keystroke
- [ ] A query that analyzes down to zero tokens is caught before the ladder runs, and says why
- [ ] The verdict never contradicts the match result that produced it
- [ ] The explanation on screen always belongs to the current query and current options
- [ ] The recommendation names the option and says what it does, not just the stage id
- [ ] No internal identifier is printed to a person
- [ ] A query word dropped from the search is reported as dropped, not as a different word

**Done when:** every absent document gets a reason, the reason is true, and a person who has never heard the word "token" can act on it.

---

## Phase 4. BM25 and ranking

Score the matched set and order it. The set is already decided by phase 2; this only decides the order.

The board's middle panel is the check that matters here: tokenize and analyse depend on the text and the language, building the index depends on the same, matching depends on the query, and scoring depends on `k1`, `b` and the query. Nothing above the last row may re-run when only a ranking parameter moves.

- [ ] `k1` = `1.2`, `b` = `0.75`, `k3` = `8.0` as defaults, matching the documented turbopuffer parameters
- [ ] Scores match a calculation done by hand on a corpus of three documents, and that calculation is in the test
- [ ] Moving `k1`, `b` or `k3` reorders the list immediately and triggers zero analysis calls
- [ ] IDF never renders a negative score on screen, on a small corpus where the classic formula would go negative
- [ ] The IDF variant chosen and the document-length definition are both written into `DECISIONS.md` with the reasoning
- [ ] The implementation is short enough to read out loud and defend
- [ ] The README says plainly that this BM25 is written here and is not turbopuffer's code

**Done when:** the order reacts to the sliders immediately, the numbers are defensible by hand, and nothing re-analyzes when only a ranking parameter moved.

---

## Phase 5. A against B

Two columns, independent configurations, the side panel, the fix button, the schema JSON with copy.

- [ ] Column A and column B are the same component, different props
- [ ] The invalid combination is blocked in both columns, not just the first
- [ ] The fix button takes a document from absent to present in one click
- [ ] The schema panel copies a config that matches the `full_text_search` parameter names exactly
- [ ] Positions and their holes are rendered in the token view, not hidden. `CLAUDE.md` is explicit on this, and nothing has shown them since phase 1
- [ ] Every accent derives from `--fg-brand` with `color-mix()`, no hardcoded hex
- [ ] Real semantics, `aria-pressed` on the toggles, and anything carried by colour also carried in text
- [ ] Reasoned about 375px: the columns stack, the corpus panel collapses, the panel goes full width
- [ ] Every row with two children and `justify-between` has a stated answer for what happens when they stop fitting

Open question for this phase: the fix button turns an option on, but in which column? Turning it on where the reader opened the panel is direct, and destroys the side that was acting as the control. Always turning it on in B keeps the contrast that carries the demo, and reads oddly when the panel was opened from A.

**Done when:** two configurations sit side by side, the contrast between them tells the story, and the fix button closes the loop.

---

## Phase 6. Corpora and polish

Example corpora in Portuguese and English, the opening state, and the writing pass.

- [ ] The page opens with a corpus loaded, a search already typed, and the two columns already configured to show the problem
- [ ] Someone opens the URL, reads nothing, and understands the problem inside 30 seconds
- [ ] Every string has been through the writing rules: short sentences, no filler, concrete example before the technical term
- [ ] The README's first section is accurate: no turbopuffer account, no network call to their product, `alyze` is theirs from a named commit, the BM25 is mine
- [ ] Nothing anywhere claims parity with production behaviour
- [ ] Every claim in the README is one I verified

**Done when:** it explains itself with no narration. If it needs a sentence from you to land, it is not done.
