// Two example corpora, each failing for its own reason.
//
// Portuguese is the point: `cafe` does not find `café` until accents are
// folded. English has no accents, so the same problem is close to
// invisible there, and the example that does break is a plural: `cafes`
// does not find `cafe` until stemming is on. Two corpora, two different
// options, same lesson about tokens being compared rather than words.

export interface ExampleDocument {
  id: string;
  text: string;
}

export interface Corpus {
  id: string;
  label: string;
  language: string;
  /** The search that opens with this corpus and returns almost nothing under the defaults. */
  query: string;
  /**
   * The option that brings the missing documents back for this corpus, and
   * the one column B opens with. Each corpus fails for its own reason:
   * Portuguese on accents, English on plurals.
   */
  fix: "ascii_folding" | "stemming";
  documents: ExampleDocument[];
}

export const CORPUS_PT: Corpus = {
  id: "pt",
  label: "português",
  language: "portuguese",
  query: "cafe",
  fix: "ascii_folding",
  documents: [
    { id: "doc-1", text: "O café da manhã estava ótimo" },
    { id: "doc-2", text: "Ela pediu um cafe gelado no verão" },
    { id: "doc-3", text: "O restaurante fechou antes do almoço" },
    { id: "doc-4", text: "Tomamos café e conversamos a manhã inteira" },
  ],
};

export const CORPUS_EN: Corpus = {
  id: "en",
  label: "english",
  language: "english",
  query: "cafes",
  fix: "stemming",
  documents: [
    { id: "doc-1", text: "The cafe on the corner opens at six" },
    { id: "doc-2", text: "She reviewed three cafes last month" },
    { id: "doc-3", text: "The restaurant closed before lunch" },
    { id: "doc-4", text: "Every cafe in town raised its prices" },
  ],
};

export const CORPORA: Corpus[] = [CORPUS_PT, CORPUS_EN];
