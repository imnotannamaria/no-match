"use client";

// One column. A and B render this with different props and nothing else:
// any behaviour that differed between them would be a bug by definition.

import { useState } from "react";
import { canEnableCaseSensitive, sanitizeOptions } from "@/lib/alyze/validate";
import type { AnalysisOptions } from "@/lib/alyze/types";
import { OPTION_COPY } from "@/lib/ladder/copy";
import type { BM25Params, Scored } from "@/lib/bm25/types";
import type { ColumnConfig, ColumnId, ColumnResult, DocResult } from "@/lib/columns";

interface ColumnProps {
  id: ColumnId;
  config: ColumnConfig;
  result: ColumnResult | null;
  ranked: Scored<DocResult>[];
  onChangeConfig: (next: ColumnConfig) => void;
  onOpenPanel: (docId: string) => void;
}

const BM25_HELP: { key: keyof BM25Params; help: string; step: number }[] = [
  { key: "k1", help: "quão rápido repetir a palavra para de ajudar", step: 0.1 },
  { key: "b", help: "quanto um documento longo é penalizado", step: 0.05 },
  { key: "k3", help: "quanto pesa repetir a palavra na busca", step: 0.5 },
];

export function Column({ id, config, result, ranked, onChangeConfig, onOpenPanel }: ColumnProps) {
  const [paramsOpen, setParamsOpen] = useState(false);
  const { options, phrase, bm25 } = config;
  const caseSensitiveAllowed = canEnableCaseSensitive(options);

  function setOptions(next: AnalysisOptions) {
    onChangeConfig({ ...config, options: sanitizeOptions(next) });
  }

  const absent = result?.results.filter((r) => !r.matched) ?? [];
  const count = result ? ranked.length : null;

  return (
    <section
      aria-label={`configuração ${id}`}
      className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--fg-muted)]">
          ◆ {id}
        </span>
        <label className="text-[11px] text-[var(--fg-secondary)]">
          <span className="sr-only">idioma da coluna {id}</span>
          <select
            value={options.language}
            onChange={(e) => setOptions({ ...options, language: e.target.value })}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--fg-secondary)] outline-none focus-visible:border-[var(--fg-brand)]"
          >
            <option value="portuguese">language: portuguese</option>
            <option value="english">language: english</option>
          </select>
        </label>
      </header>

      <div className="mb-2.5 flex flex-col gap-0.5">
        {OPTION_COPY.map(({ key, help }) => {
          const on = options[key];
          const disabled = key === "case_sensitive" && !caseSensitiveAllowed;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => setOptions({ ...options, [key]: !on })}
              className="grid grid-cols-[18px_minmax(0,150px)_1fr] items-baseline gap-2 rounded px-1 py-0.5 text-left hover:bg-[var(--bg-hover-soft)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span aria-hidden className={on ? "text-[var(--fg-brand)]" : "text-[var(--fg-muted)]"}>
                {on ? "●" : "○"}
              </span>
              <span
                className={`truncate text-xs ${on ? "text-[var(--fg-primary)]" : "text-[var(--fg-secondary)]"}`}
              >
                {key}
                <span className="sr-only">{on ? ", ligado" : ", desligado"}</span>
              </span>
              <span className="truncate text-[11px] text-[var(--fg-muted)]">{help}</span>
            </button>
          );
        })}

        <button
          type="button"
          aria-pressed={phrase}
          onClick={() => onChangeConfig({ ...config, phrase: !phrase })}
          className="grid grid-cols-[18px_minmax(0,150px)_1fr] items-baseline gap-2 rounded px-1 py-0.5 text-left hover:bg-[var(--bg-hover-soft)]"
        >
          <span aria-hidden className={phrase ? "text-[var(--fg-brand)]" : "text-[var(--fg-muted)]"}>
            {phrase ? "●" : "○"}
          </span>
          <span
            className={`truncate text-xs ${phrase ? "text-[var(--fg-primary)]" : "text-[var(--fg-secondary)]"}`}
          >
            frase exata
            <span className="sr-only">{phrase ? ", ligado" : ", desligado"}</span>
          </span>
          <span className="truncate text-[11px] text-[var(--fg-muted)]">
            as palavras têm que estar uma do lado da outra
          </span>
        </button>
      </div>

      {!caseSensitiveAllowed && (
        <p className="mb-2.5 rounded-md border border-[var(--fg-brand)] bg-[var(--bg-surface-brand)] px-2.5 py-2 text-[11px] leading-snug text-[var(--fg-primary)]">
          case_sensitive fica bloqueado enquanto stemming ou remove_stopwords estiver ligado. Os
          dois precisam comparar tudo em minúsculo.
        </p>
      )}

      <button
        type="button"
        aria-expanded={paramsOpen}
        onClick={() => setParamsOpen((v) => !v)}
        className="rounded px-1 py-0.5 text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
      >
        {paramsOpen ? "esconder" : "mostrar"} parâmetros de ordenação
      </button>

      {paramsOpen && (
        <div className="mt-1.5 mb-1 rounded-md border border-[var(--border-subtle)] p-2.5">
          <p className="mb-2 text-[11px] text-[var(--fg-muted)]">
            Mexer aqui muda só a ordem. Nada é analisado de novo.
          </p>
          <div className="flex gap-2">
            {BM25_HELP.map(({ key, help, step }) => (
              <label key={key} className="min-w-0 flex-1">
                <span className="mb-1 block text-[11px] text-[var(--fg-secondary)]">{key}</span>
                <input
                  type="number"
                  min={0}
                  step={step}
                  value={bm25[key]}
                  onChange={(e) =>
                    onChangeConfig({ ...config, bm25: { ...bm25, [key]: Number(e.target.value) } })
                  }
                  className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-1.5 py-1 font-mono text-xs text-[var(--fg-primary)] outline-none focus-visible:border-[var(--fg-brand)]"
                />
                <span className="mt-1 block text-[10.5px] leading-tight text-[var(--fg-muted)]">
                  {help}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 mb-3.5 border-t border-[var(--border-subtle)] pt-3.5">
        <p
          className={`font-serif text-[44px] leading-none tracking-tight ${
            count === 0 ? "text-[var(--fg-muted)]" : "text-[var(--fg-primary)]"
          }`}
        >
          {count ?? "—"}
        </p>
        <p className="mt-1.5 text-[11px] text-[var(--fg-muted)]">
          {result === null
            ? "nenhuma busca feita ainda"
            : count === 1
              ? "documento encontrado"
              : "documentos encontrados"}
        </p>
      </div>

      {result?.emptyQueryNote && (
        <p className="mb-3.5 rounded-md border border-[var(--fg-brand)] bg-[var(--bg-surface-brand)] px-2.5 py-2 text-[11px] leading-snug text-[var(--fg-primary)]">
          {result.emptyQueryNote}
        </p>
      )}

      {ranked.length > 0 && (
        <ol className="mb-3.5 flex flex-col gap-px">
          {ranked.map(({ item, score }) => (
            <li key={item.doc.id}>
              <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-baseline gap-2 rounded px-1 py-1.5">
                <span className="text-[11px] text-[var(--fg-brand)]">{item.doc.id}</span>
                <span className="truncate text-[11.5px] text-[var(--fg-secondary)]">
                  {item.doc.text}
                </span>
                <span className="text-right text-[11px] tabular-nums text-[var(--fg-muted)]">
                  {score.toFixed(3)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}

      {absent.length > 0 && (
        <div>
          <h3 className="mb-2 text-[11px] uppercase tracking-[0.08em] text-[var(--fg-muted)]">
            ausentes · {absent.length}
          </h3>
          <ul className="flex flex-col gap-px">
            {absent.map((r) => (
              <li key={r.doc.id}>
                <button
                  type="button"
                  onClick={() => onOpenPanel(r.doc.id)}
                  className="grid w-full grid-cols-[44px_minmax(0,1fr)] items-baseline gap-2 rounded-r border-l-2 border-[var(--fg-brand)] px-2 py-1.5 text-left hover:bg-[var(--bg-hover-soft)]"
                >
                  <span className="text-xs text-[var(--fg-secondary)]">{r.doc.id}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11.5px] text-[var(--fg-secondary)]">
                      {r.doc.text}
                    </span>
                    <span className="block text-[11px] text-[var(--fg-muted)]">
                      {r.phraseOnlyMiss
                        ? "as palavras estão aqui, mas não uma do lado da outra"
                        : "ver por que não bateu"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
