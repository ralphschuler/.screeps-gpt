import { profile } from "@ralphschuler/screeps-profiler";
import type { GameContext } from "@runtime/types/GameContext";

/**
 * Configuration for an initialization phase.
 */
export interface InitPhase {
  /** Human-readable name of the phase */
  name: string;
  /** Priority for execution order (lower = earlier) */
  priority: number;
  /** Function to execute for this phase */
  execute: () => void;
  /** Estimated CPU cost for this phase */
  cpuEstimate: number;
}

/**
 * Configuration options for InitializationManager.
 */
export interface InitializationConfig {
  /** Minimum CPU bucket level required to proceed with initialization (default: 500) */
  minBucketLevel?: number;
  /** CPU safety margin as fraction of limit (default: 0.8) */
  cpuSafetyMargin?: number;
  /** Maximum ticks to allow for initialization before force-completing (default: 10) */
  maxInitTicks?: number;
}

/**
 * Memory structure for tracking initialization state.
 */
export interface InitMemory {
  /** Current initialization phase index */
  phase: number;
  /** Tick when initialization began */
  startTick: number;
  /** Whether initialization is complete */
  complete: boolean;
  /** Phase names that have completed */
  completedPhases?: string[];
}

/**
 * Result of a single tick of initialization.
 */
export interface InitTickResult {
  /** Whether initialization is complete */
  complete: boolean;
  /** Phases executed this tick */
  phasesExecuted: string[];
  /** Phases skipped due to CPU constraints */
  phasesSkipped: string[];
  /** CPU used during this tick's initialization */
  cpuUsed: number;
}

/**
 * Manages phased initialization after deployment or server restart.
 *
 * Spreads initialization workload across multiple ticks to prevent
 * CPU bucket drain during the critical post-restart period.
 *
 * Usage:
 * ```typescript
 * const initManager = new InitializationManager();
 *
 * // Register phases (typically done once at module load)
 * initManager.registerPhase({
 *   name: "critical-systems",
 *   priority: 0,
 *   execute: () => initCriticalSystems(),
 *   cpuEstimate: 5
 * });
 *
 * // In main loop
 * if (!initManager.isComplete(Memory)) {
 *   const result = initManager.tick(game, Memory);
 *   if (result.complete) {
 *     console.log("✅ Initialization complete");
 *   }
 *   return; // Skip normal operations during init
 * }
 * ```
 *
 * @see packages/docs/source/docs/runtime/initialization.md
 */
@profile
export class InitializationManager {
  private readonly phases: InitPhase[] = [];
  private readonly config: Required<InitializationConfig>;
  private readonly logger: Pick<Console, "log" | "warn">;

  public constructor(config: InitializationConfig = {}, logger: Pick<Console, "log" | "warn"> = console) {
    this.config = {
      minBucketLevel: config.minBucketLevel ?? 500,
      cpuSafetyMargin: config.cpuSafetyMargin ?? 0.8,
      maxInitTicks: config.maxInitTicks ?? 10
    };
    this.logger = logger;
  }

  /**
   * Register an initialization phase.
   * Phases are sorted by priority (lower = earlier execution).
   *
   * @param phase - Phase configuration to register
   */
  public registerPhase(phase: InitPhase): void {
    this.phases.push(phase);
    this.phases.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get all registered phases (for testing/debugging).
   */
  public getPhases(): ReadonlyArray<InitPhase> {
    return this.phases;
  }

  /**
   * Check if initialization is complete.
   *
   * @param memory - Global memory object
   * @returns true if initialization is complete or not needed
   */
  public isComplete(memory: Memory): boolean {
    // If no phases registered, consider init complete
    if (this.phases.length === 0) {
      return true;
    }

    // Check if init memory indicates completion
    return memory.init?.complete === true;
  }

  /**
   * Check if initialization is needed (first run or memory reset).
   *
   * @param memory - Global memory object
   * @returns true if initialization should be performed
   */
  public needsInitialization(memory: Memory): boolean {
    // No phases registered = no initialization needed
    if (this.phases.length === 0) {
      return false;
    }

    // Init not started yet
    if (!memory.init) {
      return true;
    }

    // Init started but not complete
    return !memory.init.complete;
  }

  /**
   * Execute one tick of initialization.
   * Attempts to execute phases within the available CPU budget.
   *
   * @param game - Game context with CPU info
   * @param memory - Global memory object
   * @returns Result of this tick's initialization
   */
  public tick(game: GameContext, memory: Memory): InitTickResult {
    const result: InitTickResult = {
      complete: false,
      phasesExecuted: [],
      phasesSkipped: [],
      cpuUsed: 0
    };

    // Initialize Memory.init if not present
    if (!memory.init) {
      memory.init = {
        phase: 0,
        startTick: game.time,
        complete: false,
        completedPhases: []
      };
      this.logger.log?.(`[InitializationManager] Starting phased initialization (tick ${game.time})`);
    }

    // Check bucket level - if critically low, defer initialization
    if (game.cpu.bucket < this.config.minBucketLevel) {
      this.logger.warn?.(
        `[InitializationManager] CPU bucket (${game.cpu.bucket}) below threshold ` +
          `(${this.config.minBucketLevel}), deferring initialization`
      );
      return result;
    }

    // Check if max init ticks exceeded - force complete
    const ticksElapsed = game.time - memory.init.startTick;
    if (ticksElapsed >= this.config.maxInitTicks) {
      this.logger.warn?.(
        `[InitializationManager] Max init ticks (${this.config.maxInitTicks}) exceeded, ` +
          `force-completing initialization at phase ${memory.init.phase}/${this.phases.length}`
      );
      memory.init.complete = true;
      result.complete = true;
      return result;
    }

    const startCpu = game.cpu.getUsed();
    const cpuBudget = game.cpu.limit * this.config.cpuSafetyMargin;

    // Process phases within CPU budget
    while (memory.init.phase < this.phases.length) {
      const phase = this.phases[memory.init.phase];
      const cpuUsed = game.cpu.getUsed();
      const cpuRemaining = cpuBudget - cpuUsed;

      // Check if we have enough CPU budget for this phase
      if (cpuRemaining < phase.cpuEstimate) {
        // Skip remaining phases for this tick
        for (let i = memory.init.phase; i < this.phases.length; i++) {
          result.phasesSkipped.push(this.phases[i].name);
        }
        this.logger.log?.(
          `[InitializationManager] CPU budget exhausted (${cpuUsed.toFixed(2)}/${cpuBudget.toFixed(2)}), ` +
            `skipping ${result.phasesSkipped.length} phases until next tick`
        );
        break;
      }

      // Execute phase
      try {
        const phaseCpuStart = game.cpu.getUsed();
        phase.execute();
        const phaseCpuUsed = game.cpu.getUsed() - phaseCpuStart;

        result.phasesExecuted.push(phase.name);
        memory.init.completedPhases ??= [];
        memory.init.completedPhases.push(phase.name);
        memory.init.phase++;

        this.logger.log?.(
          `[InitializationManager] Phase "${phase.name}" completed ` +
            `(CPU: ${phaseCpuUsed.toFixed(2)}, estimate: ${phase.cpuEstimate})`
        );
      } catch (error) {
        // Log error but continue with next phase
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn?.(`[InitializationManager] Phase "${phase.name}" failed: ${errorMessage}`);
        memory.init.phase++;
        result.phasesExecuted.push(phase.name);
      }
    }

    // Check if all phases complete
    if (memory.init.phase >= this.phases.length) {
      memory.init.complete = true;
      result.complete = true;
      const totalTicks = game.time - memory.init.startTick + 1;
      this.logger.log?.(
        `[InitializationManager] ✅ Initialization complete in ${totalTicks} tick(s) ` +
          `(${result.phasesExecuted.length} phases executed this tick)`
      );
    }

    result.cpuUsed = game.cpu.getUsed() - startCpu;
    return result;
  }

  /**
   * Reset initialization state (for testing or forced re-initialization).
   *
   * @param memory - Global memory object
   */
  public reset(memory: Memory): void {
    delete memory.init;
    this.logger.log?.("[InitializationManager] Initialization state reset");
  }

  /**
   * Get current initialization status for debugging.
   *
   * @param memory - Global memory object
   * @param currentTick - Current game tick (optional, for calculating ticksElapsed)
   * @returns Status object with initialization details
   */
  public getStatus(
    memory: Memory,
    currentTick?: number
  ): {
    totalPhases: number;
    completedPhases: number;
    currentPhase: string | null;
    ticksElapsed: number;
    isComplete: boolean;
  } {
    const initMem = memory.init;
    const tick = currentTick ?? 0;
    return {
      totalPhases: this.phases.length,
      completedPhases: initMem?.phase ?? 0,
      currentPhase: initMem && initMem.phase < this.phases.length ? this.phases[initMem.phase].name : null,
      ticksElapsed: initMem ? tick - initMem.startTick : 0,
      isComplete: initMem?.complete ?? false
    };
  }
}
