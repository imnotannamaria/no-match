"use client";

// The panel that answers the question the tool exists for. Two tabs: the
// ladder, which says which stage killed the match, and the tokens, which
// shows what the analyzer actually produced, holes included.

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
  const [tab, setTab] = useState<"ladder" | "tokens">("ladder");

  return (
    <aside
      aria-label={`por que ${props.docId} não bateu na coluna ${props.columnId}`}
      className="fixed inset-y-0 right-0 bottom-7 z-40 flex w-full max-w-full flex-col border-l border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl sm:w-[560px] sm:max-w-[92vw]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--fg-muted)]">
            ◆ coluna {props.columnId} · {props.docId}
          </p>
          <p className="mt-0.5 truncate font-serif text-xl text-[var(--fg-primary)]">
            {props.docText}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {(["ladder", "tokens"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-md border px-2.5 py-1 text-[11px] ${
                tab === t
                  ? "border-[var(--fg-brand)] bg-[var(--bg-surface-brand)] text-[var(--fg-primary)]"
                  : "border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
              }`}
            >
              {t === "ladder" ? "escada" : "tokens"}
            </button>
          ))}
          <button
            type="button"
            onClick={props.onClose}
            aria-label="fechar painel"
            className="px-1.5 py-1 text-sm text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
          >
            ×
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4">
        {props.loading && <p className="text-xs text-[var(--fg-secondary)]">analisando…</p>}

        {props.error && (
          <p role="alert" className="text-xs text-[var(--status-error-fg)]">
            não deu para analisar: {props.error}
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
    </aside>
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
        <p className="mb-4 rounded-lg border border-[var(--fg-brand)] bg-[var(--bg-surface-brand)] p-3 text-xs leading-relaxed text-[var(--fg-primary)]">
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
        <button
          type="button"
          onClick={onApplyFix}
          className="mt-3 rounded-lg border border-[var(--fg-brand)] bg-[var(--fg-brand)] px-3.5 py-2 text-xs text-[var(--bg-canvas)] hover:bg-[var(--fg-brand-hover)]"
        >
          {fixLabel(fix, targetColumnId)}
        </button>
      )}
      {fix && (
        <p className="mt-2 text-[11px] leading-snug text-[var(--fg-muted)]">
          A coluna que você está olhando não muda. O conserto vai para a outra, para você ver as
          duas lado a lado.
        </p>
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
    <section className="mb-4">
      <p className="text-xs leading-relaxed text-[var(--fg-primary)]">
        <strong className="text-[var(--fg-brand)]">&quot;{word.queryWord}&quot;</strong>{" "}
        {word.droppedFromQuery
          ? droppedFromQueryAdvice(
              word.droppedFromQuery.reason,
              word.droppedFromQuery.bytes,
              maxTokenLength,
            )
          : phraseOnlyMiss
            ? "está neste documento. A frase exata é que não fecha."
            : word.kind === "converge" && word.stage
              ? `e "${word.docWord}" são tokens diferentes. ${
                  word.fixableBy.length > 0
                    ? optionAdvice(word.fixableBy[0])
                    : convergeAdvice(word.stage)
                }`
              : word.kind === "disappeared" && word.stage
                ? disappearedAdvice(word.stage, word.docWord ?? word.queryWord)
                : NEVER_ADVICE}
      </p>

      {!word.droppedFromQuery && length.exceeds && (
        <p className="mt-1.5 text-[11px] leading-snug text-[var(--fg-secondary)]">
          Separado disso: essa palavra ocupa {length.bytes} bytes
          {length.bytes !== length.chars && ` (${length.chars} caracteres)`}, acima do limite de{" "}
          {maxTokenLength}.
        </p>
      )}

      {word.rows && (
        <table className="mt-2.5 w-full border-collapse text-[11px]">
          <caption className="mb-1 text-left text-[11px] text-[var(--fg-muted)]">
            o que cada etapa faz com as duas palavras
          </caption>
          <thead>
            <tr className="text-[var(--fg-muted)]">
              <th scope="col" className="py-1 pr-2 text-left font-normal">
                etapa
              </th>
              <th scope="col" className="py-1 pr-2 text-left font-normal">
                busca
              </th>
              <th scope="col" className="py-1 pr-2 text-left font-normal">
                documento
              </th>
              <th scope="col" className="py-1 text-left font-normal">
                resultado
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
                <th scope="row" className="py-1 pr-2 text-left font-normal whitespace-nowrap">
                  {stageLabel(row.stage)}
                </th>
                <td className="py-1 pr-2">{row.queryForm ?? "descartada"}</td>
                <td className="py-1 pr-2">{row.docForm ?? "descartada"}</td>
                <td className="py-1">{VERDICT_COPY[row.verdict]}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
      <p className="mb-4 text-[11px] leading-relaxed text-[var(--fg-secondary)]">
        Toda palavra gasta uma posição, mesmo quando um filtro descarta ela depois. Os buracos
        abaixo são posições gastas e vazias, e é por causa deles que a distância entre palavras
        continua certa numa busca de frase.
      </p>

      <TokenRow label={`busca · ${queryRaw}`} tokens={queryTokens} maxTokenLength={maxTokenLength} />
      <TokenRow label={docId} tokens={docTokens} maxTokenLength={maxTokenLength} />
    </div>
  );
}

function TokenRow({
  label,
  tokens,
  maxTokenLength,
}: {
  label: string;
  tokens: Token[];
  maxTokenLength: number;
}) {
  const slots = withHoles(tokens);

  return (
    <section className="mb-6">
      <h3 className="mb-2.5 text-[11px] uppercase tracking-[0.08em] text-[var(--fg-muted)]">
        {label}
      </h3>
      {slots.length === 0 ? (
        <p className="text-[11px] text-[var(--fg-secondary)]">
          nenhum token sobrou depois da análise.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {slots.map((slot) =>
            slot.kind === "hole" ? (
              <li
                key={`hole-${slot.position}`}
                className="min-w-[52px] rounded-md border border-dashed border-[var(--border-strong)] px-2 py-1.5"
              >
                <span className="block text-[13px] text-[var(--fg-muted)]">·</span>
                <span className="mt-0.5 block text-[10px] text-[var(--fg-muted)]">
                  pos {slot.position}, descartada
                </span>
              </li>
            ) : (
              <li
                key={`tok-${slot.position}`}
                className="min-w-[52px] rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2 py-1.5"
              >
                <span className="block text-[13px] text-[var(--fg-primary)]">
                  {slot.token.text}
                </span>
                <span className="mt-0.5 block text-[10px] text-[var(--fg-muted)]">
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
    <span className={exceeds ? "text-[var(--fg-brand)]" : undefined}>
      {bytes} bytes
      {bytes !== chars && ` (${chars} caracteres)`}
      {exceeds && ", acima do limite"}
    </span>
  );
}
