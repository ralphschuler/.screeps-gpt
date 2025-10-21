module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier"
  ],
  ignorePatterns: [
    "dist",
    "build",
    "coverage",
    "node_modules",
    "*.js",
    "*.mjs",
    "*.cjs",
    "*.config.ts",
    "eslint.config.js.bak"
  ],
  rules: {
    "@typescript-eslint/explicit-member-accessibility": ["error", { accessibility: "explicit" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-use-before-define": ["error", { functions: false }],
    "@typescript-eslint/consistent-type-definitions": ["error", "interface"]
  },
  overrides: [
    {
      files: ["scripts/**/*.mjs"],
      parserOptions: {
        sourceType: "module",
        project: null
      },
      rules: {
        "@typescript-eslint/no-var-requires": "off"
      },
      env: {
        node: true,
        es2020: true
      }
    }
  ]
};
