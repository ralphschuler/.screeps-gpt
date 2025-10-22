// Flat ESLint config migrated from legacy .eslintrc.cjs to resolve structuredClone crash.
// Node 16 lacks global structuredClone; ESLint/@typescript-eslint expects it. Provide shim early.
import { structuredClone as nodeStructuredClone } from 'node:util';
if (typeof global.structuredClone !== 'function') {
  // shim sufficient for rule metadata cloning
  // @ts-ignore
  global.structuredClone = nodeStructuredClone;
}

import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    files: ['**/*.ts'],
    ignores: [
      'dist',
      'build',
      'coverage',
      'node_modules',
      '*.js',
      '*.mjs',
      '*.cjs',
      '*.config.ts'
    ],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin
    },
    rules: {
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-use-before-define': ['error', { functions: false }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface']
    }
  },
  // Override for scripts using mjs (none currently but retain parity with legacy config)
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      parserOptions: {
        sourceType: 'module',
        project: null
      }
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off'
    }
  },
  // Apply prettier last (flat config style)
  prettierConfig
];
