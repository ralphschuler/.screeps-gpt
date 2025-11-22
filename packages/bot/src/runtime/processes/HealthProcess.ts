import { process as registerProcess, type ProcessContext } from "@ralphschuler/screeps-kernel";
import type { GameContext } from "@runtime/types/GameContext";
import { HealthMonitor } from "@runtime/health/HealthMonitor";
import { WarningDetector } from "@runtime/health/WarningDetector";
import { RecoveryOrchestrator, RecoveryMode } from "@runtime/health/RecoveryOrchestrator";

/**
 * Health monitoring and autonomous recovery process.
 *
 * Responsibilities:
 * - Calculate bot health score every tick
 * - Detect early warning signs of degradation
 * - Orchestrate autonomous recovery responses
 * - Store health metrics for monitoring
 *
 * Priority: 15 (early) - Must run before behavior to inform spawn decisions
 */
@registerProcess({ name: "HealthProcess", priority: 15, singleton: true })
export class HealthProcess {
  private readonly healthMonitor: HealthMonitor;
  private readonly warningDetector: WarningDetector;
  private readonly recoveryOrchestrator: RecoveryOrchestrator;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly cpuEmergencyThreshold: number;

  public constructor() {
    this.logger = console;
    // Use default configurations for health monitoring components
    this.healthMonitor = new HealthMonitor({}, this.logger);
    this.warningDetector = new WarningDetector({}, this.logger);
    this.recoveryOrchestrator = new RecoveryOrchestrator(this.logger);
    this.cpuEmergencyThreshold = 0.9;
  }

  public run(ctx: ProcessContext<Memory>): void {
    const gameContext = ctx.game as GameContext;
    const memory = ctx.memory;

    // Skip if emergency reset or respawn occurred
    if (memory.emergencyReset || memory.needsRespawn) {
      return;
    }

    // CPU guard before health check
    if (gameContext.cpu.getUsed() > gameContext.cpu.limit * this.cpuEmergencyThreshold) {
      this.logger.warn?.(
        `[HealthProcess] CPU threshold exceeded (${gameContext.cpu.getUsed().toFixed(2)}/${gameContext.cpu.limit}), ` +
          `aborting health check`
      );
      return;
    }

    try {
      // Calculate current health status
      const healthStatus = this.healthMonitor.calculateHealth(gameContext, memory);

      // Detect warnings
      const warnings = this.warningDetector.detectWarnings(gameContext, memory, healthStatus);

      // Log warnings if any
      if (warnings.length > 0) {
        this.warningDetector.logWarnings(warnings);
      }

      // Orchestrate recovery if needed
      const recoveryState = this.recoveryOrchestrator.orchestrateRecovery(gameContext, memory, healthStatus, warnings);

      // Store health data in memory for external monitoring and other processes
      memory.health = {
        score: healthStatus.score,
        state: healthStatus.state,
        metrics: healthStatus.metrics,
        timestamp: healthStatus.timestamp,
        warnings: warnings.map(w => ({
          type: w.type,
          severity: w.severity,
          message: w.message
        })),
        recovery: {
          mode: recoveryState.mode,
          actionsCount: recoveryState.actions.length
        }
      };

      // Log health status periodically (every 100 ticks) or when entering recovery
      const isInRecovery = String(recoveryState.mode) !== String(RecoveryMode.NORMAL);
      if (gameContext.time % 100 === 0 || isInRecovery) {
        this.logger.log?.(
          `[HealthProcess] ${this.healthMonitor.getStatusMessage(healthStatus)} - ` +
            `Recovery: ${recoveryState.mode}, Warnings: ${warnings.length}`
        );
      }
    } catch (error) {
      this.logger.warn?.(`[HealthProcess] Error during health check: ${String(error)}`);
      // Don't crash the entire tick if health monitoring fails
    }
  }
}
