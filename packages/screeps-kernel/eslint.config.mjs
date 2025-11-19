import rootConfig from "../../eslint.config.mjs";

export default [
  ...rootConfig,
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off", // Decorator classes are "used" by decorator
      "@typescript-eslint/explicit-member-accessibility": "off" // Test classes don't need explicit modifiers
    }
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off" // Generic kernel needs 'any' for flexibility
    }
  }
];
