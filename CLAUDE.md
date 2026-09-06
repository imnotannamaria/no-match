# nomatch

A tool that answers one question: why didn't this document show up in my search?
It runs entirely in the browser, on top of `alyze` compiled to WebAssembly. No server, no account, no network call to anyone's product.

For what the tool is and who it is for, see [README.md](README.md). For why I am building it, see [docs/GOAL.md](docs/GOAL.md). This file covers conventions to follow when writing code here.

---

## Scope

The tool does five things. Nothing else gets added without a line in `DECISIONS.md`.

1. Paste a corpus of text documents
2. Type a search
3. Pick two tokenizer configurations, A and B, side by side
4. See which documents come back under each, ranked by BM25
5. For the ones that did not come back, see which stage killed them and what to turn on

Step 5 is the product. Steps 1 to 4 exist to make it possible.

### What it does not do

Saying no to these is part of the job. If a request lands for any of them, say no and point here.

- No calls to the turbopuffer API. No network call to their product at all
- No accounts, no login, no persistence. State lives in the tab
- No file upload. Paste text, or load an example corpus
- No vector search, no embeddings, no hybrid search. Full text only
- No comparing three or more configurations. Two
- Not a clone of their `word_v4` playground, which already exists and analyzes one sentence with no search and no comparison

---

## Stack

What is actually installed, verified against `package.json`. When this drifts, fix the table.

| Layer | Tech |
| --- | --- |
| Framework | Next.js 16.3.4 (App Router) |
| Language | TypeScript, strict |
| Styling | Tailwind CSS v4 via `@tailwindcss/postcss` |
| Design system | entrepta, components copied in and owned as code, dark first |
| Lint | ESLint 9 with `eslint-config-next` |
| Package manager | npm |
| Analysis engine | `alyze`, Rust, compiled to WASM and committed under `wasm/` |
| Ranking | BM25, written here in TypeScript |
| Deploy | Vercel |

Not installed yet, and needed: Vitest, entrepta, the WASM artifact.

No global state manager. No fetch library. No backend. A new dependency needs a line in `DECISIONS.md` saying why.

---

## Architecture

Everything runs on the client. There is no server.

```
app/                     Next routes
components/              UI, built on entrepta
lib/
  alyze/                 typed wrapper around the WASM module
  ladder/                stage attribution
  bm25/                  scoring and ranking
  corpora/               example corpora, pt and en
workers/                 Web Worker hosting the WASM module
wasm/                    the compiled .wasm artifact, committed
docs/                    GOAL.md and the design canvas
```

The WASM module lives in a Web Worker. Running the ladder over a corpus on the main thread blocks it. **The interface never calls the WASM module directly.** Every call goes through the worker.

---

## alyze

Facts, verified in their repo and docs. Do not infer past this section.

- `github.com/turbopuffer/alyze`, MIT
- UAX #29 compatible tokenizer, a hand-written DFA
- Runs in production at turbopuffer behind the `word_v4` tokenizer
- `wasm/` exposes the analysis pipeline through `wasm-bindgen`
- The `alyze-wasm` crate is `publish = false`. There is no npm package. Clone, build, commit the result here
- `alyze` only tokenizes and analyzes. No BM25, no corpus, no index, no search

### Options and defaults

Names are `snake_case`, matching the `full_text_search` parameters in turbopuffer's API. That match is on purpose: the schema panel in the UI copies out a config a person can paste.

| Option | Default | What it does |
| --- | --- | --- |
| `case_sensitive` | `false` | When `false`, lowercases the tokens |
| `ascii_folding` | `false` | Replaces a non-ASCII character with its ASCII equivalent, `à` becomes `a` |
| `stemming` | `false` | Cuts a word back to its root, Snowball, per `language` |
| `remove_stopwords` | `false` | Drops common words, per `language` |
| `language` | `"english"` | Only affects stemming and stopwords |
| `max_token_length` | `39` | Drops a token longer than this, in bytes |

Stemming exists for 18 languages. Stopwords exist for all of them except `arabic`, `greek`, `romanian`, `tamil` and `turkish`. Portuguese has both. v1 ships `portuguese` and `english` only.

### Rules the code has to keep

- `stemming: true` and `remove_stopwords: true` both require `case_sensitive: false`. An invalid combination is blocked in the UI, not just rejected by the WASM module. The design has a note slot in each column for exactly this
- `ascii_folding` runs after stemming and stopwords, never before. The order is not negotiable
- `max_token_length` counts bytes, not characters. In Portuguese `ç`, `ã`, `õ` and `ê` are 2 bytes each. Every count in the UI is in bytes, with the character count beside it when the two differ
- A token from `alyze` carries the final text, the position, and the byte range of the raw token in the original text
- **Every word token spends a position, even when a filter drops it afterwards.** That is why positions have holes, and it is what keeps phrase distance correct. Render the holes, do not hide them

### Building the WASM artifact

1. Clone `turbopuffer/alyze`
2. Install Rust. The crate needs edition 2024 and Rust 1.85 or newer
3. `alyze` pulls in `ahash`, which depends on `getrandom`. On `wasm32-unknown-unknown`, `getrandom` needs an explicit backend. The crate already declares the `wasm_js` feature, and that has to be paired with `getrandom_backend="wasm_js"` in `.cargo/config.toml`. This is the most likely build failure in the project
4. Build with `wasm-pack`
5. Copy the result into `wasm/` and commit it

Record the exact `alyze` commit in `DECISIONS.md`. Regenerate the artifact on purpose, never automatically.

**Do not write Rust in this project.** Consume `alyze` as it is. If something looks like it needs a change in the Rust, that is a finding to report in their repo, not a patch to make here.

---

## The stage ladder

The heart of the project, and the only part that is not obvious.

`alyze` returns the final result of the analysis, not the steps. To find which step killed a match, run the analyzer several times with options turning on in cascade, then compare the outputs.

```
S0  tokenize only            case_sensitive: true
S1  + lowercase              case_sensitive: false
S2  + remove stopwords       remove_stopwords: true
S3  + stemming               stemming: true
S4  + ascii folding          ascii_folding: true
```

Stemming and stopwords only appear from S1 on, because of the `case_sensitive` rule above.

For one search token against one document token:

- **They converged at some stage.** The match needs that stage's option on. That is what the UI recommends
- **The document token disappeared at some stage.** That stage dropped it. Name the stage, and for a stopword name the word
- **They never converged.** Not a configuration problem. Different words

`max_token_length` is orthogonal to the ladder. Evaluate it separately, report it separately, always in bytes.

The ladder is expensive. It runs once per document per query, in the worker, never on every keystroke.

---

## BM25

Written here, in TypeScript, over the tokens `alyze` returns. It does not come from the library, because the library has no ranking in it.

BM25 decides the order of results after the matching set is already settled. Term frequency in the document pushes the score up. A document longer than average pushes it down.

Defaults, matching turbopuffer's documented ones:

- `k1` = `1.2`, how fast term frequency saturates
- `b` = `0.75`, how much document length penalizes
- `k3` = `8.0`, how much a repeated term in the query weighs

All three are adjustable in the UI, behind the `parameters` disclosure in each column, and the ranking reacts immediately.

Keep the implementation short and readable. The formula is public. The value here is that it is correct and explainable, not that it is clever.

---

## Design

The canvas is at [docs/design/nomatch.html](docs/design/nomatch.html). Open it before changing layout. It is the source of truth for what the screen does.

entrepta, dark first, theme `bosco` (blue `#2563eb`). Mono is the default UI font, serif for the big numbers and panel titles, sans only in long prose. Same editor language as the rest of my sites: `◆` for section marks, `//` for comments, a brand status bar pinned to the bottom.

The screen, top to bottom:

- Header: `nomatch.` with the brand dot, the question as a `//` comment, and the one-line lesson on the right, `o match é entre tokens, não entre palavras`
- The search input, wide and 22px, centered at 760px. Boot state is a shimmer that says what is loading: `abrindo o analisador · lista de stopwords + stemmer`
- Corpus panel on the left, 300px, collapsible into a vertical rail. Example picker, one textarea per document, add and remove
- Columns A and B in a two-track grid. Language select, the six toggles, the invalid-combination note, the parameters disclosure, then a 44px serif count, then the results, then `ausentes · N`
- Every absent row carries its reason inline, with a colored left border. Clicking one opens the panel
- Side panel, 560px, two tabs. The ladder table is `etapa / busca / documento / verdict`, one row per stage, with a verdict box under it and a button that turns the fixing option on. Blue rows are the simulation, options not currently on in that column
- Token tab: chips for query and document tokens, position holes included, with the bytes note under them
- Fixed bottom left: `◆ schema · full_text_search`, the config for both columns as JSON, with copy per column
- Status bar, 26px, brand fill, pinned

Interface copy is in Portuguese, because the problem is a Portuguese problem. Docs and code are in English.

**A badly written stage explanation is a bug**, not a caption. Interface text is the product here.

---

## Writing

For the README, docs, interface copy, commit messages, and anything generated in this repo.

- No em dashes
- Short sentences. Plain English in anything public
- No corporate filler. Nothing "seamless", "robust" or "powerful". No "I'm excited to"
- Explain the concept with a concrete example before naming the technical term. Someone using this tool may not know what tokenization is, and the tool should teach them
- Never say something is fast, powerful or smart. Show the result

---

## Phases

Each phase ends with something that works. Do not skip a phase. Do not start the next one with the previous one broken.

1. WASM compiled, in the worker, analyzing one sentence. Nothing else
2. Corpus, search, and the binary answer of matched or did not match
3. Stage attribution. This is where it becomes a product
4. BM25 and ranking
5. Side by side comparison of A and B
6. Example corpora in Portuguese and English, and polish

`DECISIONS.md` holds the non-obvious calls: the `alyze` commit, ladder decisions, rounding in BM25, any new dependency.

---

## Tests

Vitest. Cover what breaks quietly:

- The ladder, with known cases. `café` against `cafe`, a Portuguese stopword, a stemming root, a token over the byte limit
- Byte count against character count in accented text
- BM25 against numbers worked out by hand on a small corpus
- Invalid option combinations blocked before they reach the WASM module

The attribution is the product's central claim, and it is the first thing an interviewer will poke at. Write the tests that prove it.

---

## Conventions

- The UI never touches the WASM module directly. Everything goes through the worker
- The ladder runs per document per query, not per keystroke. Debounce, or run it when the query settles
- Every count shown to a person is in bytes, with characters beside it when they differ
- entrepta components are owned code. Edit them directly, do not wrap and override from outside
- Brand accents derive from `--fg-brand` with `color-mix()`. Never a hardcoded blue hex, or the theme stops reacting
- Mono is the default font. Reach for sans only in long prose
- Tailwind v4 scans Markdown, so a class written as an example in a doc gets compiled. Write it out in full, and never put a wildcard inside the brackets
- Before committing, run `npm run lint` and `npx tsc --noEmit`, and the tests once Vitest is in. A green commit is the baseline. Do not commit a red one without saying so

---

## Code review

When asked to review a branch or PR, review the full diff against `main`.

These are prompts to look, not a list to tick. A diff that touches none of them still deserves a read, and a rule that clearly does not apply is not a finding.

- **Attribution correctness.** This is the one to read the diff twice for. Does the ladder still run the stages in the documented order, with `ascii_folding` last? Does a change to one stage silently change what an earlier stage reported? Any change to `lib/ladder/` without a test that pins the verdict is the finding, even when the code looks right
- **Bytes against characters.** Every length, limit and count. `.length` on a JavaScript string is UTF-16 code units, which is neither bytes nor characters. A diff that compares a string length against `max_token_length` is a bug regardless of how it reads
- **Positions.** A filter that drops a token must still spend its position. Any code that compacts, reindexes, or renumbers positions after filtering breaks phrase distance and hides the holes the UI is supposed to show
- **Invalid combinations.** `stemming` or `remove_stopwords` with `case_sensitive: true` has to be unreachable in the UI, not merely rejected downstream. Check the toggle logic, not just the validator
- **Main thread.** Any WASM call outside the worker, and any ladder run wired to a keystroke rather than a settled query. Both are silent: the app works and then locks up on a corpus that is one size larger than the one you tested
- **Honesty.** Any new copy that claims parity with production behavior anywhere, or presents the BM25 here as someone else's. The README's first section is the standard, and it applies to interface text too
- **Scope.** Does the diff add something from the "what it does not do" list, or a third configuration column, or a dependency with no line in `DECISIONS.md`?
- **Reuse before invention.** A new panel that hand-rolls a card surface, a header, or a hover is re-implementing something that exists. The tell is inline styles that add up to the card class, or a `useState` doing what `:hover` does
- **Standardization.** Does this screen look like it belongs to the same tool as the rest? Column A and column B are the same component with different props, and any drift between them is a bug by definition. The second copy of a pattern is a warning, the third is a bug. When a diff adds copy number two, say so even if extracting is out of scope
- **Accessibility.** Real semantics over roles on divs, `aria-pressed` on the toggles, screen reader text for anything carried by color or a glyph alone. The absent rows lean on a colored left border, so the reason has to be in text as well as in the color. Contrast on top of `--fg-brand`, which is where white text fails first
- **Theme reactivity.** Grep the diff for hardcoded hexes. Every accent derives from `--fg-brand`
- **Interface copy.** Read every new string as a person who does not know what a token is. A stage explanation that names an option without saying what it does is a finding
- **Performance.** The ladder is the expensive thing in this app. Look for it running more often than once per document per query, and for work that could have been done once for the whole corpus being done per document
- **Overflow contracts.** Every row the diff adds with two children and `justify-between`: what happens when they stop fitting? "They fit" is not an answer. Tokens in the chip grid are user text and can be any length
- **Responsive.** Reason about 375px. The two columns stack, the corpus panel collapses, the side panel goes full width. Code-level checks only. Hand the visual pass to Anna, never drive a browser

Also run `npm run lint` and `npx tsc --noEmit` and report the result.

**What the checks cannot see.** If a diff changes rendered size, spacing or wrapping and nothing else, then lint, `tsc` and a green suite say almost nothing. Say so in the review, and hand back a concrete list: which screen, which element, which breakpoint, what changed in pixels. "Do a visual pass" is not that list.

Deliver the findings as a Markdown doc at the repo root, `CODE-REVIEW-<branch>.md`, uncommitted. Open with a production-readiness verdict, cite findings as `file:line` links, close with a prioritized action table (fix before merge, follow-up, future), and say explicitly which checks are left for the visual pass.
