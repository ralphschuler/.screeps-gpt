import { process } from "@ralphschuler/screeps-kernel";
import { Logger } from "@ralphschuler/screeps-logger";
import { selectBlueprint } from "../blueprints.js";
import { SwarmMemoryManager } from "../memory/SwarmMemoryManager.js";
import type { SwarmProcessContext, SwarmRoomMemory } from "../types.js";

@process({ name: "SwarmBlueprintProcess", priority: 75, singleton: true })
export class SwarmBlueprintProcess {
  private readonly memoryManager = new SwarmMemoryManager(new Logger({ minLevel: "info" }));

  public run(ctx: SwarmProcessContext): void {
    const swarm = this.memoryManager.getOrInit(ctx.memory);
    for (const [roomName, room] of Object.entries(ctx.game.rooms)) {
      const roomMemory = this.memoryManager.getOrInitRoom(swarm, roomName);
      this.applyBlueprint(roomMemory, room as Room);
    }
  }

  private applyBlueprint(roomMemory: SwarmRoomMemory, room: Room): void {
    const controllerLevel = room.controller?.level ?? 0;
    const blueprint = selectBlueprint(controllerLevel);
    roomMemory.blueprintId = blueprint.id;

    const existing = new Set(
      room.find(FIND_MY_STRUCTURES).map(struct => `${struct.structureType}:${struct.pos.x}:${struct.pos.y}`)
    );

    let deficit = 0;
    for (const placement of blueprint.structures) {
      const key = `${placement.type}:${placement.x}:${placement.y}`;
      if (!existing.has(key)) {
        deficit += 1;
        // Only attempt to place buildable structures
        if (
          placement.type !== STRUCTURE_CONTROLLER &&
          placement.type !== STRUCTURE_KEEPER_LAIR &&
          placement.type !== STRUCTURE_PORTAL &&
          placement.type !== STRUCTURE_POWER_BANK
        ) {
          this.ensureConstructionSite(
            room,
            placement as { type: BuildableStructureConstant; x: number; y: number },
            controllerLevel
          );
        }
      }
    }

    if (deficit > 0) {
      roomMemory.pheromones.build += Math.min(5, deficit);
    }
  }

  private ensureConstructionSite(
    room: Room,
    placement: { type: BuildableStructureConstant; x: number; y: number },
    controllerLevel: number
  ): void {
    const allowed = CONTROLLER_STRUCTURES[placement.type]?.[controllerLevel] ?? 0;
    if (allowed === 0) return;

    const existingSites = room.find(FIND_CONSTRUCTION_SITES, {
      filter: site => site.structureType === placement.type
    });
    const existingStructures = room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === placement.type
    });

    if (existingSites.length + existingStructures.length >= allowed) return;

    const pos = new RoomPosition(placement.x, placement.y, room.name);
    if (pos.x < 1 || pos.x > 48 || pos.y < 1 || pos.y > 48) return;
    if (room.lookForAt(LOOK_STRUCTURES, pos).length > 0) return;
    room.createConstructionSite(pos, placement.type);
  }
}
