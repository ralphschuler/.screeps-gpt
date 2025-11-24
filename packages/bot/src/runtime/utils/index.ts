// Runtime utilities module - entry point for modular build
export { Diagnostics } from "./Diagnostics";
export { logger, createComponentLogger } from "./logger";
// Re-export safeSerialize from logger package for convenience
export { safeSerialize } from "@ralphschuler/screeps-logger";
