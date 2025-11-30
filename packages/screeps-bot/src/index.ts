/**
 * Screeps Bot - Ant Colony Swarm Intelligence
 *
 * Main entry point for the pheromone-based coordination bot.
 *
 * @module screeps-bot
 */

// Core exports
export { logger, LogLevel, configureLogger, createLogger } from "./core/logger";
export { profiler, type ProfilerMemory, type RoomProfileData } from "./core/profiler";
export {
  scheduler,
  type BucketMode,
  type TaskFrequency,
  createHighFrequencyTask,
  createMediumFrequencyTask,
  createLowFrequencyTask
} from "./core/scheduler";
export { roomManager, RoomNode, RoomManager } from "./core/roomNode";

// Memory exports
export * from "./memory/schemas";
export { memoryManager, MemoryManager } from "./memory/manager";

// Logic exports
export { pheromoneManager, PheromoneManager, RollingAverage, DEFAULT_PHEROMONE_CONFIG } from "./logic/pheromone";
export {
  evolutionManager,
  postureManager,
  EvolutionManager,
  PostureManager,
  calculateDangerLevel,
  EVOLUTION_STAGES,
  POSTURE_PROFILES,
  POSTURE_RESOURCE_PRIORITIES
} from "./logic/evolution";

// Utils exports
export * from "./utils/weightedSelection";

// Layouts exports
export {
  getBlueprintForStage,
  getBlueprintForRCL,
  getStructuresForRCL,
  type Blueprint,
  type StructurePlacement
} from "./layouts/blueprints";

// Main bot class
export { SwarmBot } from "./SwarmBot";
