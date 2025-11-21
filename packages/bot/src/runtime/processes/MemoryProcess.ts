import { process as registerProcess, type ProcessContext } from "@ralphschuler/screeps-kernel";
import type { GameContext } from "@runtime/types/GameContext";
import {
  MemoryManager,
  MemoryGarbageCollector,
  MemoryMigrationManager,
  MemoryUtilizationMonitor,
  MemorySelfHealer
} from "@runtime/memory";

/**
 * Memory management process that handles all memory-related operations.
 * Responsibilities:
 * - Memory self-healing and corruption detection
 * - Memory migrations and schema versioning
 * - Garbage collection of stale data
 * - Memory utilization monitoring
 * - Pruning of missing creeps and role bookkeeping
 *
 * Priority: 100 (highest) - Must run first to ensure memory integrity
 */
@registerProcess({ name: "MemoryProcess", priority: 100, singleton: true })
export class MemoryProcess {
  private readonly memoryManager: MemoryManager;
  private readonly garbageCollector: MemoryGarbageCollector;
  private readonly migrationManager: MemoryMigrationManager;
  private readonly utilizationMonitor: MemoryUtilizationMonitor;
  private readonly selfHealer: MemorySelfHealer;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly cpuEmergencyThreshold: number;
  private readonly enableGarbageCollection: boolean;
  private readonly garbageCollectionInterval: number;
  private readonly enableSelfHealing: boolean;

  public constructor() {
    this.logger = console;
    this.memoryManager = new MemoryManager(this.logger);
    this.garbageCollector = new MemoryGarbageCollector({}, this.logger);
    this.migrationManager = new MemoryMigrationManager(1, this.logger);
    this.utilizationMonitor = new MemoryUtilizationMonitor({}, this.logger);
    this.selfHealer = new MemorySelfHealer({}, this.logger);
    this.cpuEmergencyThreshold = 0.9;
    this.enableGarbageCollection = true;
    this.garbageCollectionInterval = 10;
    this.enableSelfHealing = true;
  }

  public run(ctx: ProcessContext<Memory>): void {
    const gameContext = ctx.game as GameContext;
    const memory = ctx.memory;

    // Self-heal memory before any other operations
    if (this.enableSelfHealing) {
      const healthCheck = this.selfHealer.checkAndRepair(memory);
      if (healthCheck.requiresReset) {
        this.logger.warn?.("[MemoryProcess] Memory corruption detected. Performing emergency reset.");
        this.selfHealer.emergencyReset(memory);
        this.logger.warn?.("[MemoryProcess] Emergency reset complete. Other processes should skip this tick.");

        // Store emergency reset flag in memory for other processes to check
        memory.emergencyReset = true;
        return;
      }
    }

    // Clear emergency reset flag if it exists
    if (memory.emergencyReset) {
      delete memory.emergencyReset;
    }

    // Run memory migrations on first tick or version change
    try {
      const migrationResult = this.migrationManager.migrate(memory);
      if (migrationResult.migrationsApplied > 0) {
        if (migrationResult.success) {
          this.logger.log?.(
            `[MemoryProcess] Applied ${migrationResult.migrationsApplied} migration(s) to v${migrationResult.toVersion}`
          );
        } else {
          this.logger.warn?.(
            `[MemoryProcess] Migration failed and was rolled back: ${migrationResult.errors.join(", ")}`
          );
        }
      }
    } catch (error) {
      this.logger.warn?.(`[MemoryProcess] Unexpected error during migration: ${String(error)}`);
    }

    // Emergency CPU check before expensive operations
    if (gameContext.cpu.getUsed() > gameContext.cpu.limit * this.cpuEmergencyThreshold) {
      this.logger.warn?.(
        `[MemoryProcess] CPU threshold exceeded (${gameContext.cpu.getUsed().toFixed(2)}/${gameContext.cpu.limit}), ` +
          `aborting remaining operations`
      );
      return;
    }

    // Prune missing creeps and update role bookkeeping
    this.memoryManager.pruneMissingCreeps(memory, gameContext.creeps);
    const roleCounts = this.memoryManager.updateRoleBookkeeping(memory, gameContext.creeps);

    // Store role counts in memory for other processes to use
    memory.roles = roleCounts;

    // Run garbage collection if enabled
    if (this.enableGarbageCollection && gameContext.time % this.garbageCollectionInterval === 0) {
      this.garbageCollector.collect(gameContext, memory);
    }

    // Measure memory utilization and store in memory for evaluation
    const memoryUtilization = this.utilizationMonitor.measure(memory);
    memory.memoryUtilization = memoryUtilization;
  }
}
