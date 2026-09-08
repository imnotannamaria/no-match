"use client";

// One column. A and B render this with different props and nothing else:
// any behaviour that differed between them would be a bug by definition.

import { useState } from "react";
import { canEnableCaseSensitive, sanitizeOptions } from "@/lib/alyze/validate";
import type { AnalysisOptions } from "@/lib/alyze/types";
import { OPTION_COPY } from "@/lib/ladder/copy";
import type { BM25Params, Scored } from "@/lib/bm25/types";
import type { ColumnConfig, ColumnId, ColumnResult, DocResult } from "@/lib/columns";
import { Badge } from "@/app/components/entrepta/badge";
import { MenuSelect } from "@/app/components/menu-select";
import { useCountUp } from "@/app/components/use-count-up";

interface ColumnProps {
  id: ColumnId;
  config: ColumnConfig;
  result: ColumnResult | null;
  ranked: Scored<DocResult>[];
  /** How many documents the search ran against, for "3 of 4". */
  total: number;
  /** This column is re-analysing. Only ever true for the column that changed. */
  searching: boolean;
  /** How many more documents this column found than the other one. Null when there is nothing to compare against. */
  delta: number | null;
  onChangeConfig: (next: ColumnConfig) => void;
  onOpenPanel: (docId: string) => void;
}

const BM25_HELP: { key: keyof BM25Params; help: string; step: number }[] = [
  { key: "k1", help: "how fast repeating a word stops helping", step: 0.1 },
  { key: "b", help: "how much a long document is penalised", step: 0.05 },
  { key: "k3", help: "how much repeating a word in the search weighs", step: 0.5 },
];

const LANGUAGES = [
  { value: "portuguese", label: "portuguese", hint: "accents, and a stemmer that cuts hard" },
  { value: "english", label: "english", hint: "no accents, plurals are the usual break" },
];

export function Column({
  id,
  config,
  result,
  ranked,
  total,
  searching,
  delta,
  onChangeConfig,
  onOpenPanel,
}: ColumnProps) {
  const [paramsOpen, setParamsOpen] = useState(false);
  const { options, phrase, bm25 } = config;
  const caseSensitiveAllowed = canEnableCaseSensitive(options);

  function setOptions(next: AnalysisOptions) {
    onChangeConfig({ ...config, options: sanitizeOptions(next) });
  }

  const absent = result?.results.filter((r) => !r.matched) ?? [];
  const found = result ? ranked.length : null;
  const display = useCountUp(found);
  const topScore = ranked[0]?.score ?? 0;

  // What this column is running, in one line, so the two headers can be
  // compared without reading both sets of toggles.
  const enabled: string[] = OPTION_COPY.filter((option) => options[option.key]).map(
    (option) => option.key,
  );
  if (phrase) enabled.push("exact phrase");
  const signature = enabled.length > 0 ? enabled.join(" + ") : "defaults";

  return (
    <section
      aria-label={`configuration ${id}`}
      className="relative flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-colors duration-200 hover:border-[var(--border-strong)]"
    >
      {/* Re-analysing. The only wait in the app, and it belongs to one column. */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-px overflow-hidden">
        {searching && <div className="nm-sweep" />}
      </div>

      {result && (
        <span
          key={ranked.length}
          aria-hidden
          className="nm-flash pointer-events-none absolute inset-0 rounded-[var(--radius-lg)]"
        />
      )}

      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-5 py-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-[var(--fg-brand)] bg-[var(--bg-surface-brand)] font-serif text-[13px] leading-none text-[var(--fg-brand-hover)]"
          >
            {id}
          </span>
          <span className="truncate font-mono text-[11px] text-[var(--fg-muted)]">{signature}</span>
        </span>

        <MenuSelect
          label={`analysis language for column ${id}`}
          prefix="language:"
          value={options.language}
          options={LANGUAGES}
          onChange={(language) => setOptions({ ...options, language })}
        />
      </header>

      <div className="px-5 pt-5 pb-4">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
          <span
            className={`font-serif text-[64px] leading-[0.82] tracking-tight tabular-nums ${
              found === 0 ? "text-[var(--fg-muted)]" : "text-[var(--fg-primary)]"
            }`}
          >
            {display ?? "·"}
          </span>
          {delta !== null && delta > 0 && (
            <Badge variant="soft" color="brand" size="md" className="mb-1.5">
              +{delta} vs {id === "A" ? "B" : "A"}
            </Badge>
          )}
        </div>

        <p className="mt-2.5 font-mono text-[11.5px] text-[var(--fg-secondary)]">
          {result === null ? (
            "no search yet"
          ) : (
            <>
              of {total} {total === 1 ? "document" : "documents"} came back
              {absent.length > 0 && (
                <span className="text-[var(--fg-muted)]"> · {absent.length} missing</span>
              )}
            </>
          )}
        </p>
      </div>

      <div className="px-5 pb-4">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--fg-muted)]">
          analysis
        </p>

        <div className="flex flex-col gap-0.5">
          {OPTION_COPY.map(({ key, help }) => (
            <Toggle
              key={key}
              name={key}
              help={help}
              on={options[key]}
              disabled={key === "case_sensitive" && !caseSensitiveAllowed}
              onToggle={() => setOptions({ ...options, [key]: !options[key] })}
            />
          ))}
          <Toggle
            name="exact phrase"
            help="the words have to sit next to each other"
            on={phrase}
            onToggle={() => onChangeConfig({ ...config, phrase: !phrase })}
          />
        </div>

        {!caseSensitiveAllowed && (
          <p className="mt-2.5 rounded-[var(--radius-sm)] border border-[var(--fg-brand)] bg-[var(--bg-surface-brand)] px-2.5 py-2 font-sans text-[11.5px] leading-snug text-[var(--fg-primary)]">
            case_sensitive is blocked while stemming or remove_stopwords is on. Both of them
            compare in lowercase.
          </p>
        )}
      </div>

      {result?.emptyQueryNote && (
        <p
          role="status"
          className="mx-5 mb-4 rounded-[var(--radius-sm)] border border-[var(--fg-brand)] bg-[var(--bg-surface-brand)] px-2.5 py-2 font-sans text-[11.5px] leading-snug text-[var(--fg-primary)]"
        >
          {result.emptyQueryNote}
        </p>
      )}

      {result && (
        <div className="border-t border-[var(--border-subtle)] px-5 py-4">
          <h3 className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--fg-muted)]">
            found{ranked.length > 0 && ` · ${ranked.length}`}
          </h3>

          {ranked.length === 0 ? (
            <p className="font-sans text-[12px] text-[var(--fg-secondary)]">
              Nothing came back under this configuration.
            </p>
          ) : (
            <ol className="flex flex-col gap-0.5">
              {ranked.map(({ item, score }, index) => (
                <li key={item.doc.id}>
                  <div className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-baseline gap-2.5 rounded-[var(--radius-sm)] px-1.5 py-1.5">
                    <span
                      aria-hidden
                      className="font-mono text-[10px] tabular-nums text-[var(--fg-muted)]"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-sans text-[12.5px] text-[var(--fg-primary)]">
                        {item.doc.text}
                      </span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="shrink-0 font-mono text-[10px] text-[var(--fg-muted)]">
                          {item.doc.id}
                        </span>
                        <span
                          aria-hidden
                          className="h-px min-w-0 flex-1 bg-[var(--border-subtle)]"
                        >
                          <span
                            className="block h-px bg-[var(--nm-rail)]"
                            style={{
                              width: `${topScore > 0 ? Math.max(4, (score / topScore) * 100) : 0}%`,
                            }}
                          />
                        </span>
                      </span>
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-[var(--fg-secondary)]">
                      {score.toFixed(3)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {absent.length > 0 && (
        <div className="border-t border-[var(--border-subtle)] px-5 py-4">
          <h3 className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--fg-muted)]">
            missing · {absent.length}
          </h3>
          <ul className="flex flex-col gap-1">
            {absent.map((r) => (
              <li key={r.doc.id}>
                <button
                  type="button"
                  onClick={() => onOpenPanel(r.doc.id)}
                  className="group grid w-full grid-cols-[2px_minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--radius-sm)] py-2 pr-2 text-left transition-colors duration-150 hover:bg-[var(--bg-hover-soft)]"
                >
                  <span
                    aria-hidden
                    className="h-8 w-[2px] rounded-full bg-[var(--nm-rail)] transition-transform duration-200 ease-out group-hover:scale-y-110 group-hover:bg-[var(--fg-brand)]"
                  />
                  <span className="min-w-0 pl-1">
                    <span className="block truncate font-sans text-[12.5px] text-[var(--fg-secondary)] transition-colors duration-150 group-hover:text-[var(--fg-primary)]">
                      {r.doc.text}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[10.5px] text-[var(--fg-muted)]">
                      {r.doc.id} ·{" "}
                      {r.phraseOnlyMiss
                        ? "the words are here, just not next to each other"
                        : "see which stage dropped it"}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="font-mono text-[11px] text-[var(--fg-muted)] transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-[var(--fg-brand)]"
                  >
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto border-t border-[var(--border-subtle)] px-5 py-3">
        <button
          type="button"
          aria-expanded={paramsOpen}
          onClick={() => setParamsOpen((v) => !v)}
          className="rounded-[var(--radius-sm)] font-mono text-[11px] text-[var(--fg-muted)] transition-colors duration-150 hover:text-[var(--fg-primary)]"
        >
          <span aria-hidden className="mr-1.5 inline-block">
            {paramsOpen ? "−" : "+"}
          </span>
          ranking parameters
        </button>

        {paramsOpen && (
          <div className="mt-3">
            <p className="mb-2.5 font-sans text-[11.5px] leading-snug text-[var(--fg-muted)]">
              These change the order only. Nothing is analysed again.
            </p>
            <div className="flex gap-2">
              {BM25_HELP.map(({ key, help, step }) => (
                <label key={key} className="min-w-0 flex-1">
                  <span className="mb-1 block font-mono text-[11px] text-[var(--fg-secondary)]">
                    {key}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={step}
                    value={bm25[key]}
                    autoComplete="off"
                    onChange={(e) =>
                      onChangeConfig({ ...config, bm25: { ...bm25, [key]: Number(e.target.value) } })
                    }
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2 py-1.5 font-mono text-[12px] tabular-nums text-[var(--fg-primary)] outline-none transition-colors duration-150 focus-visible:border-[var(--fg-brand)]"
                  />
                  <span className="mt-1 block font-sans text-[10.5px] leading-tight text-[var(--fg-muted)]">
                    {help}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Toggle({
  name,
  help,
  on,
  disabled,
  onToggle,
}: {
  name: string;
  help: string;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onToggle}
      className={`grid grid-cols-[14px_minmax(0,140px)_minmax(0,1fr)] items-center gap-2.5 rounded-[var(--radius-sm)] px-1.5 py-1.5 text-left transition-colors duration-150 hover:bg-[var(--bg-hover-soft)] disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? "bg-[var(--bg-surface-brand)]" : ""
      }`}
    >
      <span
        aria-hidden
        className={`size-[13px] rounded-[4px] border transition-colors duration-150 ${
          on
            ? "border-[var(--fg-brand)] bg-[var(--fg-brand)]"
            : "border-[var(--border-strong)] bg-transparent"
        }`}
      />
      <span
        className={`truncate font-mono text-[12px] ${
          on ? "text-[var(--fg-primary)]" : "text-[var(--fg-secondary)]"
        }`}
      >
        {name}
        <span className="sr-only">{on ? ", on" : ", off"}</span>
      </span>
      <span className="truncate font-sans text-[11px] text-[var(--fg-muted)]">{help}</span>
    </button>
  );
}
