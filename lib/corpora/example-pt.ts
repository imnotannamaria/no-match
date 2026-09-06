// A small starter corpus in Portuguese. doc-1 is the founding example from
// README.md: "café" only matches a search for "cafe" once ascii_folding is
// on. Phase 6 grows this into a full example set; this is enough to drive
// phase 2's corpus editor and prove OR and phrase matching against
// something real.

export interface ExampleDocument {
  id: string;
  text: string;
}

export const EXAMPLE_CORPUS_PT: ExampleDocument[] = [
  { id: "doc-1", text: "O café da manhã estava ótimo" },
  { id: "doc-2", text: "Ela pediu um cafe gelado no verão" },
  { id: "doc-3", text: "O restaurante fechou antes do almoço" },
  { id: "doc-4", text: "Tomamos café e conversamos a manhã inteira" },
];
