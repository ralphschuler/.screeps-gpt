/**
 * ESLint Flat Configuration
 *
 * Migrated from .eslintrc.cjs to flat config format (ESLint v9+)
 * Requires Node.js 18+ (for native structuredClone support)
 */

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
      "**/dist/**",
      "build/**",
      "coverage/**",
      "node_modules/**",
      "*.config.ts",
      "eslint.config.mjs",
      "src/**",
      "scripts/**",
      "docs/**",
      "source/**",
      "themes/**",
      "**/examples/**",
      "**/*.d.ts",
      "**/*.js",
      "**/*.js.map",
      "**/*.d.ts.map"
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

      // Deprecation detection rules
      "@typescript-eslint/no-deprecated": "warn",

      // Prettier integration (disable conflicting rules)
      ...prettierConfig.rules
    }
  },

  // Memory-intensive type-checking rules for core source files only
  {
    files: ["packages/bot/src/**/*.ts"],
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

  // Stricter type safety rules for runtime files
  {
    files: ["packages/bot/src/runtime/**/*.ts"],
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
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error"
    }
  },

  // Exception: Profiler initialization in main.ts requires unsafe operations for global exposure.
  // These rules are disabled only for this file to allow integration with the profiler system.
  {
    files: ["packages/bot/src/main.ts"],
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
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off"
    }
  },

  // Override for script files (*.mjs)
  {
    files: ["packages/utilities/scripts/**/*.mjs"],
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
