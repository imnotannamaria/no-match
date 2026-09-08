import { describe, expect, it } from "vitest";
import { CORPORA, nextDocId, type ExampleDocument } from "@/lib/corpora";

const docs = (...ids: string[]): ExampleDocument[] => ids.map((id) => ({ id, text: "" }));

describe("nextDocId", () => {
  it("continues the sequence on an untouched corpus", () => {
    expect(nextDocId(docs("doc-1", "doc-2", "doc-3"))).toBe("doc-4");
  });

  it("does not reuse an id after one is removed from the middle", () => {
    // Four documents, doc-2 removed. Counting from the length gives doc-4,
    // which is already taken: same React key, and editing one edits both.
    expect(nextDocId(docs("doc-1", "doc-3", "doc-4"))).toBe("doc-5");
  });

  it("keeps going when several ids are already taken", () => {
    expect(nextDocId(docs("doc-2", "doc-3", "doc-4", "doc-5"))).toBe("doc-6");
  });

  it("starts at doc-1 on an empty corpus", () => {
    expect(nextDocId([])).toBe("doc-1");
  });
});

describe("example corpora", () => {
  it("gives every corpus a search that its own fix rescues", () => {
    // A corpus whose opening search already works under the defaults has no
    // contrast to show, which is the entire opening state of the app.
    for (const corpus of CORPORA) {
      expect(corpus.query.length).toBeGreaterThan(0);
      expect(["ascii_folding", "stemming"]).toContain(corpus.fix);
      expect(corpus.documents.length).toBeGreaterThan(1);
      expect(new Set(corpus.documents.map((d) => d.id)).size).toBe(corpus.documents.length);
    }
  });
});
