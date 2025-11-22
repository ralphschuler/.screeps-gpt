import type { GameContext } from "@runtime/types/GameContext";
import { HealthState, type HealthStatus } from "./HealthMonitor";
import type { HealthWarning } from "./WarningDetector";

/**
 * Recovery mode states
 */
export enum RecoveryMode {
  NORMAL = "NORMAL", // No recovery needed
  MONITOR = "MONITOR", // Monitoring degraded state
  ACTIVE = "ACTIVE", // Active recovery in progress
  EMERGENCY = "EMERGENCY" // Emergency recovery protocol
}

/**
 * Recovery actions taken by the orchestrator
 */
export interface RecoveryAction {
  type: string;
  description: string;
  timestamp: number;
}

/**
 * Recovery state tracking
 */
export interface RecoveryState {
  mode: RecoveryMode;
  actions: RecoveryAction[];
  startedAt?: number;
  lastActionAt?: number;
}

/**
 * Configuration for recovery orchestration thresholds
 */
export interface RecoveryConfig {
  /** Minimum harvesters before boosting spawn priority (default: 2) */
  minHarvesters?: number;
  /** CPU bucket threshold for reducing operations (default: 1000) */
  lowCpuBucketThreshold?: number;
}

/**
 * Orchestrates autonomous recovery responses based on health state.
 *
 * Recovery escalation:
 * - HEALTHY: Normal operations, no recovery needed
 * - DEGRADED: Monitor closely, disable non-essential tasks
 * - CRITICAL: Active recovery, emergency spawn priority for harvesters
 * - EMERGENCY: Full recovery protocol, only essential creeps
 *
 * The orchestrator coordinates with existing recovery mechanisms:
 * - RespawnManager: Handles total colony loss scenarios
 * - Emergency spawn protection (future): Prevents spawn queue starvation
 * - Spawn queue resilience (future): Ensures harvester priority
 */
export class RecoveryOrchestrator {
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly config: Required<RecoveryConfig>;
  private currentMode: RecoveryMode = RecoveryMode.NORMAL;
  private recoveryStartTick?: number;

  public constructor(config: RecoveryConfig = {}, logger: Pick<Console, "log" | "warn"> = console) {
    this.config = {
      minHarvesters: config.minHarvesters ?? 2,
      lowCpuBucketThreshold: config.lowCpuBucketThreshold ?? 1000
    };
    this.logger = logger;
  }

  /**
   * Evaluate health status and execute recovery actions if needed
   */
  public orchestrateRecovery(
    game: GameContext,
    memory: Memory,
    healthStatus: HealthStatus,
    warnings: HealthWarning[]
  ): RecoveryState {
    const previousMode = this.currentMode;
    const newMode = this.determineRecoveryMode(healthStatus);

    // Track mode transitions
    if (newMode !== previousMode) {
      this.handleModeTransition(game, previousMode, newMode, healthStatus);
    }

    this.currentMode = newMode;

    // Initialize recovery state in memory if needed
    memory.recoveryState ??= {
      mode: newMode,
      actions: []
    };

    // Update recovery state - cast to internal type for type safety
    interface RecoveryStateMemory {
      mode: string;
      actions: RecoveryAction[];
      lastActionAt?: number;
    }
    const recoveryState = memory.recoveryState as RecoveryStateMemory;
    recoveryState.mode = newMode;

    // Execute recovery actions based on current mode
    const actions: RecoveryAction[] = [];

    switch (newMode) {
      case RecoveryMode.EMERGENCY:
        actions.push(...this.executeEmergencyRecovery(game, memory, healthStatus));
        break;
      case RecoveryMode.ACTIVE:
        actions.push(...this.executeActiveRecovery(game, memory, healthStatus));
        break;
      case RecoveryMode.MONITOR:
        actions.push(...this.executeMonitoring(game, memory, warnings));
        break;
      case RecoveryMode.NORMAL:
        // Clear recovery state if we've returned to normal
        if (this.recoveryStartTick) {
          const recoveryDuration = game.time - this.recoveryStartTick;
          this.logger.log?.(
            `[RecoveryOrchestrator] Recovery completed in ${recoveryDuration} ticks. Health: ${healthStatus.score.toFixed(1)}`
          );
          this.recoveryStartTick = undefined;
        }
        break;
    }

    // Store actions in memory
    if (actions.length > 0) {
      recoveryState.actions = actions;
      recoveryState.lastActionAt = game.time;
    }

    return {
      mode: newMode,
      actions,
      startedAt: this.recoveryStartTick,
      lastActionAt: actions.length > 0 ? game.time : recoveryState.lastActionAt
    };
  }

  /**
   * Determine appropriate recovery mode based on health state
   */
  private determineRecoveryMode(healthStatus: HealthStatus): RecoveryMode {
    switch (healthStatus.state) {
      case HealthState.HEALTHY:
        return RecoveryMode.NORMAL;
      case HealthState.DEGRADED:
        return RecoveryMode.MONITOR;
      case HealthState.CRITICAL:
        return RecoveryMode.ACTIVE;
      case HealthState.EMERGENCY:
        return RecoveryMode.EMERGENCY;
      default:
        return RecoveryMode.NORMAL;
    }
  }

  /**
   * Handle transitions between recovery modes
   */
  private handleModeTransition(
    game: GameContext,
    previousMode: RecoveryMode,
    newMode: RecoveryMode,
    healthStatus: HealthStatus
  ): void {
    this.logger.warn?.(
      `[RecoveryOrchestrator] Recovery mode changed: ${previousMode} -> ${newMode} (Health: ${healthStatus.score.toFixed(1)})`
    );

    // Track recovery start
    if (newMode !== RecoveryMode.NORMAL && previousMode === RecoveryMode.NORMAL) {
      this.recoveryStartTick = game.time;
      this.logger.warn?.(`[RecoveryOrchestrator] Recovery protocol initiated at tick ${game.time}`);
    }
  }

  /**
   * Execute emergency recovery protocol
   * Only spawn harvesters until workforce stabilizes
   */
  private executeEmergencyRecovery(game: GameContext, memory: Memory, _healthStatus: HealthStatus): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    // Set emergency recovery flag in memory for other systems to check
    memory.emergencyRecovery = true;

    actions.push({
      type: "EMERGENCY_MODE",
      description: "Emergency recovery mode activated - only essential creeps will spawn",
      timestamp: game.time
    });

    // Priority: ensure we have at least one harvester per source
    let harvesterCount = 0;
    for (const creepName in game.creeps) {
      if (game.creeps[creepName].memory?.role === "harvester") {
        harvesterCount++;
      }
    }

    if (harvesterCount === 0) {
      actions.push({
        type: "PRIORITIZE_HARVESTER",
        description: "No harvesters available - emergency harvester spawn required",
        timestamp: game.time
      });
      this.logger.warn?.("[RecoveryOrchestrator] CRITICAL: No harvesters - emergency spawn required");
    }

    return actions;
  }

  /**
   * Execute active recovery
   * Prioritize harvester spawning and disable non-essential tasks
   */
  private executeActiveRecovery(game: GameContext, memory: Memory, _healthStatus: HealthStatus): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    // Set recovery flag in memory
    memory.activeRecovery = true;

    actions.push({
      type: "ACTIVE_RECOVERY",
      description: "Active recovery mode - prioritizing harvester spawning",
      timestamp: game.time
    });

    // Check harvester count
    let harvesterCount = 0;
    for (const creepName in game.creeps) {
      if (game.creeps[creepName].memory?.role === "harvester") {
        harvesterCount++;
      }
    }

    if (harvesterCount < this.config.minHarvesters) {
      actions.push({
        type: "BOOST_HARVESTER_SPAWN",
        description: `Low harvester count (${harvesterCount}) - boosting spawn priority`,
        timestamp: game.time
      });
    }

    // Disable non-essential tasks based on CPU availability
    if (game.cpu.bucket < this.config.lowCpuBucketThreshold) {
      actions.push({
        type: "REDUCE_CPU_USAGE",
        description: "Low CPU bucket - reducing non-essential tasks",
        timestamp: game.time
      });
      memory.reducedOperations = true;
    }

    return actions;
  }

  /**
   * Execute monitoring for degraded health
   * Watch for further degradation but don't interfere yet
   */
  private executeMonitoring(game: GameContext, memory: Memory, warnings: HealthWarning[]): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    // Clear any recovery flags
    if (memory.emergencyRecovery) {
      delete memory.emergencyRecovery;
      actions.push({
        type: "EXIT_EMERGENCY",
        description: "Exited emergency recovery mode",
        timestamp: game.time
      });
    }
    if (memory.activeRecovery) {
      delete memory.activeRecovery;
      actions.push({
        type: "EXIT_ACTIVE_RECOVERY",
        description: "Exited active recovery mode",
        timestamp: game.time
      });
    }
    if (memory.reducedOperations) {
      delete memory.reducedOperations;
    }

    // Log critical warnings
    const criticalWarnings = warnings.filter(w => w.severity === "critical");
    if (criticalWarnings.length > 0) {
      actions.push({
        type: "MONITOR_WARNINGS",
        description: `Monitoring ${criticalWarnings.length} critical warning(s)`,
        timestamp: game.time
      });
    }

    return actions;
  }

  /**
   * Check if we're currently in recovery mode
   */
  public isInRecovery(): boolean {
    return this.currentMode !== RecoveryMode.NORMAL;
  }

  /**
   * Get current recovery mode
   */
  public getRecoveryMode(): RecoveryMode {
    return this.currentMode;
  }
}
