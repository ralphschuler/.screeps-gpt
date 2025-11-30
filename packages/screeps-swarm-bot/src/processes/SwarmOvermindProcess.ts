import { process } from "@ralphschuler/screeps-kernel";
import { Logger } from "@ralphschuler/screeps-logger";
import { OVERMIND_INTERVAL, MIN_EXPAND_SIGNAL } from "../constants.js";
import { SwarmMemoryManager } from "../memory/SwarmMemoryManager.js";
import type { SwarmProcessContext, SwarmRoomMemory } from "../types.js";
import { calculateNukeScore, isNukeCandidate } from "../nukeScoringEngine.js";
import { updateOvermind } from "../logic/overmind.js";
import { shouldRunLow } from "../core/scheduler.js";

/**
 * Slow-changing global coordination layer that consumes pheromone signals and
 * produces strategic queues (claims, war targets, nuke candidates).
 */
@process({ name: "SwarmOvermindProcess", priority: 100, singleton: true })
export class SwarmOvermindProcess {
  private readonly memoryManager = new SwarmMemoryManager(new Logger({ minLevel: "info" }));

  public run(ctx: SwarmProcessContext): void {
    const swarmMemory = this.memoryManager.getOrInit(ctx.memory);
    const overmind = swarmMemory.overmind;

    if (overmind.lastRun > ctx.game.time || !shouldRunLow(ctx.game.time)) {
      return;
    }

    this.captureRoomsSeen(ctx);
    this.rebuildQueues(swarmMemory.rooms);
    updateOvermind(swarmMemory, []);
    overmind.lastRun = ctx.game.time + OVERMIND_INTERVAL;
  }

  private captureRoomsSeen(ctx: SwarmProcessContext): void {
    const swarmMemory = this.memoryManager.getOrInit(ctx.memory);
    for (const roomName of Object.keys(ctx.game.rooms)) {
      swarmMemory.overmind.roomsSeen[roomName] = ctx.game.time;
    }
  }

  private rebuildQueues(rooms: Record<string, SwarmRoomMemory>): void {
    const claimQueue: Array<{ room: string; score: number }> = [];
    const warTargets: Array<{ room: string; score: number }> = [];
    const nukeCandidates: Array<{ room: string; score: number }> = [];

    for (const [roomName, memory] of Object.entries(rooms)) {
      const expandSignal = memory.pheromones.expand;
      if (expandSignal >= MIN_EXPAND_SIGNAL) {
        claimQueue.push({ room: roomName, score: expandSignal });
      }

      if (memory.intent === "war" || memory.pheromones.war > 8) {
        warTargets.push({ room: roomName, score: memory.pheromones.war });
      }

      const hostileStructures = memory.pheromones.nukeTarget;
      const score = calculateNukeScore({
        enemyRcl: memory.colonyLevel,
        hostileStructures,
        warPheromone: memory.pheromones.war,
        distance: 1
      });
      if (isNukeCandidate(score)) {
        nukeCandidates.push({ room: roomName, score });
      }
    }

    const swarmMemory = this.memoryManager.getOrInit(ctx.memory);
    swarmMemory.overmind.claimQueue = this.orderByScore(claimQueue);
    swarmMemory.overmind.warTargets = this.orderByScore(warTargets);
    swarmMemory.overmind.nukeCandidates = this.orderByScore(nukeCandidates);
  }

  private orderByScore(entries: Array<{ room: string; score: number }>): string[] {
    return entries
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.room);
  }
}
