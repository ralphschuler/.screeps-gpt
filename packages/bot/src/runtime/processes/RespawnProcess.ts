import { process as registerProcess, type ProcessContext } from "@ralphschuler/screeps-kernel";
import type { GameContext } from "@runtime/types/GameContext";
import { RespawnManager } from "@runtime/respawn/RespawnManager";

/**
 * Respawn detection process that monitors for total colony loss.
 * Responsibilities:
 * - Detecting respawn conditions
 * - Setting respawn flags in memory
 * - Logging respawn events
 * 
 * Priority: 85 (high) - Must check early to prevent wasted CPU on dead colony
 */
@registerProcess({ name: "RespawnProcess", priority: 85, singleton: true })
export class RespawnProcess {
  private readonly respawnManager: RespawnManager;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly cpuEmergencyThreshold: number;

  public constructor() {
    this.logger = console;
    this.respawnManager = new RespawnManager(this.logger);
    this.cpuEmergencyThreshold = 0.9;
  }

  public run(ctx: ProcessContext<Memory>): void {
    const gameContext = ctx.game as GameContext;
    const memory = ctx.memory;

    // Skip if emergency reset occurred
    if (memory.emergencyReset) {
      return;
    }

    // CPU guard before respawn check
    if (gameContext.cpu.getUsed() > gameContext.cpu.limit * this.cpuEmergencyThreshold) {
      this.logger.warn?.(
        `[RespawnProcess] CPU threshold exceeded (${gameContext.cpu.getUsed().toFixed(2)}/${gameContext.cpu.limit}), ` +
          `aborting respawn check`
      );
      return;
    }

    // Check for respawn condition
    const needsRespawn = this.respawnManager.checkRespawnNeeded(gameContext, memory);
    if (needsRespawn) {
      // Set respawn flag in memory for other processes to check
      memory.needsRespawn = true;
      this.logger.warn?.("[RespawnProcess] Respawn condition detected. Other processes should skip this tick.");
    } else {
      // Clear respawn flag if it exists
      if (memory.needsRespawn) {
        delete memory.needsRespawn;
      }
    }
  }
}
