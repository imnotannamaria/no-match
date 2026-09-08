"use client";

// Phase 5: two configurations side by side. The contrast between the two
// counts is the whole demo, so nothing here may make A and B behave
// differently: they are one component with different props.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzerClient } from "@/lib/alyze/client";
import type { AnalysisOptions, Token } from "@/lib/alyze/types";
import { evaluateDocument } from "@/lib/search/match";
import { explainEmptyQuery } from "@/lib/search/empty-query";
import { EXAMPLE_CORPUS_PT, type ExampleDocument } from "@/lib/corpora/example-pt";
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
import { Column } from "@/app/components/column";
import { CorpusPanel } from "@/app/components/corpus-panel";
import { SchemaPanel } from "@/app/components/schema-panel";
import { SidePanel } from "@/app/components/side-panel";
import { StatusBar, StatusBarItem } from "@/app/components/entrepta/status-bar";

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

type Ranked = Record<ColumnId, ReturnType<typeof rank<ColumnResult["results"][number]>>>;

export default function Home() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  const [docs, setDocs] = useState<ExampleDocument[]>(EXAMPLE_CORPUS_PT);
  const [corpusOpen, setCorpusOpen] = useState(true);
  const [query, setQuery] = useState("cafe");
  const [configs, setConfigs] = useState(initialConfigs);

  const [results, setResults] = useState<Record<ColumnId, ColumnResult> | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [panel, setPanel] = useState<OpenPanel | null>(null);
  const [explanation, setExplanation] = useState<DocumentExplanation | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const explainToken = useRef(0);

  useEffect(() => {
    analyzerClient.ready().then(
      () => setReady(true),
      (err: Error) => setBootError(err.message),
    );
  }, []);

  const setConfig = useCallback((id: ColumnId, next: ColumnConfig) => {
    setConfigs((prev) => ({ ...prev, [id]: next }));
  }, []);

  /**
   * Opening the panel is an event, so the work happens here rather than in
   * an effect. The snapshot is taken now, and `explainToken` drops the
   * result if another document was opened while this one was loading.
   */
  async function openPanel(id: ColumnId, docId: string) {
    const result = results?.[id];
    const target = result?.results.find((r) => r.doc.id === docId);
    if (!result || !target) return;

    const snapshot: OpenPanel = {
      columnId: id,
      docId,
      docText: target.doc.text,
      query,
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

  async function search() {
    setError(null);
    setSearching(true);
    setPanel(null);

    try {
      const entries = await Promise.all(
        COLUMN_IDS.map(async (id) => {
          const { options, phrase } = configs[id];
          const queryTokens = await analyzerClient.analyze(query, options);

          const analyzed = await Promise.all(
            docs.map(async (doc) => {
              const tokens = await analyzerClient.analyze(doc.text, options);
              return { doc, tokens };
            }),
          );

          const emptyQueryNote =
            queryTokens.length === 0 ? await explainEmptyQuery(query, options) : null;

          const columnResults = analyzed.map(({ doc, tokens }) => {
            const verdict =
              queryTokens.length === 0
                ? { matched: false, matchedTerms: [] as string[], phraseOnlyMiss: false }
                : evaluateDocument(queryTokens, tokens, { phrase });
            return { doc, tokens, ...verdict };
          });

          // Document frequency and average length are corpus-wide.
          const stats = buildCorpusStats(analyzed.map((a) => a.tokens));
          return [id, { queryTokens, results: columnResults, stats, emptyQueryNote }] as const;
        }),
      );

      setResults(Object.fromEntries(entries) as Record<ColumnId, ColumnResult>);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  // Ranking depends on analyzed tokens and parameters only. Moving k1, b or
  // k3 re-runs this and touches no worker.
  const ranked = useMemo<Ranked>(() => {
    const empty = { A: [], B: [] } as Ranked;
    if (!results) return empty;

    for (const id of COLUMN_IDS) {
      const result = results[id];
      const matched = result.results.filter((r) => r.matched);
      empty[id] = rank(
        matched.map((r) => ({ item: r, tokens: r.tokens })),
        result.queryTokens,
        result.stats,
        configs[id].bm25,
      );
    }
    return empty;
  }, [results, configs]);

  const fix: Fix | null = useMemo(() => {
    if (!panel || !explanation) return null;
    return suggestFix(explanation, panel.options, panel.phrase);
  }, [panel, explanation]);

  function handleApplyFix() {
    if (!panel || !fix) return;
    const source = configs[panel.columnId];
    const target = otherColumn(panel.columnId);
    const applied = applyFix(fix, panel.options, panel.phrase);
    setConfig(target, { ...source, options: applied.options, phrase: applied.phrase });
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] px-5 pt-5 pb-20 font-mono text-[var(--fg-primary)]">
      <header className="mb-5 flex flex-wrap items-baseline gap-4">
        <span className="font-serif text-[26px] tracking-tight">
          nomatch<span className="text-[var(--fg-brand)]">.</span>
        </span>
        <span className="text-[11px] text-[var(--fg-secondary)]">
          {"// por que esse documento não apareceu na minha busca?"}
        </span>
        <span className="ml-auto text-[11px] text-[var(--fg-muted)]">
          o match é entre tokens, não entre palavras
        </span>
      </header>

      <div className="mx-auto mb-2 max-w-[760px]">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <label
            htmlFor="query"
            className="text-[11px] uppercase tracking-[0.08em] text-[var(--fg-muted)]"
          >
            ◆ busca
          </label>
          <span className="truncate text-[11px] text-[var(--fg-muted)]">
            as duas colunas usam esta busca
          </span>
        </div>
        <input
          id="query"
          value={query}
          spellCheck={false}
          placeholder="digite a busca"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && ready && !searching) search();
          }}
          className="w-full rounded-[10px] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-3.5 font-mono text-[22px] text-[var(--fg-primary)] outline-none focus-visible:border-[var(--fg-brand)] focus-visible:shadow-[0_0_0_3px_var(--bg-surface-brand)]"
        />

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={search}
            disabled={!ready || searching}
            className="rounded-lg border border-[var(--fg-brand)] bg-[var(--fg-brand)] px-3.5 py-1.5 text-xs text-[var(--bg-canvas)] hover:bg-[var(--fg-brand-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {searching ? "buscando…" : "buscar"}
          </button>

          {bootError ? (
            <p role="alert" className="text-[11px] text-[var(--status-error-fg)]">
              o analisador não carregou: {bootError}. Sem ele nada aqui funciona.
            </p>
          ) : !ready ? (
            <p className="text-[11px] text-[var(--fg-secondary)]">
              abrindo o analisador · lista de stopwords + stemmer
            </p>
          ) : null}

          {error && (
            <p role="alert" className="text-[11px] text-[var(--status-error-fg)]">
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-col items-stretch gap-4 lg:flex-row lg:items-start">
        <CorpusPanel
          docs={docs}
          open={corpusOpen}
          onToggleOpen={() => setCorpusOpen((v) => !v)}
          onChangeDoc={(id, text) =>
            setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, text } : d)))
          }
          onRemoveDoc={(id) => setDocs((prev) => prev.filter((d) => d.id !== id))}
          onAddDoc={() =>
            setDocs((prev) => [...prev, { id: `doc-${prev.length + 1}`, text: "" }])
          }
        />

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
          {COLUMN_IDS.map((id) => (
            <Column
              key={id}
              id={id}
              config={configs[id]}
              result={results?.[id] ?? null}
              ranked={ranked[id]}
              onChangeConfig={(next) => setConfig(id, next)}
              onOpenPanel={(docId) => openPanel(id, docId)}
            />
          ))}
        </div>
      </div>

      <SchemaPanel configs={configs} />

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
        left={
          <>
            <StatusBarItem>nomatch</StatusBarItem>
            <StatusBarItem>bosco</StatusBarItem>
            <StatusBarItem>{docs.length} documentos</StatusBarItem>
          </>
        }
        right={
          <StatusBarItem>
            {results ? `A ${ranked.A.length} · B ${ranked.B.length}` : "nenhuma busca ainda"}
          </StatusBarItem>
        }
      />
    </div>
  );
}
