# nomatch

One question: why didn't this document show up in my search?

It runs entirely in the browser, on top of [alyze](https://github.com/turbopuffer/alyze), the tokenizer turbopuffer runs in production, compiled to WebAssembly.

## What this is and is not

Read this part first.

- There is no turbopuffer account in this project. It is not affiliated with turbopuffer
- No network call is made to their product. Nothing you paste leaves your browser
- The analysis engine is the real `alyze`, MIT licensed, compiled from a specific commit, recorded in `docs/DECISIONS.md`
- The BM25 ranking is mine, written for this project in TypeScript. It follows the documented meaning of `k1`, `b` and `k3`, but it is not their code and you should not read it as a reference for how their production ranking behaves

Everything below is what I verified. Nothing here claims parity with production search anywhere.

It opens with a corpus loaded and a search already run, so the problem is on screen before you touch anything.

## The problem

A search engine does not store your text. It cuts the text into pieces, called tokens, and stores the pieces. When you search, it cuts your search the same way and compares piece to piece. A match happens only when two tokens are exactly equal.

Stored document: `O café da manhã estava ótimo`
Your search: `cafe`

With `ascii_folding` off, which is the default:

- Token in the document: `café`
- Token in the search: `cafe`
- Equal? No
- Results: zero

The document is there. The word is there. Nothing comes back.

Today the way you find this out is by paying for an account, uploading your data, searching, finding nothing, and then guessing which of five options was the culprit, one at a time.

In English this almost never happens, because English has no accents. It shows up the moment you index Portuguese, French, German or Spanish. That is why I built it.

## What it does

1. Paste a corpus, meaning a list of text documents
2. Type a search
3. Pick two tokenizer configurations, A and B, side by side
4. See which documents come back under each one, ranked by BM25
5. For the ones that did not come back, see which stage of the pipeline killed them, and which option to turn on

Step 5 is the product. The first four are there to make it possible.

## What it does not do

- No calls to the turbopuffer API
- No accounts, no login, no persistence. State lives in the tab
- No file upload. Paste text, or load one of the examples
- No vector search, no embeddings, no hybrid search. Full text only
- No comparing three configurations. Two

## How the stage attribution works

`alyze` returns the final result of the analysis, not the steps it took. To find out which step killed a match, nomatch runs the analyzer several times with the options turning on in cascade, then compares the outputs.

```
S0  tokenize only            case_sensitive: true
S1  + lowercase              case_sensitive: false
S2  + remove stopwords       remove_stopwords: true
S3  + stemming               stemming: true
S4  + ascii folding          ascii_folding: true
```

Stemming and stopword removal only appear from S1 on, because both of them require `case_sensitive: false`.

For one search token against one document token:

- They became equal at some stage: the match needs that stage's option turned on, and that is what the interface tells you to do
- The document token disappeared at some stage: that stage dropped it. The interface names the stage, and for a stopword it names the word
- They never became equal: this is not a configuration problem. They are different words

`max_token_length` sits outside this ladder and is reported on its own, always in bytes.

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000. It opens with the Portuguese corpus and the search `cafe`. Column A is the real defaults, with everything off, and finds one document. Column B has `ascii_folding` on and finds three. The two missing documents spell `café` with the accent.

Click any document under `missing` to see which stage of the pipeline removed it, and a button that applies the fix to the other column so you can read both side by side.

The interface is in English. The Portuguese is in the corpus, which is where the problem lives.

The English corpus fails for a different reason, which is the point of having it: English has no accents, so the same problem is close to invisible. What breaks there is a plural. `cafes` does not find `cafe` until stemming is on.

Building the WASM artifact is a separate job, documented in [CLAUDE.md](CLAUDE.md). The compiled file is committed, so you do not need Rust to run the app.

```bash
npm run test        # the ladder, matching, BM25, byte counts
npm run lint
npx tsc --noEmit
```

## Ranking

BM25, written here, over the tokens `alyze` returns. It decides the order of the documents that already matched, and never decides whether a document comes back.

`k1`, `b` and `k3` are adjustable per column, and moving them reorders the list without re-analyzing anything: the analyzed tokens are already in memory, so a slider costs zero calls to the analyzer. The IDF is the smoothed form, `ln(1 + (N - n + 0.5) / (n + 0.5))`, because the textbook form goes negative on a corpus this small and a negative score on screen costs more trust than the precision is worth.

## License

MIT. `alyze` is MIT too, and its copyright stays with turbopuffer.
