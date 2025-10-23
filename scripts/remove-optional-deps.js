#!/usr/bin/env node
// Temporarily removes optionalDependencies to avoid isolated-vm build issues in CI
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const packageJsonPath = resolve("package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

// Remove optionalDependencies section to avoid isolated-vm Python 2 build issues
delete packageJson.optionalDependencies;

// Add needed devDependencies to regular dependencies for production build
if (packageJson.devDependencies) {
  packageJson.dependencies = packageJson.dependencies || {};
  packageJson.dependencies.tsx = packageJson.devDependencies.tsx;
  packageJson.dependencies.marked = packageJson.devDependencies.marked;
}

writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log("Removed optionalDependencies from package.json");
