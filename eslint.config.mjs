import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored wasm-bindgen glue, built from turbopuffer/alyze. Not ours to
    // lint. See CLAUDE.md, "Building the WASM artifact".
    "public/wasm/**",
  ]),
]);

export default eslintConfig;
