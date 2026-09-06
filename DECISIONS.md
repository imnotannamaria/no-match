# Decisions

Non-obvious calls, in the order they were made. When one of these changes, update the entry instead of leaving a stale one behind.

## Phase 1

### alyze commit

Pinned to `1de437c8604b751f26e7061070b9d2b35aebdc73`, `trunk` branch, dated 2026-07-16. That is the commit `wasm/` was built from. Regenerating the artifact means bumping this line on purpose, not automatically.

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
