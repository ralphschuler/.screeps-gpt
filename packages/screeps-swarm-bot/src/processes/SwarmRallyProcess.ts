import { process } from "@ralphschuler/screeps-kernel";
import { Logger } from "@ralphschuler/screeps-logger";
import { DANGER_THRESHOLDS, RALLY_WAR_THRESHOLD } from "../constants.js";
import { SwarmMemoryManager } from "../memory/SwarmMemoryManager.js";
import type { SwarmProcessContext } from "../types.js";

@process({ name: "SwarmRallyProcess", priority: 83, singleton: true })
export class SwarmRallyProcess {
  private readonly memoryManager = new SwarmMemoryManager(new Logger({ minLevel: "info" }));
  private readonly logger = new Logger({ minLevel: "info" }).child({ system: "swarm-rally" });

  public run(ctx: SwarmProcessContext): void {
    const swarm = this.memoryManager.getOrInit(ctx.memory);
    const primaryTarget = swarm.overmind.warTargets[0];
    const rallies: Record<string, string> = {};

    for (const [roomName, roomMemory] of Object.entries(swarm.rooms)) {
      const isFrontline =
        roomMemory.danger >= DANGER_THRESHOLDS.underAttack ||
        roomMemory.pheromones.war >= RALLY_WAR_THRESHOLD;
      const rallyTarget = isFrontline ? roomName : primaryTarget && primaryTarget !== roomName ? primaryTarget : undefined;
      if (rallyTarget) {
        roomMemory.rallyTarget = rallyTarget;
        rallies[roomName] = rallyTarget;
        roomMemory.pheromones.war = Math.max(roomMemory.pheromones.war, 2);
      } else {
        delete roomMemory.rallyTarget;
      }
    }

    swarm.rallies = rallies;
    if (Object.keys(rallies).length > 0) {
      this.logger.debug?.("Updated rally targets", { rallies });
    }
  }
}
