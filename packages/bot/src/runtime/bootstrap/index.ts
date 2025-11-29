/**
 * Bootstrap module exports.
 * The legacy Kernel has been decomposed into separate processes managed by @ralphschuler/screeps-kernel.
 * See packages/bot/src/runtime/processes/ for individual process implementations.
 */
export { BootstrapPhaseManager } from "./BootstrapPhaseManager";
export type { BootstrapConfig, BootstrapStatus } from "./BootstrapPhaseManager";
export { InitializationManager } from "./InitializationManager";
export type { InitPhase, InitializationConfig, InitMemory, InitTickResult } from "./InitializationManager";
