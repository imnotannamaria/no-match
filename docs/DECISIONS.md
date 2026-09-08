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

A document matches if it shares at least one token with the query, not all of them. Asked directly, and OR is the answer: `missing` means zero tokens in common with the query, not "missing at least one of several." See CLAUDE.md, "Matching".

### Exact phrase search, because it turned out cheap

Went in expecting to skip this unless it was simple. It was: `alyze` already returns each token's position, and the project already keeps position gaps from filtered tokens on purpose (see CLAUDE.md, "alyze"). Phrase matching is exactly the thing that data is for. `lib/search/match.ts` compares position deltas between the query's tokens and a candidate run of the document's tokens, so a stopword dropped identically from both sides doesn't break the phrase, but a real word sitting between the query's terms in the document correctly does. No change to the corpus data model, no new WASM call. One checkbox in the UI, "frase exata."

### No corpus size limit

The first sketch of the interface reserved space for a corpus limit note. Asked, and there was no reasoning behind it beyond the layout needing something there. Phase 2's matching is one analysis pass per document per search, which is cheap regardless of corpus size. No limit added. Revisit this in phase 3: the stage ladder runs the analyzer several times per document per query, and that is where a large pasted corpus could actually get slow enough to matter.

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

One document gets one `LadderExplanation` per query word, not one collapsed verdict for the whole document. Under OR matching, every query word failed to match anything in an absent document, so each gets its own story; collapsing to a single "best" word would hide the others. This is a small, deliberate departure from the first sketch, which showed one ladder table per panel open. That sketch predates having working search and ladder code, and showing every query word's story is more honest than picking one and hiding the rest. Panel layout is a phase 5/6 concern; the data model here isn't going to change to fit a single-table view.

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

## Phase 4

### IDF: the smoothed form, the same shape Lucene uses

`ln(1 + (N - n + 0.5) / (n + 0.5))`.

The classic textbook form puts the 1 outside the log, and goes negative as soon as a term appears in more than half the documents. This tool runs on corpora of five sentences someone pasted in, where that is not an edge case, it is Tuesday. A negative score rendered next to a result costs more trust than the extra precision could ever buy, and explaining it would take a paragraph the interface does not have.

The form above keeps the argument above 1 for any `n` between 0 and `N`, so the result is always positive. Pinned by a test on a corpus where every document contains the term.

### Document length is the tokens that survived analysis

Not the positions spent, which include the holes left by filtered tokens.

A document is not longer, in any sense that matters to ranking, because it happened to contain stopwords that were removed before indexing. The tokens that survived are the ones that can be matched, so they are the ones that should decide the length penalty. Counting the holes would penalize a document for words that were deliberately excluded.

The holes still matter, and still exist: phrase matching reads them, and the token view renders them. They just do not feed `avgdl`.

### Ranking is separated from analysis by construction, not by discipline

`lib/bm25/score.ts` takes analyzed tokens and parameters. No analyzer, no worker, no corpus text. The page holds the analyzed tokens in state after a search and recomputes the order with `useMemo` over `[lastSearch, bm25]`, so `k1`, `b` and `k3` cannot reach the worker even by accident.

Measured in the browser by counting `Worker.prototype.postMessage`: a search over the four example documents costs 5 calls per column, one for the query and one per document. Moving a ranking parameter afterwards costs 0, and the order changes on screen. With `b` at 0 a long document holding the term twice outranks a short one holding it once; at 0.75 and 1 the short one wins. The numbers match a calculation worked out by hand before the code existed, kept in `lib/bm25/score.test.ts`.

### Scores are shown to three decimals

Enough to separate two close documents in a small corpus, short enough for a narrow column.

## Phase 5

### entrepta, theme bosco

`npx @entrepta/cli@latest init --theme bosco`, then `add button badge input status-bar tabs`. Bosco is the blue this interface was sketched in, and its `--fg-brand` is `#2563eb`. The components land in `app/components/entrepta/` as owned code: they are edited directly rather than wrapped from outside.

New dependencies come with it: `clsx`, `tailwind-merge` and `class-variance-authority` for the `cn()` helper and variant definitions, `@radix-ui/react-slot` for `asChild`, `@radix-ui/react-tabs`, and `lucide-react` for the loading spinner. All of them arrived with the design system rather than being chosen separately.

Every colour in the new interface is a CSS custom property from that theme. There is no hardcoded hex in `app/`, so switching the theme changes the whole tool.

### The fix button writes into the other column

Decided before building. The tool is a comparison, so the button's job is to build the comparison that proves the fix, not to mutate the thing being inspected. Clicking it copies the opened column's configuration, applies the one change, and puts the result on the opposite side. The column you were reading keeps its `0`, the other one shows the count after the fix, and both are on screen together. The button names its destination.

Verified end to end: both columns at 1 for "cafe", open the panel from A, click, search again, A stays 1 and B becomes 3.

### The fix names the narrowest option that works, not the stage the cascade lands on

This one came out of running the founding example rather than reasoning about it.

The cascade is cumulative, so it can only report which prefix of the pipeline makes two words equal, never which single option is responsible. With `language: portuguese`, the Snowball stemmer strips the final vowel from both `cafe` and `café`, so both reduce to `caf` and the cascade converges at stemming, one stage before folding. The ladder was telling the truth and giving bad advice: stemming collapses whole families of words across the corpus, while `ascii_folding` only touches accents. Recommending the broader change because it happens to come first in a documented ordering is the wrong hammer.

`lib/ladder/explain.ts` now also asks the analyzer, for the winning pair, which single options switched on over the configuration in use actually make the two words equal. `suggestFix` prefers those, narrowest first, and falls back to the cascade stage when no single option does it. The ladder table still shows where the cascade converges, because that is true and worth seeing.

### The panel holds a snapshot, not a live reference

Opening the panel captures the query, the options, the tokens and the document text as they were for the search that produced the result. Nothing in the panel reads live state. That is what keeps an explanation tied to the question that produced it, and it is the structural version of the fix made in phase 3, where an explanation could outlive its search.

The work also runs from the click handler rather than an effect, since opening the panel is an event. A counter drops the result if a second document is opened while the first is still loading.

### The schema panel is desktop only

It is a fixed 400px panel, and at 375px there is nothing sensible to do with it that would not fight the columns for space. It renders from `lg` up. The configuration is still fully visible in the toggles at any width; the panel is a convenience for copying it out.

### 375px

Columns stack, the corpus panel becomes full width, the side panel goes full width, and the document does not scroll horizontally. Measured, not assumed: `scrollWidth` equals `clientWidth` at 375px. The status bar hides below `sm`, which is entrepta's own behaviour for that component.

### Colour rule, corrected to match how the theme actually works

`CLAUDE.md` said brand accents derive from `--fg-brand` with `color-mix()`. This build of entrepta does not work that way: it defines the brand tints per theme as rgba literals, `--bg-surface-brand` among them, so there is nothing to mix at the call site. The intent of the rule holds, and is what the code does: no hardcoded hex anywhere in `app/` or `lib/`, every colour a token, so changing the theme changes the whole tool. The rule text now describes the mechanism that exists rather than one that does not.

While checking it, two error messages were rendering in brand blue, which reads as information rather than failure. They use `--status-error-fg` now.

## Phase 6

### Two corpora, each failing for its own reason

Portuguese is the point of the project: `cafe` does not find `café` until accents are folded. English has no accents, so that failure is close to invisible there, which is exactly why the second corpus exists. What breaks in English is a plural: `cafes` does not find `cafe` until stemming is on.

So a corpus carries its own search and its own fix, and the picker swaps all three together. An English search against a Portuguese corpus would prove nothing. Column B opens with whichever option that corpus needs, so both corpora open on the same contrast, 1 against 3, for different reasons.

### The opening search runs on its own

The tool has 30 seconds to explain itself, and a screen of empty columns spends them. Once the analyzer reports ready, one search runs with the opening corpus, so the contrast is on screen before anyone touches anything. Measured at about 800ms from navigation to both counts rendered.

This does not weaken the rule that the ladder never runs on a keystroke. It runs once on arrival and once per corpus swap, both of which are single events, and the per-document explanation still waits for a click.

`runSearch` takes what to search rather than reading state, so the opening search and a corpus swap can run with values React has not committed yet. That removes a class of stale-closure bug rather than working around it.

### The README now describes a tool that exists

It said "nothing works yet", which stopped being true at phase 1 and would have been the first thing a reader saw. Every claim in it was re-checked against the running app. The one worth testing rather than asserting is that nothing leaves the browser: loading the page, running a search on text typed into it, and opening an explanation produces 25 requests, all to localhost, and zero to anywhere else.

## The interface is in English, and the corpus is not

The interface used to be in Portuguese, on the reasoning that the failure it demonstrates is a Portuguese failure. That reasoning was about the corpus, and it got applied to the wrong layer.

The corpus is where the language matters: `cafe` failing to find `café` needs an accented language to exist at all, and swapping the corpus to English swaps the failure to plurals rather than removing it. The chrome around it, the toggles, the stage explanations, the counts, is read by people deciding whether the tool taught them anything, and most of them do not read Portuguese. `<html lang>` was already `en`, and so were the docs, the code and the commits. The interface was the only thing arguing.

So: interface, docs, code and commits in English. Corpus in Portuguese and English, and the language picker stays.

## A toggle re-runs its column, typing still does not

The rule was that nothing runs without the search button. Under it, flipping `ascii_folding` changed the toggle and left the count from the previous configuration sitting above it, so the number on screen described a configuration that was no longer set. That is worse than slow.

The rule was about keystrokes: running the analyzer per character, or worse the ladder, is what it exists to prevent. A toggle is a single discrete choice, and re-running one column costs one analyze call per document plus one for the query, five calls on the example corpus. Measured against the thing it buys, which is watching `1` become `3` as you click, that is not a trade.

Typed text still waits for the button. Corpus edits still wait for the button, and the corpus header now says so when the two have drifted apart.

The re-run uses the query and documents the **last search committed to**, not what is currently in the boxes. Otherwise a half-typed document would reach column B and not column A, and the comparison would be between two different corpora.

Which changes count is decided by `needsReanalysis` in `lib/columns.ts`, not by the click handler. The first draft re-ran on any configuration change, which quietly included `k1`, `b` and `k3`, and sent a ranking parameter to the analyzer. That breaks the separation the whole project is about, and neither lint nor the type checker can see it, so it is pinned by tests in `lib/columns.test.ts` and re-measured in the browser: moving `b` costs 0 calls.

## Motion is CSS, and Radix owns the states that are hard

`transform` and `opacity` only, declared as keyframes in `app/globals.css`, with the reduced-motion block collapsing every one of them. No animation library.

The exception is enter and exit on the dialog and the dropdown, where the hard part is not the animation but keeping an element mounted while it leaves. Radix already tracks that as `data-state`, and entrepta's components are written against `tw-animate-css`, which is a stylesheet, not a runtime. Rewriting those class lists by hand would have meant diverging from the design system source to save a dependency that ships no JavaScript.

Three dependencies added, all of them the design system's own primitives: `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `tw-animate-css`.

## The side panel became a dialog

It used to be an aside pinned to the right edge, with no focus trap, no escape key, and a live page behind it. The panel exists to answer one question about one document under one configuration, and the page behind it had toggles that would rewrite the configuration under the reader while they read.

It is now the same entrepta dialog with a `drawer` variant: anchored right instead of centred, same focus trap, same escape, same overlay. The fix button applies the change and closes the drawer, because the point of the fix is seeing both counts next to each other, which cannot happen while a panel covers one of them.

## Fonts moved to next/font

`globals.css` opened with an `@import` from Google Fonts for three families. A CSS `@import` is discovered only after the stylesheet parses, and it blocks rendering. They are now loaded through `next/font`, self-hosted and preloaded, and Tailwind's `font-serif` and `font-mono` utilities were pointed at the same tokens through `@theme`.

That last part fixed a quiet bug: `font-serif` in a component was resolving to Tailwind's default Georgia stack, not Newsreader. The counts and titles had never rendered in the project's own serif.

Verified after the change: loading the page, running a search and opening an explanation makes zero requests to any host but `localhost`.
