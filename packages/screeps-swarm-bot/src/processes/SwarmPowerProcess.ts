import { process } from "@ralphschuler/screeps-kernel";
import { Logger } from "@ralphschuler/screeps-logger";
import {
  scheduleNextPowerLoop,
  shouldRunPowerLoop,
  runPowerCreepCombat,
  runPowerCreepEconomy
} from "../powerCreepManager.js";
import type { SwarmProcessContext } from "../types.js";

@process({ name: "SwarmPowerProcess", priority: 70, singleton: true })
export class SwarmPowerProcess {
  private readonly logger = new Logger({ minLevel: "info" }).child({ system: "swarm-power" });
  private nextRun?: number;

  public run(ctx: SwarmProcessContext): void {
    if (!shouldRunPowerLoop(ctx.game.time, this.nextRun)) return;
    this.nextRun = scheduleNextPowerLoop(ctx.game.time);
    this.logger.debug?.("Executing power loop", { tick: ctx.game.time });
    const powerCreeps = (ctx.game as { powerCreeps?: Record<string, PowerCreep> }).powerCreeps ?? {};
    for (const powerCreep of Object.values(powerCreeps)) {
      if (!powerCreep.ticksToLive || powerCreep.ticksToLive <= 0) continue;
      const className = powerCreep.className.toLowerCase();
      if (className === "operator") {
        runPowerCreepEconomy(powerCreep);
      }
      if (className === "executor" || className === "commander") {
        runPowerCreepCombat(powerCreep);
      }
    }
  }
}
