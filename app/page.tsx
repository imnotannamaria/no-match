"use client";

// Phase 1: WASM compiled, in the worker, analyzing one sentence. Nothing
// else. No design system yet, that's fase 6. This page exists to prove the
// pipeline end to end, in both `npm run dev` and a real `npm run build`.

import { useEffect, useState } from "react";
import { analyzerClient } from "@/lib/alyze/client";
import { DEFAULT_OPTIONS, type Token } from "@/lib/alyze/types";

export default function Home() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [text, setText] = useState("O café da manhã estava ótimo");
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asciiFolding, setAsciiFolding] = useState(false);

  useEffect(() => {
    analyzerClient.ready().then(
      () => setReady(true),
      (err: Error) => setBootError(err.message),
    );
  }, []);

  async function runAnalysis() {
    setError(null);
    try {
      const result = await analyzerClient.analyze(text, {
        ...DEFAULT_OPTIONS,
        ascii_folding: asciiFolding,
      });
      setTokens(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setTokens(null);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "monospace", maxWidth: 720 }}>
      <h1>nomatch — phase 1</h1>
      {bootError ? (
        <p role="alert" style={{ color: "red" }}>
          o analisador não carregou: {bootError}. Sem ele nada aqui funciona.
        </p>
      ) : (
        <p>{ready ? "analyzer loaded" : "loading analyzer..."}</p>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        style={{ width: "100%", fontFamily: "monospace", fontSize: 14 }}
      />

      <div style={{ margin: "8px 0" }}>
        <label>
          <input
            type="checkbox"
            checked={asciiFolding}
            onChange={(e) => setAsciiFolding(e.target.checked)}
          />
          {" "}ascii_folding
        </label>
      </div>

      <button onClick={runAnalysis} disabled={!ready}>
        analyze
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {tokens && (
        <table style={{ marginTop: 16, borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th align="left">position</th>
              <th align="left">text</th>
              <th align="left">byte range</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((t, i) => (
              <tr key={i}>
                <td>{t.position}</td>
                <td>{t.text}</td>
                <td>[{t.start}, {t.end})</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
