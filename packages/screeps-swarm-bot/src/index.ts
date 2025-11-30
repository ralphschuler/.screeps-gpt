import { Kernel } from "@ralphschuler/screeps-kernel";
import { Logger } from "@ralphschuler/screeps-logger";
import type { SwarmMemoryRoot } from "./types.js";
import "./processes/index.js";

const kernel = new Kernel({
  logger: new Logger({ minLevel: "info" }) as unknown as import("@ralphschuler/screeps-kernel").Logger
});

/**
 * Screeps entrypoint wiring the swarm processes into the kernel.
 */
export function loop(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kernel.run(Game as any, Memory as SwarmMemoryRoot);
}

export * from "./types.js";
export * from "./constants.js";
export * from "./blueprints.js";
export * from "./nukeScoringEngine.js";
export * from "./pheromones.js";
export * from "./roles/index.js";
export * from "./behavior/index.js";
export * from "./core/logger.js";
export * from "./core/profiler.js";
export * from "./core/scheduler.js";
export * from "./logic/evolution.js";
export * from "./logic/expansionLogic.js";
export * from "./logic/defenseLogic.js";
export * from "./logic/nukes.js";
export * from "./logic/clusterLogic.js";
export * from "./logic/market.js";
export * from "./intershard/schema.js";
