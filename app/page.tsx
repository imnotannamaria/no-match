"use client";

// Two configurations side by side. The contrast between the two counts is
// the whole demo, so nothing here may make A and B behave differently:
// they are one component with different props.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzerClient } from "@/lib/alyze/client";
import type { AnalysisOptions, Token } from "@/lib/alyze/types";
import { evaluateDocument } from "@/lib/search/match";
import { explainEmptyQuery } from "@/lib/search/empty-query";
import { CORPORA, CORPUS_PT, type Corpus, type ExampleDocument } from "@/lib/corpora";
import { buildCorpusStats, rank } from "@/lib/bm25/score";
import { explainDocument, extractRawWords } from "@/lib/ladder/explain";
import { applyFix, suggestFix, type Fix } from "@/lib/ladder/fix";
import type { DocumentExplanation } from "@/lib/ladder/types";
import {
  COLUMN_IDS,
  initialConfigs,
  otherColumn,
  type ColumnConfig,
  type ColumnId,
  type ColumnResult,
} from "@/lib/columns";
import { Button } from "@/app/components/entrepta/button";
import { StatusBar, StatusBarItem } from "@/app/components/entrepta/status-bar";
import { Column } from "@/app/components/column";
import { CorpusPanel } from "@/app/components/corpus-panel";
import { Onboarding } from "@/app/components/onboarding";
import { SchemaPanel } from "@/app/components/schema-panel";
import { SidePanel } from "@/app/components/side-panel";

/**
 * Everything the panel needs, captured when it opens. Holding a snapshot
 * rather than reading live state is what keeps an answer tied to the
 * question that produced it: changing a toggle afterwards cannot rewrite
 * the explanation under the reader.
 */
interface OpenPanel {
  columnId: ColumnId;
  docId: string;
  docText: string;
  query: string;
  options: AnalysisOptions;
  phrase: boolean;
  phraseOnlyMiss: boolean;
  queryTokens: Token[];
  docTokens: Token[];
}

/** What a search actually ran against, as opposed to what is on screen. */
interface Committed {
  query: string;
  docs: ExampleDocument[];
}

type Results = Record<ColumnId, ColumnResult | null>;
type Busy = Record<ColumnId, boolean>;

const NO_RESULTS: Results = { A: null, B: null };

/**
 * One column's half of a search. Analysis is per column because the
 * options are per column; document frequency and average length are
 * corpus-wide, so they are computed here rather than shared.
 */
async function analyzeColumn(
  query: string,
  docs: ExampleDocument[],
  config: ColumnConfig,
): Promise<ColumnResult> {
  const { options, phrase } = config;
  const queryTokens = await analyzerClient.analyze(query, options);

  const analyzed = await Promise.all(
    docs.map(async (doc) => ({ doc, tokens: await analyzerClient.analyze(doc.text, options) })),
  );

  const emptyQueryNote =
    queryTokens.length === 0 ? await explainEmptyQuery(query, options) : null;

  const results = analyzed.map(({ doc, tokens }) => {
    const verdict =
      queryTokens.length === 0
        ? { matched: false, matchedTerms: [] as string[], phraseOnlyMiss: false }
        : evaluateDocument(queryTokens, tokens, { phrase });
    return { doc, tokens, ...verdict };
  });

  return {
    queryTokens,
    results,
    stats: buildCorpusStats(analyzed.map((a) => a.tokens)),
    emptyQueryNote,
  };
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  const [corpus, setCorpus] = useState<Corpus>(CORPUS_PT);
  const [docs, setDocs] = useState<ExampleDocument[]>(CORPUS_PT.documents);
  const [query, setQuery] = useState(CORPUS_PT.query);
  const [corpusOpen, setCorpusOpen] = useState(true);
  const [configs, setConfigs] = useState(() => initialConfigs(CORPUS_PT));

  const [committed, setCommitted] = useState<Committed>({
    query: CORPUS_PT.query,
    docs: CORPUS_PT.documents,
  });
  const [results, setResults] = useState<Results>(NO_RESULTS);
  const [busy, setBusy] = useState<Busy>({ A: false, B: false });
  const [error, setError] = useState<string | null>(null);

  const [panel, setPanel] = useState<OpenPanel | null>(null);
  const [explanation, setExplanation] = useState<DocumentExplanation | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const explainToken = useRef(0);

  // One counter per column. Toggling options faster than the worker can
  // answer would otherwise let an older result land last.
  const runSerial = useRef<Record<ColumnId, number>>({ A: 0, B: 0 });

  /**
   * Runs one column against what the last search committed to, never
   * against unsaved corpus edits: A and B have to be looking at the same
   * documents or the comparison means nothing.
   */
  const runColumn = useCallback(
    async (id: ColumnId, input: Committed, config: ColumnConfig) => {
      const serial = ++runSerial.current[id];
      setBusy((prev) => ({ ...prev, [id]: true }));
      try {
        const next = await analyzeColumn(input.query, input.docs, config);
        if (serial !== runSerial.current[id]) return;
        setError(null);
        setResults((prev) => ({ ...prev, [id]: next }));
      } catch (err) {
        if (serial !== runSerial.current[id]) return;
        setError(err instanceof Error ? err.message : String(err));
        setResults((prev) => ({ ...prev, [id]: null }));
      } finally {
        if (serial === runSerial.current[id]) {
          setBusy((prev) => ({ ...prev, [id]: false }));
        }
      }
    },
    [],
  );

  /**
   * Takes what to search rather than reading state, so the opening search
   * and a corpus swap can run with values React has not committed yet.
   */
  const runSearch = useCallback(
    (input: Committed, withConfigs: Record<ColumnId, ColumnConfig>) => {
      setCommitted(input);
      setPanel(null);
      for (const id of COLUMN_IDS) void runColumn(id, input, withConfigs[id]);
    },
    [runColumn],
  );

  // The opening search fires as soon as the analyzer answers, so the two
  // counts are already on screen when someone arrives.
  useEffect(() => {
    analyzerClient.ready().then(
      () => {
        setReady(true);
        runSearch(
          { query: CORPUS_PT.query, docs: CORPUS_PT.documents },
          initialConfigs(CORPUS_PT),
        );
      },
      (err: Error) => setBootError(err.message),
    );
  }, [runSearch]);

  /**
   * A toggle is a discrete choice, so its column re-analyses immediately:
   * the count moving under your finger is the thing the tool is teaching.
   * Typed text is different, and still waits for the search button.
   */
  function setConfig(id: ColumnId, next: ColumnConfig) {
    setConfigs((prev) => ({ ...prev, [id]: next }));
    if (ready) void runColumn(id, committed, next);
  }

  function search() {
    runSearch({ query, docs }, configs);
  }

  /** Swapping corpus swaps the search and the language with it. The three
   * only tell a story together: an English search against a Portuguese
   * corpus proves nothing. */
  function pickCorpus(next: Corpus) {
    if (next.id === corpus.id) return;
    const nextConfigs = initialConfigs(next);
    setCorpus(next);
    setDocs(next.documents);
    setQuery(next.query);
    setConfigs(nextConfigs);
    runSearch({ query: next.query, docs: next.documents }, nextConfigs);
  }

  /**
   * Opening the panel is an event, so the work happens here rather than in
   * an effect. The snapshot is taken now, and `explainToken` drops the
   * result if another document was opened while this one was loading.
   */
  async function openPanel(id: ColumnId, docId: string) {
    const result = results[id];
    const target = result?.results.find((r) => r.doc.id === docId);
    if (!result || !target) return;

    const snapshot: OpenPanel = {
      columnId: id,
      docId,
      docText: target.doc.text,
      query: committed.query,
      options: configs[id].options,
      phrase: configs[id].phrase,
      phraseOnlyMiss: target.phraseOnlyMiss,
      queryTokens: result.queryTokens,
      docTokens: target.tokens,
    };

    const token = ++explainToken.current;
    setPanel(snapshot);
    setExplanation(null);
    setExplainError(null);
    setExplaining(true);

    try {
      const [queryWords, docWords] = await Promise.all([
        extractRawWords(snapshot.query),
        extractRawWords(snapshot.docText),
      ]);
      const next = await explainDocument(
        queryWords,
        docWords,
        snapshot.options,
        snapshot.phraseOnlyMiss,
      );
      if (token === explainToken.current) setExplanation(next);
    } catch (err) {
      if (token === explainToken.current) {
        setExplainError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (token === explainToken.current) setExplaining(false);
    }
  }

  // Ranking depends on analyzed tokens and parameters only. Moving k1, b or
  // k3 re-runs this and touches no worker.
  const ranked = useMemo(() => {
    const out = { A: [], B: [] } as Record<ColumnId, ReturnType<typeof rank<never>>>;
    for (const id of COLUMN_IDS) {
      const result = results[id];
      if (!result) continue;
      const matched = result.results.filter((r) => r.matched);
      out[id] = rank(
        matched.map((r) => ({ item: r, tokens: r.tokens })),
        result.queryTokens,
        result.stats,
        configs[id].bm25,
      ) as ReturnType<typeof rank<never>>;
    }
    return out;
  }, [results, configs]);

  const fix: Fix | null = useMemo(() => {
    if (!panel || !explanation) return null;
    return suggestFix(explanation, panel.options, panel.phrase);
  }, [panel, explanation]);

  /** Applies the fix to the other column and closes the panel, because the
   * point of the fix is seeing the two counts next to each other. */
  function handleApplyFix() {
    if (!panel || !fix) return;
    const source = configs[panel.columnId];
    const target = otherColumn(panel.columnId);
    const applied = applyFix(fix, panel.options, panel.phrase);
    setConfig(target, { ...source, options: applied.options, phrase: applied.phrase });
    setPanel(null);
  }

  const searched = results.A !== null || results.B !== null;
  const dirty =
    searched &&
    (query !== committed.query ||
      docs.length !== committed.docs.length ||
      docs.some((doc, i) => doc.text !== committed.docs[i]?.text));

  const counts = { A: results.A ? ranked.A.length : null, B: results.B ? ranked.B.length : null };
  const delta = (id: ColumnId) => {
    const other = counts[otherColumn(id)];
    if (counts[id] === null || other === null) return null;
    return counts[id] - other;
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      <div aria-hidden className="nm-backdrop" />

      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[color-mix(in_oklab,var(--bg-canvas)_78%,transparent)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-3 px-5 py-2.5">
          <span className="font-serif text-[19px] leading-none tracking-tight">
            nomatch<span className="text-[var(--fg-brand)]">.</span>
          </span>
          <nav aria-label="about this tool" className="flex items-center gap-1">
            <SchemaPanel configs={configs} />
            <Onboarding />
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-5 pb-24">
        <section className="nm-hero relative mx-auto w-full max-w-[820px] pt-14 pb-12 text-center sm:pt-20">
          <div aria-hidden className="nm-aurora" />

          <p className="nm-rise font-mono text-[11px] tracking-[0.14em] text-[var(--fg-muted)] uppercase">
            <span aria-hidden className="mr-1.5 text-[var(--fg-brand)]">
              ◆
            </span>
            full text search, running in this tab
          </p>

          <h1
            className="nm-rise mt-5 text-balance font-serif text-[clamp(32px,6.4vw,58px)] leading-[1.04] tracking-tight text-[var(--fg-primary)]"
            style={{ "--nm-delay": "60ms" } as React.CSSProperties}
          >
            Why didn’t this document{" "}
            <em className="text-[var(--fg-brand-hover)] italic">show up</em>?
          </h1>

          <p
            className="nm-rise mx-auto mt-5 max-w-[62ch] text-pretty font-sans text-[14.5px] leading-relaxed text-[var(--fg-secondary)]"
            style={{ "--nm-delay": "120ms" } as React.CSSProperties}
          >
            A search engine compares tokens, not words. Below, one search runs under two
            configurations at once. Open anything that went missing and this tells you which stage
            dropped it, and the single option that brings it back.
          </p>

          <div
            className="nm-rise mt-8"
            style={{ "--nm-delay": "180ms" } as React.CSSProperties}
          >
            <label htmlFor="query" className="sr-only">
              Search the corpus
            </label>
            <div className="relative">
              <input
                id="query"
                value={query}
                spellCheck={false}
                autoComplete="off"
                placeholder="type a search…"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && ready) search();
                }}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--bg-surface)] py-4 pr-[118px] pl-4 font-mono text-[20px] text-[var(--fg-primary)] transition-[border-color,box-shadow] duration-200 outline-none placeholder:text-[var(--fg-muted)] hover:border-[var(--fg-muted)] focus-visible:border-[var(--fg-brand)] focus-visible:shadow-[0_0_0_3px_var(--bg-surface-brand)]"
              />
              <div className="absolute top-1/2 right-2 -translate-y-1/2">
                <Button variant="primary" size="sm" onClick={search} disabled={!ready}>
                  Search
                </Button>
              </div>
            </div>

            <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
              <span className="font-mono text-[11px] text-[var(--fg-muted)]">corpus</span>
              {CORPORA.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={option.id === corpus.id}
                  onClick={() => pickCorpus(option)}
                  className={`rounded-[var(--radius-full)] border px-3 py-1 font-mono text-[11px] transition-colors duration-150 ${
                    option.id === corpus.id
                      ? "border-[var(--fg-brand)] bg-[var(--bg-surface-brand)] text-[var(--fg-primary)]"
                      : "border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div aria-live="polite" className="mt-3 min-h-5">
              {bootError ? (
                <p role="alert" className="font-mono text-[11.5px] text-[var(--status-error-fg)]">
                  The analyzer did not load: {bootError}. Nothing here works without it.
                </p>
              ) : !ready ? (
                <p className="font-mono text-[11.5px] text-[var(--fg-secondary)]">
                  opening the analyzer · stopword lists and stemmers…
                </p>
              ) : error ? (
                <p role="alert" className="font-mono text-[11.5px] text-[var(--status-error-fg)]">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <hr className="nm-divider mx-auto w-full max-w-[1240px]" />

        <section
          aria-label="the two configurations"
          className="nm-rise mx-auto mt-10 grid w-full max-w-[1240px] grid-cols-1 items-stretch gap-4 lg:grid-cols-2"
          style={{ "--nm-delay": "240ms" } as React.CSSProperties}
        >
          {COLUMN_IDS.map((id) => (
            <Column
              key={id}
              id={id}
              config={configs[id]}
              result={results[id]}
              ranked={ranked[id]}
              total={committed.docs.length}
              searching={busy[id]}
              delta={delta(id)}
              onChangeConfig={(next) => setConfig(id, next)}
              onOpenPanel={(docId) => openPanel(id, docId)}
            />
          ))}
        </section>

        <hr className="nm-divider mx-auto mt-12 mb-8 w-full max-w-[1240px]" />

        <CorpusPanel
          docs={docs}
          open={corpusOpen}
          dirty={dirty}
          onToggleOpen={() => setCorpusOpen((v) => !v)}
          onChangeDoc={(id, text) =>
            setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, text } : d)))
          }
          onRemoveDoc={(id) => setDocs((prev) => prev.filter((d) => d.id !== id))}
          onAddDoc={() => setDocs((prev) => [...prev, { id: `doc-${prev.length + 1}`, text: "" }])}
          onSearch={search}
        />
      </main>

      {panel && (
        <SidePanel
          columnId={panel.columnId}
          targetColumnId={otherColumn(panel.columnId)}
          docId={panel.docId}
          docText={panel.docText}
          explanation={explanation}
          loading={explaining}
          error={explainError}
          maxTokenLength={panel.options.max_token_length}
          queryRaw={panel.query}
          queryTokens={panel.queryTokens}
          docTokens={panel.docTokens}
          fix={fix}
          onApplyFix={handleApplyFix}
          onClose={() => setPanel(null)}
        />
      )}

      <StatusBar
        className="flex"
        left={
          <>
            <StatusBarItem>nomatch</StatusBarItem>
            <StatusBarItem className="hidden sm:inline-flex">alyze · wasm</StatusBarItem>
            <StatusBarItem className="hidden sm:inline-flex">
              {docs.length} documents
            </StatusBarItem>
          </>
        }
        right={
          <>
            {searched && (
              <StatusBarItem className="hidden sm:inline-flex">
                A {counts.A ?? "·"} · B {counts.B ?? "·"}
              </StatusBarItem>
            )}
            <StatusBarItem>
              built by{" "}
              <a
                href="https://annamaria.app"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:no-underline"
              >
                annamaria.app
              </a>
            </StatusBarItem>
          </>
        }
      />
    </div>
  );
}
