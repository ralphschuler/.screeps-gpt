/* eslint-disable @typescript-eslint/no-unsafe-call */
import { process as registerProcess, type ProcessContext } from "@ralphschuler/screeps-kernel";
import type { RuntimeProtocols } from "@runtime/protocols";
import type { GameContext } from "@runtime/types/GameContext";
import { EmpireManager } from "@runtime/empire";

/**
 * Empire coordination process that handles multi-room coordination (Phase 4).
 * Responsibilities:
 * - Multi-room resource management
 * - Remote mining coordination
 * - Room expansion planning
 * - Inter-room logistics
 *
 * Priority: 65 (medium-high) - Must run before behavior but after infrastructure
 */
@registerProcess({ name: "EmpireProcess", priority: 65, singleton: true })
export class EmpireProcess {
  private readonly empireManager: EmpireManager;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly cpuEmergencyThreshold: number;

  public constructor() {
    this.logger = console;
    this.empireManager = new EmpireManager({ logger: this.logger });
    this.cpuEmergencyThreshold = 0.9;
  }

  public run(ctx: ProcessContext<Memory, RuntimeProtocols>): void {
    const gameContext = ctx.game as GameContext;
    const memory = ctx.memory;

    // Skip if emergency reset or respawn occurred
    if (ctx.protocol.isEmergencyReset() || ctx.protocol.needsRespawn()) {
      return;
    }

    // CPU guard before empire operations
    if (gameContext.cpu.getUsed() > gameContext.cpu.limit * this.cpuEmergencyThreshold) {
      this.logger.warn?.(
        `[EmpireProcess] CPU threshold exceeded (${gameContext.cpu.getUsed().toFixed(2)}/${gameContext.cpu.limit}), ` +
          `aborting empire operations`
      );
      return;
    }

    // Run empire manager for multi-room coordination
    this.empireManager.run(gameContext, memory);
  }
}
