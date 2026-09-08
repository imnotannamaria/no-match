import { describe, expect, it } from "vitest";
import { toSchema, toSchemaJson } from "@/lib/alyze/schema";
import { DEFAULT_OPTIONS } from "@/lib/alyze/types";

describe("toSchema", () => {
  it("uses the full_text_search parameter names exactly", () => {
    // The panel exists so a person can read the configuration and paste it
    // somewhere useful. A renamed key would quietly make that useless.
    const keys = Object.keys(toSchema(DEFAULT_OPTIONS).full_text_search).sort();
    expect(keys).toEqual([
      "ascii_folding",
      "case_sensitive",
      "language",
      "max_token_length",
      "remove_stopwords",
      "stemming",
    ]);
  });

  it("carries the values through unchanged", () => {
    const options = {
      ...DEFAULT_OPTIONS,
      ascii_folding: true,
      language: "portuguese",
      max_token_length: 64,
    };
    expect(toSchema(options).full_text_search).toMatchObject({
      ascii_folding: true,
      language: "portuguese",
      max_token_length: 64,
    });
  });

  it("produces JSON a person can read", () => {
    const json = toSchemaJson(DEFAULT_OPTIONS);
    expect(json).toContain('"full_text_search"');
    expect(json).toContain('"max_token_length": 39');
    expect(JSON.parse(json)).toEqual(toSchema(DEFAULT_OPTIONS));
  });
});
