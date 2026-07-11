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
    // Third-party minified files
    "public/pdf.worker.min.mjs",
  ]),
  {
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-explicit-any": "off",
      // Downgrade React Compiler rules to warnings — codebase uses valid
      // patterns (setState in effects, Date.now in handlers) that the
      // Compiler flags but are not actual bugs. Fix incrementally.
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);

export default eslintConfig;
