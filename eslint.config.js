import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const targetFiles = ["src/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts", "types.d.ts"];

const typeChecked = tseslint.configs.recommendedTypeChecked.map(config => ({
  ...config,
  files: targetFiles,
  languageOptions: {
    ...config.languageOptions,
    parserOptions: {
      ...(config.languageOptions?.parserOptions ?? {}),
      project: path.join(__dirname, "tsconfig.json"),
      tsconfigRootDir: __dirname,
    },
  },
}));

export default [
  {
    ignores: ["dist", "build", "coverage", "node_modules"],
  },
  js.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: {
        console: "readonly",
        fetch: "readonly",
        process: "readonly",
      },
    },
  },
  ...typeChecked,
  {
    files: targetFiles,
    rules: {
      ...prettier.rules,
      "@typescript-eslint/explicit-member-accessibility": ["error", { accessibility: "explicit" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-use-before-define": ["error", { functions: false }],
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
    },
  },
];
