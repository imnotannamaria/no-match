"use client";

// The panel that answers the question the tool exists for. Two tabs: the
// ladder, which says which stage killed the match, and the tokens, which
// shows what the analyzer actually produced, holes included.
//
// It is a dialog, not a floating aside: focus goes into it, escape closes
// it, and the page behind it stops taking clicks. Reading an explanation
// while the thing it explains changes underneath is the one interaction
// this panel must not allow.

import { useState } from "react";
import type { Token } from "@/lib/alyze/types";
import type { DocumentExplanation, LadderExplanation } from "@/lib/ladder/types";
import { checkMaxLength } from "@/lib/ladder/max-length";
import {
  NEVER_ADVICE,
  PHRASE_ONLY_MISS,
  VERDICT_COPY,
  convergeAdvice,
  optionAdvice,
  disappearedAdvice,
  droppedFromQueryAdvice,
  fixLabel,
  stageLabel,
} from "@/lib/ladder/copy";
import type { Fix } from "@/lib/ladder/fix";
import { withHoles } from "@/lib/tokens/positions";
import type { ColumnId } from "@/lib/columns";
import { Button } from "@/app/components/entrepta/button";
import { Dialog, DialogContent, DialogLabel, DialogTitle } from "@/app/components/entrepta/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/entrepta/tabs";

interface SidePanelProps {
  columnId: ColumnId;
  targetColumnId: ColumnId;
  docId: string;
  docText: string;
  explanation: DocumentExplanation | null;
  loading: boolean;
  error: string | null;
  maxTokenLength: number;
  queryRaw: string;
  queryTokens: Token[];
  docTokens: Token[];
  fix: Fix | null;
  onApplyFix: () => void;
  onClose: () => void;
}

export function SidePanel(props: SidePanelProps) {
  const [tab, setTab] = useState("ladder");

  return (
    <Dialog open onOpenChange={(next) => !next && props.onClose()}>
      <DialogContent
        variant="drawer"
        aria-describedby={undefined}
        className="gap-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <header className="border-b border-[var(--border-subtle)] px-5 py-4 pr-12">
          <DialogLabel>
            column {props.columnId} · {props.docId}
          </DialogLabel>
          <DialogTitle className="mt-1.5 text-xl">{props.docText}</DialogTitle>
        </header>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="ladder">ladder</TabsTrigger>
            <TabsTrigger value="tokens">tokens</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex-1 overflow-auto overscroll-contain px-5 py-5">
          {props.loading && (
            <p role="status" className="font-mono text-[12px] text-[var(--fg-secondary)]">
              analysing…
            </p>
          )}

          {props.error && (
            <p role="alert" className="font-mono text-[12px] text-[var(--status-error-fg)]">
              could not analyse this document: {props.error}
            </p>
          )}

          {!props.loading && !props.error && props.explanation && tab === "ladder" && (
            <LadderTab
              explanation={props.explanation}
              maxTokenLength={props.maxTokenLength}
              fix={props.fix}
              targetColumnId={props.targetColumnId}
              onApplyFix={props.onApplyFix}
            />
          )}

          {!props.loading && !props.error && tab === "tokens" && (
            <TokensTab
              queryRaw={props.queryRaw}
              queryTokens={props.queryTokens}
              docId={props.docId}
              docTokens={props.docTokens}
              maxTokenLength={props.maxTokenLength}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LadderTab({
  explanation,
  maxTokenLength,
  fix,
  targetColumnId,
  onApplyFix,
}: {
  explanation: DocumentExplanation;
  maxTokenLength: number;
  fix: Fix | null;
  targetColumnId: ColumnId;
  onApplyFix: () => void;
}) {
  return (
    <div>
      {explanation.phraseOnlyMiss && (
        <p className="mb-5 rounded-[var(--radius-md)] border border-[var(--fg-brand)] bg-[var(--bg-surface-brand)] p-3 font-sans text-[12.5px] leading-relaxed text-[var(--fg-primary)]">
          {PHRASE_ONLY_MISS}
        </p>
      )}

      {explanation.words.map((word) => (
        <WordLadder
          key={word.queryWord}
          word={word}
          maxTokenLength={maxTokenLength}
          phraseOnlyMiss={explanation.phraseOnlyMiss}
        />
      ))}

      {fix && (
        <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
          <Button variant="primary" size="sm" onClick={onApplyFix}>
            {fixLabel(fix, targetColumnId)}
          </Button>
          <p className="mt-2 font-sans text-[11.5px] leading-snug text-[var(--fg-muted)]">
            The column you are reading does not change. The fix lands on the other one, so you can
            see both at once.
          </p>
        </div>
      )}
    </div>
  );
}

function WordLadder({
  word,
  maxTokenLength,
  phraseOnlyMiss,
}: {
  word: LadderExplanation;
  maxTokenLength: number;
  phraseOnlyMiss: boolean;
}) {
  const length = checkMaxLength(word.queryWord, maxTokenLength);

  return (
    <section className="mb-6">
      <p className="font-sans text-[13px] leading-relaxed text-[var(--fg-primary)]">
        <strong className="font-mono font-normal text-[var(--fg-brand-hover)]">
          &quot;{word.queryWord}&quot;
        </strong>{" "}
        {word.droppedFromQuery
          ? droppedFromQueryAdvice(
              word.droppedFromQuery.reason,
              word.droppedFromQuery.bytes,
              maxTokenLength,
            )
          : phraseOnlyMiss
            ? "is in this document. Exact phrase is what does not close."
            : word.kind === "converge" && word.stage
              ? `and "${word.docWord}" are different tokens. ${
                  word.fixableBy.length > 0
                    ? optionAdvice(word.fixableBy[0])
                    : convergeAdvice(word.stage)
                }`
              : word.kind === "disappeared" && word.stage
                ? disappearedAdvice(word.stage, word.docWord ?? word.queryWord)
                : NEVER_ADVICE}
      </p>

      {!word.droppedFromQuery && length.exceeds && (
        <p className="mt-2 font-sans text-[11.5px] leading-snug text-[var(--fg-secondary)]">
          Separately from that: this word takes {length.bytes} bytes
          {length.bytes !== length.chars && ` (${length.chars} characters)`}, over the limit of{" "}
          {maxTokenLength}.
        </p>
      )}

      {word.rows && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse font-mono text-[11.5px]">
            <caption className="mb-1.5 text-left text-[11px] text-[var(--fg-muted)]">
              what each stage does to the two words
            </caption>
            <thead>
              <tr className="text-[var(--fg-muted)]">
                <th scope="col" className="py-1.5 pr-3 text-left font-normal">
                  stage
                </th>
                <th scope="col" className="py-1.5 pr-3 text-left font-normal">
                  search
                </th>
                <th scope="col" className="py-1.5 pr-3 text-left font-normal">
                  document
                </th>
                <th scope="col" className="py-1.5 text-left font-normal">
                  result
                </th>
              </tr>
            </thead>
            <tbody>
              {word.rows.map((row) => (
                <tr
                  key={row.stage}
                  className={
                    row.verdict === "match"
                      ? "text-[var(--fg-primary)]"
                      : "text-[var(--fg-secondary)]"
                  }
                >
                  <th
                    scope="row"
                    className="border-t border-[var(--border-subtle)] py-1.5 pr-3 text-left font-normal whitespace-nowrap"
                  >
                    {stageLabel(row.stage)}
                  </th>
                  <td className="border-t border-[var(--border-subtle)] py-1.5 pr-3">
                    {row.queryForm ?? "dropped"}
                  </td>
                  <td className="border-t border-[var(--border-subtle)] py-1.5 pr-3">
                    {row.docForm ?? "dropped"}
                  </td>
                  <td className="border-t border-[var(--border-subtle)] py-1.5">
                    {VERDICT_COPY[row.verdict]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TokensTab({
  queryRaw,
  queryTokens,
  docId,
  docTokens,
  maxTokenLength,
}: {
  queryRaw: string;
  queryTokens: Token[];
  docId: string;
  docTokens: Token[];
  maxTokenLength: number;
}) {
  return (
    <div>
      <p className="mb-5 font-sans text-[12.5px] leading-relaxed text-[var(--fg-secondary)]">
        Every word spends a position, even when a filter throws it away afterwards. The gaps below
        are positions that were spent and left empty, and they are the reason the distance between
        words still holds in an exact phrase search.
      </p>

      <TokenRow
        label="search"
        detail={queryRaw}
        tokens={queryTokens}
        maxTokenLength={maxTokenLength}
      />
      <TokenRow label={docId} tokens={docTokens} maxTokenLength={maxTokenLength} />
    </div>
  );
}

function TokenRow({
  label,
  detail,
  tokens,
  maxTokenLength,
}: {
  label: string;
  /** Text the person typed. Kept out of the uppercase run: it is their content, not a label. */
  detail?: string;
  tokens: Token[];
  maxTokenLength: number;
}) {
  const slots = withHoles(tokens);

  return (
    <section className="mb-7">
      <h3 className="mb-2.5 font-mono text-[10px] tracking-[0.1em] text-[var(--fg-muted)]">
        <span className="uppercase">{label}</span>
        {detail && <span className="tracking-normal normal-case"> · {detail}</span>}
      </h3>
      {slots.length === 0 ? (
        <p className="font-sans text-[12px] text-[var(--fg-secondary)]">
          No tokens survived the analysis.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {slots.map((slot, index) =>
            slot.kind === "hole" ? (
              <li
                key={`hole-${slot.position}`}
                style={{ "--nm-delay": `${index * 25}ms` } as React.CSSProperties}
                className="nm-rise min-w-[56px] rounded-[var(--radius-sm)] border border-dashed border-[var(--border-strong)] px-2 py-1.5"
              >
                <span aria-hidden className="block font-mono text-[13px] text-[var(--fg-muted)]">
                  ·
                </span>
                <span className="mt-0.5 block font-mono text-[10px] text-[var(--fg-muted)]">
                  pos {slot.position}, dropped
                </span>
              </li>
            ) : (
              <li
                key={`tok-${slot.position}`}
                style={{ "--nm-delay": `${index * 25}ms` } as React.CSSProperties}
                className="nm-rise min-w-[56px] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2 py-1.5"
              >
                <span className="block font-mono text-[13px] break-all text-[var(--fg-primary)]">
                  {slot.token.text}
                </span>
                <span className="mt-0.5 block font-mono text-[10px] text-[var(--fg-muted)]">
                  pos {slot.position} ·{" "}
                  <TokenBytes text={slot.token.text} maxTokenLength={maxTokenLength} />
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function TokenBytes({ text, maxTokenLength }: { text: string; maxTokenLength: number }) {
  const { bytes, chars, exceeds } = checkMaxLength(text, maxTokenLength);
  return (
    <span className={exceeds ? "text-[var(--status-error-fg)]" : undefined}>
      {bytes} bytes
      {bytes !== chars && ` (${chars} characters)`}
      {exceeds && ", over the limit"}
    </span>
  );
}
