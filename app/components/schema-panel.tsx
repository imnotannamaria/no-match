"use client";

// The configuration both columns are running, in the shape turbopuffer's
// full_text_search parameters take, so it can be read and copied out.
//
// It lives behind a dialog rather than pinned to a corner: it is reference
// material, wanted once, and a floating panel large enough to read JSON in
// covers the corpus on every screen narrower than a desk monitor.

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toSchemaJson } from "@/lib/alyze/schema";
import { COLUMN_IDS, type ColumnConfig, type ColumnId } from "@/lib/columns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogLabel,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/entrepta/dialog";

export function SchemaPanel({ configs }: { configs: Record<ColumnId, ColumnConfig> }) {
  const [copied, setCopied] = useState<ColumnId | null>(null);
  const [failed, setFailed] = useState(false);

  async function copy(id: ColumnId) {
    try {
      await navigator.clipboard.writeText(toSchemaJson(configs[id].options));
      setFailed(false);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard can be refused, and a copy button that silently does
      // nothing is worse than one that says so.
      setCopied(null);
      setFailed(true);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded-[var(--radius-sm)] px-2 py-1 font-mono text-[11px] text-[var(--fg-secondary)] transition-colors duration-150 hover:bg-[var(--bg-hover-soft)] hover:text-[var(--fg-primary)]"
        >
          schema
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogLabel>full_text_search</DialogLabel>
        <DialogTitle className="text-xl">What each column is running</DialogTitle>
        <DialogDescription>
          The same field names a full-text index takes, so a configuration that works here can be
          copied straight out.
        </DialogDescription>

        <div className="flex flex-col gap-3">
          {COLUMN_IDS.map((id) => (
            <div
              key={id}
              className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-canvas)]"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
                <span className="font-mono text-[11px] text-[var(--fg-brand-hover)]">
                  column {id}
                </span>
                <button
                  type="button"
                  onClick={() => copy(id)}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-2 py-1 font-mono text-[10.5px] text-[var(--fg-secondary)] transition-colors duration-150 hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)]"
                >
                  {copied === id ? (
                    <Check aria-hidden style={{ width: 11, height: 11, strokeWidth: 2 }} />
                  ) : (
                    <Copy aria-hidden style={{ width: 11, height: 11, strokeWidth: 1.5 }} />
                  )}
                  {copied === id ? "copied" : "copy"}
                </button>
              </div>
              <pre className="overflow-auto px-3 py-2.5 font-mono text-[11px] leading-relaxed text-[var(--fg-secondary)]">
                {toSchemaJson(configs[id].options)}
              </pre>
            </div>
          ))}
        </div>

        <p aria-live="polite" className="min-h-4 font-mono text-[11px] text-[var(--fg-muted)]">
          {failed && "The browser refused clipboard access. Select the text and copy it by hand."}
          {copied && `Column ${copied} copied.`}
        </p>
      </DialogContent>
    </Dialog>
  );
}
