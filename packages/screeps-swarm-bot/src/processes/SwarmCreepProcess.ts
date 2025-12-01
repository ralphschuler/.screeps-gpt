import { process } from "@ralphschuler/screeps-kernel";
import { Logger } from "@ralphschuler/screeps-logger";
import type { SwarmProcessContext } from "../types.js";
import { runCreepBehavior } from "../behavior/index.js";

@process({ name: "SwarmCreepProcess", priority: 60, singleton: true })
export class SwarmCreepProcess {
  private readonly logger = new Logger({ minLevel: "info" }).child({ system: "swarm-creeps" });

  public run(ctx: SwarmProcessContext): void {
    for (const creep of Object.values(ctx.game.creeps)) {
      try {
        runCreepBehavior(creep);
      } catch (error) {
        this.logger.error("Role execution failed", { creep: creep.name, error });
      }
    }
  }
}
