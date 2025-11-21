import { process as registerProcess, type ProcessContext } from "@ralphschuler/screeps-kernel";
import type { GameContext } from "@runtime/types/GameContext";
import { BootstrapPhaseManager } from "@runtime/bootstrap/BootstrapPhaseManager";

/**
 * Bootstrap phase management process that handles early colony development.
 * Responsibilities:
 * - Detecting and managing bootstrap phases
 * - RCL phase transitions
 * - Road planning for Phase 1 completion
 * - Storage status checking for Phase 2
 *
 * Priority: 80 (high) - Must run before infrastructure and behavior
 */
@registerProcess({ name: "BootstrapProcess", priority: 80, singleton: true })
export class BootstrapProcess {
  private readonly bootstrapManager: BootstrapPhaseManager;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly cpuEmergencyThreshold: number;

  public constructor() {
    this.logger = console;
    this.bootstrapManager = new BootstrapPhaseManager({}, this.logger);
    this.cpuEmergencyThreshold = 0.9;
  }

  public run(ctx: ProcessContext<Memory>): void {
    const gameContext = ctx.game as GameContext;
    const memory = ctx.memory;

    // Skip if emergency reset or respawn occurred
    if (memory.emergencyReset || memory.needsRespawn) {
      return;
    }

    // CPU guard before bootstrap operations
    if (gameContext.cpu.getUsed() > gameContext.cpu.limit * this.cpuEmergencyThreshold) {
      this.logger.warn?.(
        `[BootstrapProcess] CPU threshold exceeded (${gameContext.cpu.getUsed().toFixed(2)}/${gameContext.cpu.limit}), ` +
          `aborting bootstrap operations`
      );
      return;
    }

    // Check and manage bootstrap phase
    const bootstrapStatus = this.bootstrapManager.checkBootstrapStatus(gameContext, memory);
    if (bootstrapStatus.shouldTransition && bootstrapStatus.reason) {
      this.bootstrapManager.completeBootstrap(gameContext, memory, bootstrapStatus.reason);
    }

    // Store bootstrap status in memory for other processes
    memory.bootstrapStatus = bootstrapStatus;

    // Detect RCL phase transitions
    const phaseTransitions = this.bootstrapManager.detectRCLPhaseTransitions(gameContext, memory);
    if (phaseTransitions.length > 0) {
      for (const transition of phaseTransitions) {
        this.logger.log?.(
          `[BootstrapProcess] Phase transition detected in ${transition.roomName}: ` +
            `${transition.previousPhase ?? "none"} → ${transition.newPhase} (RCL ${transition.rclLevel})`
        );

        // Check storage status for Phase 2 rooms
        if (transition.newPhase === "phase2") {
          const room = gameContext.rooms[transition.roomName];
          if (room) {
            this.bootstrapManager.checkStorageStatus(room, memory);
          }
        }
      }
    }

    // Check if road planning is needed for Phase 1 completion
    const roadPlanningStatus = this.bootstrapManager.checkRoadPlanningNeeded(gameContext, memory);

    // Store road planning status for InfrastructureProcess to handle
    memory.roadPlanningStatus = roadPlanningStatus;
  }
}
