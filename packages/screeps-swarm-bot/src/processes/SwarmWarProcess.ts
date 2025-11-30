import { process } from "@ralphschuler/screeps-kernel";
import { Logger } from "@ralphschuler/screeps-logger";
import { DANGER_THRESHOLDS } from "../constants.js";
import { SwarmMemoryManager } from "../memory/SwarmMemoryManager.js";
import type { SwarmProcessContext, SwarmRoomMemory } from "../types.js";

@process({ name: "SwarmWarProcess", priority: 82, singleton: true })
export class SwarmWarProcess {
  private readonly memoryManager = new SwarmMemoryManager(new Logger({ minLevel: "info" }));
  private readonly logger = new Logger({ minLevel: "info" }).child({ system: "swarm-war" });

  public run(ctx: SwarmProcessContext): void {
    const swarm = this.memoryManager.getOrInit(ctx.memory);
    for (const [roomName, roomMemory] of Object.entries(swarm.rooms)) {
      const room = ctx.game.rooms[roomName];
      if (!room) continue;
      this.adjustWarSignals(roomMemory, room, ctx);
    }
  }

  private adjustWarSignals(roomMemory: SwarmRoomMemory, room: Room, ctx: SwarmProcessContext): void {
    const hostiles = room.find(FIND_HOSTILE_CREEPS).length;
    if (hostiles > 0) {
      roomMemory.pheromones.war += hostiles * 1.5;
      roomMemory.pheromones.defense ??= 0;
      roomMemory.pheromones.defense += hostiles;
      this.memoryManager.pushEvent(roomMemory, "hostileSeen", ctx.game.time);
      this.logger.debug?.("War pheromone raised", { room: room.name, hostiles });
    } else {
      roomMemory.pheromones.war *= 0.8;
      roomMemory.pheromones.defense = Math.max(0, (roomMemory.pheromones.defense ?? 0) * 0.8);
    }

    if (roomMemory.danger >= DANGER_THRESHOLDS.underAttack) {
      roomMemory.pheromones.war += 3;
      roomMemory.pheromones.defense = Math.max(roomMemory.pheromones.defense ?? 0, 5);
    }

    const incomingNukes = room.find(FIND_NUKES).length;
    if (incomingNukes > 0) {
      roomMemory.pheromones.siege = (roomMemory.pheromones.siege ?? 0) + incomingNukes * 2;
      this.memoryManager.pushEvent(roomMemory, "nukeIncoming", ctx.game.time);
    }
  }
}
