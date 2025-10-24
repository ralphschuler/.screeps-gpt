/**
 * ESLint Flat Configuration
 *
 * Migrated from .eslintrc.cjs to flat config format (ESLint v9+)
 * Requires structuredClone polyfill for Node.js 16 compatibility
 */

// Load polyfill first (before any ESLint modules)
import { createRequire } from "module";
const require = createRequire(import.meta.url);
require("./.eslintrc-polyfill.cjs");

import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import prettierConfig from "eslint-config-prettier";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default [
  // Global ignores (applies to all configs)
  {
    ignores: [
      "dist/**",
      "build/**",
      "coverage/**",
      "node_modules/**",
      "*.config.ts",
      "eslint.config.js.bak",
      "eslint.config.mjs",
      ".eslintrc-polyfill.cjs",
      ".eslintrc.cjs"
    ]
  },

  // TypeScript files configuration (memory-optimized)
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin
    },
    rules: {
      // TypeScript recommended rules (without expensive type-checking rules)
      ...tsPlugin.configs["recommended"].rules,

      // Custom rules (from original .eslintrc.cjs)
      "@typescript-eslint/explicit-member-accessibility": ["error", { accessibility: "explicit" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-use-before-define": ["error", { functions: false }],
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],

      // Prettier integration (disable conflicting rules)
      ...prettierConfig.rules
    }
  },

  // Memory-intensive type-checking rules for core source files only
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin
    },
    rules: {
      // Enable expensive type-checking rules only for core source code
      ...tsPlugin.configs["recommended-requiring-type-checking"].rules
    }
  },

  // Override for script files (*.mjs)
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: "module",
        project: null
      },
      globals: {
        node: true
      }
    },
    rules: {
      "@typescript-eslint/no-var-requires": "off"
    }
  }
];
