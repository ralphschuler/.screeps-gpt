import { process } from "@ralphschuler/screeps-kernel";
import { Logger } from "@ralphschuler/screeps-logger";
import { MIN_EXPAND_SIGNAL } from "../constants.js";
import { SwarmMemoryManager } from "../memory/SwarmMemoryManager.js";
import type { SwarmProcessContext, SwarmRoomMemory } from "../types.js";

@process({ name: "SwarmExpansionProcess", priority: 85, singleton: true })
export class SwarmExpansionProcess {
  private readonly memoryManager = new SwarmMemoryManager(new Logger({ minLevel: "info" }));

  public run(ctx: SwarmProcessContext): void {
    const swarm = this.memoryManager.getOrInit(ctx.memory);
    for (const roomName of Object.keys(ctx.game.rooms)) {
      const roomMemory = swarm.rooms[roomName];
      if (!roomMemory) continue;
      if (roomMemory.pheromones.expand < MIN_EXPAND_SIGNAL) continue;
      this.enqueueNeighbors(roomName, roomMemory, swarm, ctx);
    }
  }

  private enqueueNeighbors(roomName: string, roomMemory: SwarmRoomMemory, swarm: ReturnType<SwarmMemoryManager["getOrInit"]>, ctx: SwarmProcessContext): void {
    const exits = ctx.game.map.describeExits(roomName);
    if (!exits) return;
    const queue = new Set(swarm.overmind.claimQueue);
    for (const neighborName of Object.values(exits)) {
      if (!neighborName) continue;
      if (!queue.has(neighborName)) {
        queue.add(neighborName);
        swarm.rooms[neighborName] = this.memoryManager.getOrInitRoom(swarm, neighborName);
        swarm.rooms[neighborName].pheromones.expand += Math.max(2, roomMemory.pheromones.expand * 0.25);
      }
    }
    swarm.overmind.claimQueue = Array.from(queue);
  }
}
