import { process } from "@ralphschuler/screeps-kernel";
import { Logger } from "@ralphschuler/screeps-logger";
import type { SwarmProcessContext } from "../types.js";

@process({ name: "SwarmDefenseProcess", priority: 90, singleton: true })
export class SwarmDefenseProcess {
  private readonly logger = new Logger({ minLevel: "info" }).child({ system: "swarm-defense" });

  public run(ctx: SwarmProcessContext): void {
    for (const room of Object.values(ctx.game.rooms)) {
      const towers = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } }) as StructureTower[];
      if (towers.length === 0) continue;
      if (this.reinforceAgainstNukes(room, towers)) continue;

      const hostiles = room.find(FIND_HOSTILE_CREEPS);
      if (hostiles.length === 0) continue;

      const prioritized = this.prioritizeHostiles(hostiles);
      if (!prioritized) continue;
      this.logger.debug?.("Defending room", { room: room.name, target: prioritized.name });
      for (const tower of towers) {
        tower.attack(prioritized);
      }
    }
  }

  private prioritizeHostiles(hostiles: Creep[]): Creep | null {
    const priorityOrder: BodyPartConstant[] = [HEAL, RANGED_ATTACK, ATTACK, CLAIM, WORK, CARRY, MOVE];
    for (const part of priorityOrder) {
      const target = hostiles.find(creep => creep.getActiveBodyparts(part) > 0);
      if (target) return target;
    }
    return hostiles[0] ?? null;
  }

  private reinforceAgainstNukes(room: Room, towers: StructureTower[]): boolean {
    const nukes = room.find(FIND_NUKES);
    if (nukes.length === 0) return false;
    const impact = nukes[0];
    if (!impact) return false;
    const rampart = room.lookForAt(LOOK_STRUCTURES, impact.pos).find(
      s => s.structureType === STRUCTURE_RAMPART
    ) as StructureRampart | undefined;
    if (!rampart) return false;
    for (const tower of towers) {
      tower.repair(rampart);
    }
    return true;
  }
}
