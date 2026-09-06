"use client";

// Phase 2: corpus, search, and the binary answer of matched or did not
// match. Still deliberately plain — no design system yet, that's phase 6.
// One configuration only; A/B comparison is phase 5.

import { useEffect, useState } from "react";
import { analyzerClient } from "@/lib/alyze/client";
import { sanitizeOptions, canEnableCaseSensitive } from "@/lib/alyze/validate";
import { DEFAULT_OPTIONS, type AnalysisOptions, type Token } from "@/lib/alyze/types";
import { matchDocument } from "@/lib/search/match";
import { EXAMPLE_CORPUS_PT, type ExampleDocument } from "@/lib/corpora/example-pt";

interface DocResult {
  doc: ExampleDocument;
  matched: boolean;
  matchedTerms: string[];
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
    try {
      const queryTokens: Token[] = await analyzerClient.analyze(query, options);
      const docResults = await Promise.all(
        docs.map(async (doc) => {
          const docTokens = await analyzerClient.analyze(doc.text, options);
          const { matched, matchedTerms } = matchDocument(queryTokens, docTokens, { phrase });
          return { doc, matched, matchedTerms };
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
      <h1>nomatch — phase 2</h1>
      {bootError ? (
        <p role="alert" style={{ color: "red" }}>
          o analisador não carregou: {bootError}. Sem ele nada aqui funciona.
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
        {error && <p style={{ color: "red" }}>{error}</p>}
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
            />
            <button onClick={() => removeDoc(d.id)}>×</button>
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
          <ul>
            {absent.map((r) => (
              <li key={r.doc.id}>
                <strong>{r.doc.id}</strong>: {r.doc.text}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
