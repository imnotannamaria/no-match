"use client";

// The configuration both columns are running, in the shape turbopuffer's
// full_text_search parameters take, so it can be read and copied out.

import { useState } from "react";
import { toSchemaJson } from "@/lib/alyze/schema";
import { COLUMN_IDS, type ColumnConfig, type ColumnId } from "@/lib/columns";

export function SchemaPanel({ configs }: { configs: Record<ColumnId, ColumnConfig> }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<ColumnId | null>(null);

  async function copy(id: ColumnId) {
    try {
      await navigator.clipboard.writeText(toSchemaJson(configs[id].options));
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard can be refused, and a copy button that silently does
      // nothing is worse than one that says so.
      setCopied(null);
    }
  }

  return (
    <section
      aria-label="schema full_text_search"
      className="fixed bottom-9 left-4 z-30 hidden w-[400px] max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-chrome)] backdrop-blur lg:block"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--fg-muted)]">
          ◆ schema · full_text_search
        </span>
        <span className="text-[11px] text-[var(--fg-muted)]">{open ? "esconder" : "mostrar"}</span>
      </button>

      {open && (
        <div className="max-h-[46vh] overflow-auto px-3 pb-3">
          {COLUMN_IDS.map((id) => (
            <div key={id} className="mt-1.5 border-t border-[var(--border-subtle)] pt-2.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[11px] text-[var(--fg-brand)]">coluna {id}</span>
                <button
                  type="button"
                  onClick={() => copy(id)}
                  className="rounded-md border border-[var(--border-subtle)] px-1.5 py-0.5 text-[10.5px] text-[var(--fg-secondary)] hover:border-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                >
                  {copied === id ? "copiado" : "copiar"}
                </button>
              </div>
              <pre className="overflow-auto font-mono text-[10.5px] leading-relaxed text-[var(--fg-secondary)]">
                {toSchemaJson(configs[id].options)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
