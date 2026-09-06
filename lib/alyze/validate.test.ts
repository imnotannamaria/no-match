import { describe, expect, it } from "vitest";
import { canEnableCaseSensitive, sanitizeOptions } from "@/lib/alyze/validate";
import { DEFAULT_OPTIONS } from "@/lib/alyze/types";

describe("canEnableCaseSensitive", () => {
  it("allows case_sensitive when stemming and stopwords are both off", () => {
    expect(canEnableCaseSensitive({ stemming: false, remove_stopwords: false })).toBe(true);
  });

  it("blocks case_sensitive when stemming is on", () => {
    expect(canEnableCaseSensitive({ stemming: true, remove_stopwords: false })).toBe(false);
  });

  it("blocks case_sensitive when remove_stopwords is on", () => {
    expect(canEnableCaseSensitive({ stemming: false, remove_stopwords: true })).toBe(false);
  });
});

describe("sanitizeOptions", () => {
  it("leaves valid options untouched", () => {
    const options = { ...DEFAULT_OPTIONS, case_sensitive: false, stemming: true };
    expect(sanitizeOptions(options)).toEqual(options);
  });

  it("forces case_sensitive off when stemming is on", () => {
    const options = { ...DEFAULT_OPTIONS, case_sensitive: true, stemming: true };
    expect(sanitizeOptions(options).case_sensitive).toBe(false);
  });

  it("forces case_sensitive off when remove_stopwords is on", () => {
    const options = { ...DEFAULT_OPTIONS, case_sensitive: true, remove_stopwords: true };
    expect(sanitizeOptions(options).case_sensitive).toBe(false);
  });

  it("never invents the invalid combination it's supposed to block", () => {
    const options = { ...DEFAULT_OPTIONS, case_sensitive: true, stemming: true, remove_stopwords: true };
    const result = sanitizeOptions(options);
    expect(result.case_sensitive && (result.stemming || result.remove_stopwords)).toBe(false);
  });
});
