/* eslint-disable @typescript-eslint/no-unsafe-call */
import { process as registerProcess, type ProcessContext } from "@ralphschuler/screeps-kernel";
import type { RuntimeProtocols } from "@runtime/protocols";
import type { GameContext } from "@runtime/types/GameContext";
import { ConstructionManager } from "@runtime/planning/ConstructionManager";

/**
 * Construction planning process that handles construction site planning.
 * Responsibilities:
 * - Planning construction sites for new structures
 * - Room layout management
 * - Structure placement optimization
 *
 * Priority: 60 (medium) - Must run before behavior to ensure sites are available
 */
@registerProcess({ name: "ConstructionProcess", priority: 60, singleton: true })
export class ConstructionProcess {
  private readonly constructionManager: ConstructionManager;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly cpuEmergencyThreshold: number;

  public constructor() {
    this.logger = console;
    this.constructionManager = new ConstructionManager(this.logger);
    this.cpuEmergencyThreshold = 0.9;
  }

  public run(ctx: ProcessContext<Memory, RuntimeProtocols>): void {
    const gameContext = ctx.game as GameContext;

    // Skip if emergency reset or respawn occurred
    if (ctx.protocol.isEmergencyReset() || ctx.protocol.needsRespawn()) {
      return;
    }

    // CPU guard before construction planning
    if (gameContext.cpu.getUsed() > gameContext.cpu.limit * this.cpuEmergencyThreshold) {
      this.logger.warn?.(
        `[ConstructionProcess] CPU threshold exceeded (${gameContext.cpu.getUsed().toFixed(2)}/${gameContext.cpu.limit}), ` +
          `aborting construction planning`
      );
      return;
    }

    // Plan construction sites before behavior execution
    this.constructionManager.planConstructionSites(gameContext);
  }
}
