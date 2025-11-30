import { process } from "@ralphschuler/screeps-kernel";
import { Logger } from "@ralphschuler/screeps-logger";
import { LOGISTICS_DEFICIT, LOGISTICS_SURPLUS, MAX_LOGISTICS_ROUTES } from "../constants.js";
import { SwarmMemoryManager } from "../memory/SwarmMemoryManager.js";
import type { SwarmLogisticsRoute, SwarmProcessContext, SwarmRoomMemory } from "../types.js";

@process({ name: "SwarmLogisticsProcess", priority: 77, singleton: true })
export class SwarmLogisticsProcess {
  private readonly memoryManager = new SwarmMemoryManager(new Logger({ minLevel: "info" }));
  private readonly logger = new Logger({ minLevel: "info" }).child({ system: "swarm-logistics" });

  public run(ctx: SwarmProcessContext): void {
    const swarm = this.memoryManager.getOrInit(ctx.memory);
    const rooms = Object.entries(ctx.game.rooms);

    for (const [roomName] of rooms) {
      this.memoryManager.getOrInitRoom(swarm, roomName);
    }

    for (const roomMemory of Object.values(swarm.rooms)) {
      delete roomMemory.logisticsNeed;
    }

    const surplus = rooms
      .map(([name, room]) => ({ name, room, energy: room.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0 }))
      .filter(entry => entry.energy > LOGISTICS_SURPLUS)
      .sort((a, b) => b.energy - a.energy);

    const deficits = rooms
      .map(([name, room]) => ({ name, room, energy: room.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0 }))
      .filter(entry => entry.energy > 0 && entry.energy < LOGISTICS_DEFICIT)
      .sort((a, b) => a.energy - b.energy);

    const routes: SwarmLogisticsRoute[] = [];
    for (const deficit of deficits) {
      const donor = surplus.shift();
      if (!donor) break;
      const amount = Math.min(donor.energy - LOGISTICS_SURPLUS, LOGISTICS_DEFICIT - deficit.energy);
      if (amount <= 0) continue;
      routes.push({ from: donor.name, to: deficit.name, amount });
      donor.energy -= amount;
      if (donor.energy > LOGISTICS_SURPLUS) {
        surplus.push(donor);
        surplus.sort((a, b) => b.energy - a.energy);
      }
      this.flagLogisticsNeed(swarm.rooms[deficit.name], amount);
    }

    swarm.logisticsRoutes = routes.slice(0, MAX_LOGISTICS_ROUTES);
    if (routes.length > 0) {
      this.logger.debug?.("Planned logistics routes", { routes: swarm.logisticsRoutes });
    }
  }

  private flagLogisticsNeed(roomMemory: SwarmRoomMemory | undefined, amount: number): void {
    if (!roomMemory) return;
    roomMemory.logisticsNeed = amount;
    roomMemory.pheromones.logistics = Math.max(roomMemory.pheromones.logistics, Math.ceil(amount / 1000));
  }
}
