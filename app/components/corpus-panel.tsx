"use client";

// The documents being searched. Editable, because the fastest way to
// understand the tool is to break a search with your own sentence.
//
// Editing text does not re-run anything: typing a document would otherwise
// re-analyse the whole corpus on every keystroke. The section says so, and
// offers the button, when what is on screen no longer matches what ran.

import type { ExampleDocument } from "@/lib/corpora";
import { Button } from "@/app/components/entrepta/button";

interface CorpusPanelProps {
  docs: ExampleDocument[];
  open: boolean;
  /** The text on screen is not what the last search ran against. */
  dirty: boolean;
  onToggleOpen: () => void;
  onChangeDoc: (id: string, text: string) => void;
  onRemoveDoc: (id: string) => void;
  onAddDoc: () => void;
  onSearch: () => void;
}

export function CorpusPanel({
  docs,
  open,
  dirty,
  onToggleOpen,
  onChangeDoc,
  onRemoveDoc,
  onAddDoc,
  onSearch,
}: CorpusPanelProps) {
  const characters = docs.reduce((total, d) => total + d.text.length, 0);

  return (
    <section aria-label="corpus" className="mx-auto w-full max-w-[1240px]">
      <header className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <h2 className="font-normal">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggleOpen}
          className="group inline-flex items-center gap-2 rounded-[var(--radius-sm)] py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--fg-muted)] transition-colors duration-150 hover:text-[var(--fg-primary)]"
        >
          <span aria-hidden className="text-[10px] leading-none text-[var(--fg-brand)]">
            ◆
          </span>
          corpus
          <span className="text-[var(--fg-muted)] normal-case tracking-normal">
            {docs.length} documents · {characters} characters
          </span>
          <span
            aria-hidden
            className="text-[var(--fg-muted)] transition-transform duration-200 ease-out group-hover:translate-y-px"
          >
            {open ? "▴" : "▾"}
          </span>
        </button>
        </h2>

        {open && (
          <div className="flex items-center gap-2">
            {dirty && (
              <p role="status" className="font-mono text-[11px] text-[var(--fg-brand-hover)]">
                the corpus changed since the last search
              </p>
            )}
            <Button variant={dirty ? "primary" : "secondary"} size="sm" onClick={onSearch}>
              Run the search
            </Button>
          </div>
        )}
      </header>

      {open && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {docs.map((d, index) => (
              <div
                key={d.id}
                className="nm-rise flex min-w-0 flex-col rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 transition-colors duration-200 focus-within:border-[var(--fg-brand)] hover:border-[var(--border-strong)]"
                style={{ "--nm-delay": `${index * 40}ms` } as React.CSSProperties}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-[10.5px] text-[var(--fg-muted)]">{d.id}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveDoc(d.id)}
                    aria-label={`remove ${d.id}`}
                    className="rounded-[var(--radius-sm)] px-1 font-mono text-[13px] leading-none text-[var(--fg-muted)] transition-colors duration-150 hover:bg-[var(--bg-hover-soft)] hover:text-[var(--fg-primary)]"
                  >
                    ×
                  </button>
                </div>
                <textarea
                  value={d.text}
                  rows={3}
                  spellCheck={false}
                  autoComplete="off"
                  aria-label={`text of ${d.id}`}
                  onChange={(e) => onChangeDoc(d.id, e.target.value)}
                  className="min-w-0 flex-1 resize-y bg-transparent font-sans text-[12.5px] leading-relaxed text-[var(--fg-secondary)] outline-none focus-visible:text-[var(--fg-primary)]"
                />
              </div>
            ))}
          </div>

          <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={onAddDoc}>
              + document
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
