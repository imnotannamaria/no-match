"use client";

// Phase 3: the stage ladder. For every absent document, explain which
// stage killed the match, per query word. Still plain -- no design system
// yet, that's phase 6.

import { useEffect, useState } from "react";
import { analyzerClient } from "@/lib/alyze/client";
import { sanitizeOptions, canEnableCaseSensitive } from "@/lib/alyze/validate";
import { DEFAULT_OPTIONS, type AnalysisOptions, type Token } from "@/lib/alyze/types";
import { evaluateDocument } from "@/lib/search/match";
import { explainEmptyQuery } from "@/lib/search/empty-query";
import { EXAMPLE_CORPUS_PT, type ExampleDocument } from "@/lib/corpora/example-pt";
import { explainDocument, extractRawWords } from "@/lib/ladder/explain";
import { checkMaxLength } from "@/lib/ladder/max-length";
import {
  NEVER_ADVICE,
  PHRASE_ONLY_MISS,
  VERDICT_COPY,
  convergeAdvice,
  disappearedAdvice,
  droppedFromQueryAdvice,
  stageLabel,
} from "@/lib/ladder/copy";
import type { DocumentExplanation, LadderExplanation } from "@/lib/ladder/types";

interface DocResult {
  doc: ExampleDocument;
  matched: boolean;
  matchedTerms: string[];
  phraseOnlyMiss: boolean;
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [docs, setDocs] = useState<ExampleDocument[]>(EXAMPLE_CORPUS_PT);
  const [query, setQuery] = useState("cafe");
  const [options, setOptions] = useState<AnalysisOptions>(DEFAULT_OPTIONS);
  const [phrase, setPhrase] = useState(false);
  const [results, setResults] = useState<DocResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyQueryNote, setEmptyQueryNote] = useState<string | null>(null);
  // Bumped on every search. Part of each AbsentDoc's key, so a new search
  // throws away explanations computed for the previous one instead of
  // leaving a stale answer on screen.
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    analyzerClient.ready().then(
      () => setReady(true),
      (err: Error) => setBootError(err.message),
    );
  }, []);

  function updateOption<K extends keyof AnalysisOptions>(key: K, value: AnalysisOptions[K]) {
    setOptions((prev) => sanitizeOptions({ ...prev, [key]: value }));
  }

  function updateDoc(id: string, text: string) {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, text } : d)));
  }

  function removeDoc(id: string) {
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  function addDoc() {
    setDocs((prev) => [...prev, { id: `doc-${Date.now()}`, text: "" }]);
  }

  async function search() {
    setError(null);
    setSearching(true);
    setEmptyQueryNote(null);
    setRunId((n) => n + 1);
    try {
      const queryTokens: Token[] = await analyzerClient.analyze(query, options);

      if (queryTokens.length === 0) {
        const note = await explainEmptyQuery(query, options);
        setEmptyQueryNote(note);
        setResults(null);
        return;
      }

      const docResults = await Promise.all(
        docs.map(async (doc) => {
          const docTokens = await analyzerClient.analyze(doc.text, options);
          const verdict = evaluateDocument(queryTokens, docTokens, { phrase });
          return { doc, ...verdict };
        }),
      );
      setResults(docResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  const caseSensitiveAllowed = canEnableCaseSensitive(options);
  const matched = results?.filter((r) => r.matched) ?? [];
  const absent = results?.filter((r) => !r.matched) ?? [];

  return (
    <main style={{ padding: 24, fontFamily: "monospace", maxWidth: 960 }}>
      <h1>nomatch — phase 3</h1>

      {bootError ? (
        <p role="alert" style={{ color: "#b91c1c" }}>
          o analisador não carregou: {bootError}. Sem ele nada aqui funciona. Recarregue a página;
          se continuar, o arquivo em /wasm/ pode não estar sendo servido.
        </p>
      ) : (
        <p>{ready ? "analyzer loaded" : "loading analyzer..."}</p>
      )}

      <section style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 14 }}>options</h2>
        <label style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={options.case_sensitive}
            disabled={!caseSensitiveAllowed}
            onChange={(e) => updateOption("case_sensitive", e.target.checked)}
          />{" "}
          case_sensitive {!caseSensitiveAllowed && "(disabled: stemming or remove_stopwords is on)"}
        </label>
        <label style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={options.ascii_folding}
            onChange={(e) => updateOption("ascii_folding", e.target.checked)}
          />{" "}
          ascii_folding
        </label>
        <label style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={options.stemming}
            onChange={(e) => updateOption("stemming", e.target.checked)}
          />{" "}
          stemming
        </label>
        <label style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={options.remove_stopwords}
            onChange={(e) => updateOption("remove_stopwords", e.target.checked)}
          />{" "}
          remove_stopwords
        </label>
        <label style={{ display: "block" }}>
          language:{" "}
          <select
            value={options.language}
            onChange={(e) => updateOption("language", e.target.value)}
          >
            <option value="portuguese">portuguese</option>
            <option value="english">english</option>
          </select>
        </label>
        <label style={{ display: "block" }}>
          max_token_length (bytes):{" "}
          <input
            type="number"
            value={options.max_token_length}
            min={1}
            max={255}
            onChange={(e) => updateOption("max_token_length", Number(e.target.value))}
            style={{ width: 60 }}
          />
        </label>
        <label style={{ display: "block" }}>
          <input type="checkbox" checked={phrase} onChange={(e) => setPhrase(e.target.checked)} />{" "}
          frase exata (exact phrase)
        </label>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 14 }}>search</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "100%", fontFamily: "monospace", fontSize: 16, padding: 6 }}
        />
        <button onClick={search} disabled={!ready || searching} style={{ marginTop: 8 }}>
          {searching ? "searching..." : "buscar"}
        </button>
        {error && (
          <p role="alert" style={{ color: "#b91c1c" }}>
            {error}
          </p>
        )}
        {emptyQueryNote && <p style={{ color: "#b45309" }}>{emptyQueryNote}</p>}
      </section>

      <section style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 14 }}>
          corpus <button onClick={addDoc}>+ documento</button>
        </h2>
        {docs.map((d) => (
          <div key={d.id} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <span style={{ width: 60 }}>{d.id}</span>
            <textarea
              value={d.text}
              onChange={(e) => updateDoc(d.id, e.target.value)}
              rows={1}
              style={{ flex: 1, fontFamily: "monospace" }}
              aria-label={`documento ${d.id}`}
            />
            <button onClick={() => removeDoc(d.id)} aria-label={`remover ${d.id}`}>
              ×
            </button>
          </div>
        ))}
      </section>

      {results && (
        <section>
          <h2 style={{ fontSize: 14 }}>resultados · {matched.length}</h2>
          <ul>
            {matched.map((r) => (
              <li key={r.doc.id}>
                <strong>{r.doc.id}</strong>: {r.doc.text}{" "}
                <span style={{ color: "#666" }}>[{r.matchedTerms.join(", ")}]</span>
              </li>
            ))}
          </ul>

          <h2 style={{ fontSize: 14 }}>ausentes · {absent.length}</h2>
          {absent.map((r) => (
            <AbsentDoc
              key={`${r.doc.id}::${runId}`}
              doc={r.doc}
              query={query}
              options={options}
              phraseOnlyMiss={r.phraseOnlyMiss}
            />
          ))}
        </section>
      )}
    </main>
  );
}

function AbsentDoc({
  doc,
  query,
  options,
  phraseOnlyMiss,
}: {
  doc: ExampleDocument;
  query: string;
  options: AnalysisOptions;
  phraseOnlyMiss: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<DocumentExplanation | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function explain() {
    setOpen(true);
    if (explanation) return; // this instance is scoped to one search, so it stays valid
    setLoading(true);
    setFailed(null);
    try {
      const [queryWords, docWords] = await Promise.all([
        extractRawWords(query),
        extractRawWords(doc.text),
      ]);
      setExplanation(await explainDocument(queryWords, docWords, options, phraseOnlyMiss));
    } catch (err) {
      setFailed(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginBottom: 8, borderLeft: "2px solid #ccc", paddingLeft: 8 }}>
      <div>
        <strong>{doc.id}</strong>: {doc.text}{" "}
        <button onClick={explain} disabled={loading} aria-expanded={open}>
          {loading ? "analisando..." : "por que não bateu?"}
        </button>
      </div>

      {failed && (
        <p role="alert" style={{ color: "#b91c1c" }}>
          não deu para analisar: {failed}
        </p>
      )}

      {open && explanation && (
        <div style={{ marginTop: 4, marginBottom: 8 }}>
          {explanation.phraseOnlyMiss && (
            <p style={{ fontSize: 12, background: "#fff7ed", padding: 8, margin: "6px 0" }}>
              {PHRASE_ONLY_MISS}
            </p>
          )}
          {explanation.words.map((word) => (
            <LadderView
              key={word.queryWord}
              exp={word}
              maxTokenLength={options.max_token_length}
              phraseOnlyMiss={explanation.phraseOnlyMiss}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LadderView({
  exp,
  maxTokenLength,
  phraseOnlyMiss,
}: {
  exp: LadderExplanation;
  maxTokenLength: number;
  phraseOnlyMiss: boolean;
}) {
  const length = checkMaxLength(exp.queryWord, maxTokenLength);

  return (
    <div style={{ margin: "6px 0", padding: 8, background: "#f7f7f7", fontSize: 12 }}>
      <div>
        <strong>&quot;{exp.queryWord}&quot;</strong>{" "}
        {exp.droppedFromQuery ? (
          droppedFromQueryAdvice(exp.droppedFromQuery.reason, exp.droppedFromQuery.bytes, maxTokenLength)
        ) : phraseOnlyMiss ? (
          <>está neste documento. A frase exata é que não fecha.</>
        ) : exp.kind === "converge" && exp.stage ? (
          <>
            só fica igual a &quot;{exp.docWord}&quot; a partir do estágio {exp.stage}.{" "}
            {convergeAdvice(exp.stage)}
          </>
        ) : exp.kind === "disappeared" && exp.stage ? (
          disappearedAdvice(exp.stage, exp.docWord ?? exp.queryWord)
        ) : (
          NEVER_ADVICE
        )}
      </div>

      {!exp.droppedFromQuery && length.exceeds && (
        <div style={{ color: "#b91c1c", marginTop: 4 }}>
          Separado disso: essa palavra ocupa {length.bytes} bytes
          {length.bytes !== length.chars && ` (${length.chars} caracteres)`}, acima do limite de{" "}
          {maxTokenLength}. Aumente max_token_length para ela virar um token.
        </div>
      )}

      {exp.rows && (
        <table style={{ marginTop: 6, borderCollapse: "collapse" }}>
          <caption style={{ captionSide: "top", textAlign: "left", fontSize: 11, color: "#555" }}>
            o que cada etapa faz com as duas palavras
          </caption>
          <thead>
            <tr>
              <th align="left" scope="col">
                etapa
              </th>
              <th align="left" scope="col">
                busca
              </th>
              <th align="left" scope="col">
                documento
              </th>
              <th align="left" scope="col">
                resultado
              </th>
            </tr>
          </thead>
          <tbody>
            {exp.rows.map((row) => (
              <tr key={row.stage}>
                <th align="left" scope="row" style={{ fontWeight: "normal" }}>
                  {stageLabel(row.stage)}
                </th>
                <td>{row.queryForm ?? "descartada"}</td>
                <td>{row.docForm ?? "descartada"}</td>
                <td>{VERDICT_COPY[row.verdict]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
