# Decisions

Non-obvious calls, in the order they were made. When one of these changes, update the entry instead of leaving a stale one behind.

## Phase 1

### alyze commit

Pinned to `1de437c8604b751f26e7061070b9d2b35aebdc73`, `trunk` branch, dated 2026-07-16. That is the commit `public/wasm/` was built from. Regenerating the artifact means bumping this line on purpose, not automatically.

### wasm-pack target: `web`

Used their own `wasm/build.sh`, unchanged: `wasm-pack build --target web --release --out-name alyze --out-dir pkg`. The `web` target produces a plain ES module whose default export is an async `init()` that resolves the `.wasm` file's URL from its own `import.meta.url`. That pairs directly with a module worker (`new Worker(url, { type: "module" })`), no bundler-specific glue needed on our side.

### The artifact lives in `public/wasm/`, not `wasm/`

`public/wasm/alyze.js`, `alyze_bg.wasm`, `alyze.d.ts` (kept for reference, not imported) and `LICENSE`. Served by URL, outside Turbopack. The worker loads it with `import(/* webpackIgnore: true */ "/wasm/alyze.js")`, which both webpack and Turbopack leave untouched at build time. This is the same reason `target: web` was picked: the file resolves its own `.wasm` sibling from where it's served, so the two files just need to sit next to each other in `public/`, nothing else to wire up.

CLAUDE.md originally described a top-level `wasm/` folder as the committed home for the artifact. That was written before this decision. `public/wasm/` is correct; there is no `wasm/` directory in this project.

### Worker: ES module worker

`new Worker(new URL("../../workers/analyzer.ts", import.meta.url), { type: "module" })`. Matches the `web` target's output, which is itself an ES module. Verified working in both `npm run dev` (Turbopack) and a real `npm run build` + `npm run start`, per CLAUDE.md's phase 1 exit criteria.

### Language restriction is UI-only, not build-only

The plan going in was to maybe compile only `portuguese` and `english` support to keep the artifact small. Checked: `alyze`'s `Cargo.toml` has no `[features]` section, so there is no way to cut languages at compile time without patching their Rust, which this project doesn't do (see CLAUDE.md, "Do not write Rust in this project"). Turned out not to matter anyway: the full build with all 18 languages' stemmers and stopword lists is 392 KB uncompressed. Small enough that there is nothing to trade off.

So: the wasm module ships all 18 languages. The v1 language picker in the UI only offers `portuguese` and `english`. That is a restriction in `lib/alyze` and the components, not in what got compiled.

### Licensing

`alyze`'s workspace also contains `alyze-features`, which is Apache-2.0 (the rest of the repo is MIT). Checked `cargo tree` from `wasm/`: `alyze-features` is not a dependency of `alyze-wasm`, so nothing Apache-2.0 licensed is in the compiled artifact. `public/wasm/LICENSE` is `alyze`'s MIT license, copied alongside the binary it covers.

## Phase 2

### Matching is OR

A document matches if it shares at least one token with the query, not all of them. Asked directly, and OR is the answer: `ausentes` means zero tokens in common with the query, not "missing at least one of several." See CLAUDE.md, "Matching".

### Exact phrase search, because it turned out cheap

Went in expecting to skip this unless it was simple. It was: `alyze` already returns each token's position, and the project already keeps position gaps from filtered tokens on purpose (see CLAUDE.md, "alyze"). Phrase matching is exactly the thing that data is for. `lib/search/match.ts` compares position deltas between the query's tokens and a candidate run of the document's tokens, so a stopword dropped identically from both sides doesn't break the phrase, but a real word sitting between the query's terms in the document correctly does. No change to the corpus data model, no new WASM call. One checkbox in the UI, "frase exata."

### No corpus size limit

The design canvas had a slot for a corpus limit note. Asked, and there was no reasoning behind it beyond the mockup needing something in that space. Phase 2's matching is one analysis pass per document per search, which is cheap regardless of corpus size. No limit added. Revisit this in phase 3: the stage ladder runs the analyzer several times per document per query, and that is where a large pasted corpus could actually get slow enough to matter.

### Vitest installed

`lib/search/match.ts` and `lib/alyze/validate.ts` are pure functions over already-analyzed tokens, no WASM dependency, so they run under plain Node with no browser and no worker. `vitest.config.mts` aliases `@` to the repo root to match `tsconfig.json`. Config is `.mts` on purpose: Vite's native config loader warns about ESM syntax in a `.ts` file loaded as CommonJS otherwise, since the project itself isn't `"type": "module"`.

The end-to-end path (WASM to worker to match) stays covered by a Playwright smoke test against the running app, not by the Vitest suite. Vitest tests the logic; the smoke test proves the pipeline is actually wired together, in both `npm run dev` and a real `npm run build` + `npm run start`.

## Phase 3

### The ladder is context-free

The five stages always walk `S0` to `S4` in the fixed order CLAUDE.md documents, regardless of what a column's active options actually are. The active options only decide which documents are absent in the first place (`lib/search/match.ts`); the ladder explains it independently, by calling `analyze()` on a single word at each stage. This turned out to have a nice side effect: I don't need to separately account for what's "currently on" in the column to classify a pair. See "disappeared" below for why.

### Classifying converge vs. disappeared vs. never

For a (query word, document word) pair, walk all 5 stages and track two things: the first stage where both sides are alive and textually equal (`convergeIndex`), and the first stage where the document word goes from alive to dropped (`dropIndex`, only `remove_stopwords` can do this in this model; `stemming` and `ascii_folding` only transform text, `max_token_length` is handled separately, see below).

`convergeIndex`, when it exists, is structurally always before `dropIndex`, because the match check requires both sides alive. A dropped (null) token can never equal anything. That means:

- Both exist -> `disappeared`. The document word is textually identical to the query word at an early stage, but a later stage drops it. In practice this only happens when the shared word is a stopword and the user is literally searching for it.
- Only `convergeIndex` exists -> `converge`, at that stage. The café / cafe case: `converge` at S4.
- Neither exists -> `never`. Different words, not a configuration issue.

One document gets one `LadderExplanation` per query word, not one collapsed verdict for the whole document. Under OR matching, every query word failed to match anything in an absent document, so each gets its own story; collapsing to a single "best" word would hide the others. This is a small, deliberate departure from the design canvas, which shows one ladder table per panel open. The design predates having working search and ladder code, and showing every query word's story is more honest than picking one and hiding the rest. Panel layout is a phase 5/6 concern; the data model here isn't going to change to fit a single-table view.

### A real finding: stemming runs before folding, and that can un-converge two forms of the same word

Verified against the running app, not assumed. Query "manha" (no accent) against document "manhã" (accented), both under the ladder's fixed cascade, language portuguese:

| stage | manha | manhã |
|---|---|---|
| S0–S2 | manha | manhã |
| S3 (+ stemming) | `manh` | manhã (unchanged) |
| S4 (+ ascii_folding) | manh | `manha` |

The Portuguese stemmer strips the final vowel from "manha" (an unaccented word matching its suffix rules) but leaves "manhã" untouched. The accent means it doesn't match the same pattern. Because `ascii_folding` runs after stemming (CLAUDE.md, "alyze"), by the time "manhã" gets folded to "manha", "manha" (the query) has already been stemmed down to "manh". They never converge, correctly, per the ladder's own rules. It's a real example of two forms of what a person would call the same word ending up classified `never`, because of pipeline order, not because the ladder is wrong. Left as `never`; the ladder is reporting the pipeline honestly. `correr`/`correu` is used as the stemming test case instead of an accented pair, specifically to keep that test from tripping over this interaction.

### Query that becomes empty after analysis

Typing a whole query that's entirely stopwords (or entirely over `max_token_length`) makes the live, analyzed query zero tokens. That's different from an empty search box, and different from "no documents matched": there is nothing to compare against any document. `lib/search/empty-query.ts` checks this before running any per-document search: if `remove_stopwords` is on and re-analyzing with it off produces tokens, blame stopwords by name; otherwise point at `max_token_length`. Verified: searching "da" with `remove_stopwords` on and `language: portuguese` (a real Portuguese stopword) correctly stops before the ladder ever runs, with a message naming the reason.

### Exact phrase gets its own answer, decided outside the ladder

A document can hold every word of the query and still be absent, because exact phrase order removed it. The ladder cannot see that: it compares one query word against one document word, and from where it stands every word converges. Left alone it reports five stages of `match` on a document listed as absent, and tells the reader to turn an option on. Every statement in that panel is wrong.

`evaluateDocument` in `lib/search/match.ts` is the only place that can know, because it is the only place holding both results on the same tokens: the phrase result that removed the document, and the OR result that would have kept it. When phrase removed it and OR would not have, it sets `phraseOnlyMiss`, and the ladder is told rather than left to guess.

The panel then leads with the phrase explanation and still shows the per-word tables underneath, because those tables are the proof the words really are all there. Pinned by tests in `lib/search/match.test.ts`.

### max_token_length stays separate

`lib/ladder/max-length.ts` checks byte length against the active `max_token_length` independently of the ladder classification, and the UI shows it alongside a `never` verdict rather than instead of it. A document can simultaneously have "no word here is even close" and, separately, a search term too long to ever become a token. Verified with a 48-byte all-ASCII word against the default 39-byte limit.
