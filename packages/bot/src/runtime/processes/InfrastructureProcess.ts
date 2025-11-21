import { process as registerProcess, type ProcessContext } from "@ralphschuler/screeps-kernel";
import type { GameContext } from "@runtime/types/GameContext";
import { InfrastructureManager, type InfrastructureMemory } from "@runtime/infrastructure/InfrastructureManager";
import { LinkManager } from "@runtime/infrastructure/LinkManager";
import { BootstrapPhaseManager } from "@runtime/bootstrap/BootstrapPhaseManager";

/**
 * Infrastructure management process that handles roads, traffic, and links.
 * Responsibilities:
 * - Road planning and maintenance
 * - Traffic management
 * - Link network energy transfers (RCL 5+)
 * - Phase 1 road planning coordination with BootstrapProcess
 * 
 * Priority: 70 (medium-high) - Must run before behavior but after bootstrap
 */
@registerProcess({ name: "InfrastructureProcess", priority: 70, singleton: true })
export class InfrastructureProcess {
  private readonly infrastructureManager: InfrastructureManager;
  private readonly linkManager: LinkManager;
  private readonly bootstrapManager: BootstrapPhaseManager;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly cpuEmergencyThreshold: number;

  public constructor() {
    this.logger = console;
    this.cpuEmergencyThreshold = 0.9;

    // Extract infrastructure memory
    const infrastructureMemory: InfrastructureMemory | undefined = Memory.infrastructure;

    this.infrastructureManager = new InfrastructureManager({
      logger: this.logger,
      memory: infrastructureMemory
    });
    this.linkManager = new LinkManager({
      logger: this.logger
    });
    this.bootstrapManager = new BootstrapPhaseManager({}, this.logger);
  }

  public run(ctx: ProcessContext<Memory>): void {
    const gameContext = ctx.game as GameContext;
    const memory = ctx.memory;

    // Skip if emergency reset or respawn occurred
    if (memory.emergencyReset || memory.needsRespawn) {
      return;
    }

    // CPU guard before infrastructure operations
    if (gameContext.cpu.getUsed() > gameContext.cpu.limit * this.cpuEmergencyThreshold) {
      this.logger.warn?.(
        `[InfrastructureProcess] CPU threshold exceeded (${gameContext.cpu.getUsed().toFixed(2)}/${gameContext.cpu.limit}), ` +
          `aborting infrastructure operations`
      );
      return;
    }

    // Handle road planning if triggered by BootstrapProcess
    const roadPlanningStatus = memory.roadPlanningStatus as { shouldPlan: boolean; roomName: string; reason: string } | undefined;
    if (roadPlanningStatus?.shouldPlan && roadPlanningStatus.roomName) {
      this.logger.log?.(
        `[InfrastructureProcess] Road planning triggered for ${roadPlanningStatus.roomName}: ${roadPlanningStatus.reason}`
      );

      const room = gameContext.rooms[roadPlanningStatus.roomName];
      if (room) {
        const roadPlanner = this.infrastructureManager.getRoadPlanner();
        const result = roadPlanner.autoPlaceRoadsPhase1(room, gameContext);

        if (result.created > 0) {
          this.logger.log?.(
            `[InfrastructureProcess] Phase 1 road planning completed: ${result.created} roads planned in ${roadPlanningStatus.roomName}`
          );
        }
        if (result.created === 0 || result.failed > 0) {
          this.logger.log?.(
            `[InfrastructureProcess] Phase 1 road planning: ${result.created} roads created, ${result.failed} failed in ${roadPlanningStatus.roomName}`
          );
        }

        // Mark roads as planned using BootstrapPhaseManager
        this.bootstrapManager.markRoadsPlanned(memory, roadPlanningStatus.roomName);
      }

      // Clear road planning status
      delete memory.roadPlanningStatus;
    }

    // Run infrastructure management (roads, traffic)
    this.infrastructureManager.run(gameContext);

    // Run link network energy transfers (RCL 5+)
    let totalLinkTransfers = 0;
    let totalEnergyMoved = 0;
    for (const roomName in gameContext.rooms) {
      const room = gameContext.rooms[roomName];
      if (room.controller?.my && room.controller.level >= 5) {
        const linkResult = this.linkManager.run(room);
        totalLinkTransfers += linkResult.transfers;
        totalEnergyMoved += linkResult.energyMoved;
      }
    }
    if (totalLinkTransfers > 0) {
      this.logger.log?.(`[InfrastructureProcess] Link network: ${totalLinkTransfers} transfers, ${totalEnergyMoved} energy moved`);
    }
  }
}
