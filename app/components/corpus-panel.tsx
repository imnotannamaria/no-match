"use client";

import { CORPORA, type Corpus, type ExampleDocument } from "@/lib/corpora";

interface CorpusPanelProps {
  docs: ExampleDocument[];
  corpusId: string;
  onPickCorpus: (corpus: Corpus) => void;
  open: boolean;
  onToggleOpen: () => void;
  onChangeDoc: (id: string, text: string) => void;
  onRemoveDoc: (id: string) => void;
  onAddDoc: () => void;
}

export function CorpusPanel({
  docs,
  corpusId,
  onPickCorpus,
  open,
  onToggleOpen,
  onChangeDoc,
  onRemoveDoc,
  onAddDoc,
}: CorpusPanelProps) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={false}
        className="hidden shrink-0 self-stretch rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-3 text-[11px] uppercase tracking-[0.08em] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)] lg:block lg:[writing-mode:vertical-rl]"
      >
        corpus · {docs.length} →
      </button>
    );
  }

  const characters = docs.reduce((total, d) => total + d.text.length, 0);

  return (
    <section
      aria-label="corpus"
      className="w-full shrink-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 lg:w-[300px]"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--fg-muted)]">
          ◆ corpus
        </span>
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded
          className="rounded px-1 py-0.5 text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
        >
          recolher ←
        </button>
      </header>

      <div className="mb-3.5 flex gap-1.5">
        {CORPORA.map((corpus) => (
          <button
            key={corpus.id}
            type="button"
            aria-pressed={corpus.id === corpusId}
            onClick={() => onPickCorpus(corpus)}
            className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] ${
              corpus.id === corpusId
                ? "border-[var(--fg-brand)] bg-[var(--bg-surface-brand)] text-[var(--fg-primary)]"
                : "border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
            }`}
          >
            {corpus.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {docs.map((d) => (
          <div key={d.id} className="flex items-start gap-2">
            <span className="w-[34px] shrink-0 pt-2 text-[11px] text-[var(--fg-muted)]">
              {d.id}
            </span>
            <textarea
              value={d.text}
              rows={3}
              spellCheck={false}
              aria-label={`texto do ${d.id}`}
              onChange={(e) => onChangeDoc(d.id, e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2 py-1.5 font-mono text-[11.5px] leading-snug text-[var(--fg-secondary)] outline-none focus-visible:border-[var(--fg-brand)] focus-visible:text-[var(--fg-primary)]"
            />
            <button
              type="button"
              onClick={() => onRemoveDoc(d.id)}
              aria-label={`remover ${d.id}`}
              className="shrink-0 px-1 py-1.5 text-xs text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
        <button
          type="button"
          onClick={onAddDoc}
          className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-[11px] text-[var(--fg-secondary)] hover:border-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
        >
          + documento
        </button>
        <span className="text-[11px] text-[var(--fg-muted)]">
          {docs.length} docs · {characters} caracteres
        </span>
      </div>
    </section>
  );
}
