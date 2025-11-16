import type { RepositorySignal } from "@shared/contracts";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import { SystemEvaluator } from "@runtime/evaluation/SystemEvaluator";
import {
  MemoryManager,
  MemoryGarbageCollector,
  MemoryMigrationManager,
  MemoryUtilizationMonitor,
  MemorySelfHealer
} from "@runtime/memory";
import { PerformanceTracker } from "@runtime/metrics/PerformanceTracker";
import { StatsCollector } from "@runtime/metrics/StatsCollector";
import { PixelGenerator } from "@runtime/metrics/PixelGenerator";
import { RespawnManager } from "@runtime/respawn/RespawnManager";
import { ConstructionManager } from "@runtime/planning/ConstructionManager";
import { RoomVisualManager } from "@runtime/visuals/RoomVisualManager";
import { InfrastructureManager } from "@runtime/infrastructure/InfrastructureManager";
import { BootstrapPhaseManager } from "./BootstrapPhaseManager";
import type { GameContext } from "@runtime/types/GameContext";
import { profile } from "@profiler";

export interface KernelConfig {
  memoryManager?: MemoryManager;
  garbageCollector?: MemoryGarbageCollector;
  migrationManager?: MemoryMigrationManager;
  utilizationMonitor?: MemoryUtilizationMonitor;
  selfHealer?: MemorySelfHealer;
  tracker?: PerformanceTracker;
  statsCollector?: StatsCollector;
  pixelGenerator?: PixelGenerator;
  behavior?: BehaviorController;
  evaluator?: SystemEvaluator;
  respawnManager?: RespawnManager;
  constructionManager?: ConstructionManager;
  visualManager?: RoomVisualManager;
  infrastructureManager?: InfrastructureManager;
  bootstrapManager?: BootstrapPhaseManager;
  repositorySignalProvider?: () => RepositorySignal | undefined;
  logger?: Pick<Console, "log" | "warn">;
  cpuEmergencyThreshold?: number;
  memorySchemaVersion?: number;
  enableGarbageCollection?: boolean;
  garbageCollectionInterval?: number;
  enableSelfHealing?: boolean;
}

/**
 * Central coordinator that ties together memory maintenance, behaviour execution,
 * metric collection, and evaluation for every Screeps tick.
 */
@profile
export class Kernel {
  private readonly memoryManager: MemoryManager;
  private readonly garbageCollector: MemoryGarbageCollector;
  private readonly migrationManager: MemoryMigrationManager;
  private readonly utilizationMonitor: MemoryUtilizationMonitor;
  private readonly selfHealer: MemorySelfHealer;
  private readonly tracker: PerformanceTracker;
  private readonly statsCollector: StatsCollector;
  private readonly pixelGenerator: PixelGenerator;
  private readonly behavior: BehaviorController;
  private readonly evaluator: SystemEvaluator;
  private readonly respawnManager: RespawnManager;
  private readonly constructionManager: ConstructionManager;
  private readonly visualManager: RoomVisualManager;
  private readonly infrastructureManager: InfrastructureManager;
  private readonly bootstrapManager: BootstrapPhaseManager;
  private readonly repositorySignalProvider?: () => RepositorySignal | undefined;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly cpuEmergencyThreshold: number;
  private readonly enableGarbageCollection: boolean;
  private readonly garbageCollectionInterval: number;
  private readonly enableSelfHealing: boolean;

  public constructor(config: KernelConfig = {}) {
    this.logger = config.logger ?? console;
    this.memoryManager = config.memoryManager ?? new MemoryManager(this.logger);
    this.garbageCollector = config.garbageCollector ?? new MemoryGarbageCollector({}, this.logger);
    this.migrationManager =
      config.migrationManager ?? new MemoryMigrationManager(config.memorySchemaVersion ?? 1, this.logger);
    this.utilizationMonitor = config.utilizationMonitor ?? new MemoryUtilizationMonitor({}, this.logger);
    this.selfHealer = config.selfHealer ?? new MemorySelfHealer({}, this.logger);
    this.tracker = config.tracker ?? new PerformanceTracker({}, this.logger);
    this.statsCollector = config.statsCollector ?? new StatsCollector();
    this.pixelGenerator = config.pixelGenerator ?? new PixelGenerator({}, this.logger);
    this.behavior = config.behavior ?? new BehaviorController({}, this.logger);
    this.evaluator = config.evaluator ?? new SystemEvaluator({}, this.logger);
    this.respawnManager = config.respawnManager ?? new RespawnManager(this.logger);
    this.constructionManager = config.constructionManager ?? new ConstructionManager(this.logger);
    this.infrastructureManager =
      config.infrastructureManager ??
      new InfrastructureManager({
        logger: this.logger,
        memory: typeof Memory !== "undefined" ? Memory.infrastructure : undefined
      });
    this.bootstrapManager = config.bootstrapManager ?? new BootstrapPhaseManager({}, this.logger);
    this.enableGarbageCollection = config.enableGarbageCollection ?? true;
    this.garbageCollectionInterval = config.garbageCollectionInterval ?? 10;
    this.enableSelfHealing = config.enableSelfHealing ?? true;
    this.visualManager =
      config.visualManager ??
      new RoomVisualManager({
        enabled:
          process.env.ROOM_VISUALS_ENABLED === "true" ||
          (typeof Memory !== "undefined" && Memory.experimentalFeatures?.roomVisuals === true)
      });
    this.repositorySignalProvider = config.repositorySignalProvider;
    this.cpuEmergencyThreshold = config.cpuEmergencyThreshold ?? 0.9;

    // Initialize Memory.stats if it doesn't exist
    if (typeof Memory !== "undefined" && !Memory.stats) {
      this.logger.log?.("[Kernel] Initializing Memory.stats structure");
      Memory.stats = {
        time: 0,
        cpu: { used: 0, limit: 0, bucket: 0 },
        creeps: { count: 0 },
        rooms: { count: 0 }
      };
    }
  }

  /**
   * Execute one iteration of the Screeps loop using the provided environment.
   * Implements CPU budget protection to prevent script execution timeouts.
   */
  public run(game: GameContext, memory: Memory): void {
    const repository = this.repositorySignalProvider?.();

    this.tracker.begin(game);

    // Self-heal memory before any other operations
    if (this.enableSelfHealing) {
      const healthCheck = this.selfHealer.checkAndRepair(memory);
      if (healthCheck.requiresReset) {
        this.logger.warn?.("[Kernel] Memory corruption detected. Attempting automatic emergency reset.");
        this.selfHealer.emergencyReset(memory);
        this.logger.warn?.("[Kernel] Emergency reset performed. Aborting tick to prevent further issues.");
        const snapshot = this.tracker.end(game, {
          processedCreeps: 0,
          spawnedCreeps: [],
          tasksExecuted: {}
        });
        this.logger.log?.("[Kernel] Collecting stats after emergency reset");
        this.statsCollector.collect(game, memory, snapshot);
        this.evaluator.evaluateAndStore(memory, snapshot, repository);
        return;
      }
    }

    // Run memory migrations on first tick or version change
    try {
      const migrationResult = this.migrationManager.migrate(memory);
      if (migrationResult.migrationsApplied > 0) {
        if (migrationResult.success) {
          this.logger.log?.(
            `[Kernel] Applied ${migrationResult.migrationsApplied} memory migration(s) to v${migrationResult.toVersion}`
          );
        } else {
          this.logger.warn?.(`[Kernel] Migration failed and was rolled back: ${migrationResult.errors.join(", ")}`);
        }
      }
    } catch (error) {
      this.logger.warn?.(`[Kernel] Unexpected error during migration: ${String(error)}`);
      // Continue execution with previous memory schema
    }

    // Emergency CPU check before expensive operations
    if (game.cpu.getUsed() > game.cpu.limit * this.cpuEmergencyThreshold) {
      this.logger.warn?.(
        `Emergency CPU threshold exceeded (${game.cpu.getUsed().toFixed(2)}/${game.cpu.limit}), ` +
          `aborting tick to prevent timeout`
      );
      const snapshot = this.tracker.end(game, {
        processedCreeps: 0,
        spawnedCreeps: [],
        tasksExecuted: {}
      });
      this.logger.log?.("[Kernel] Collecting stats after CPU emergency abort");
      this.statsCollector.collect(game, memory, snapshot);
      this.evaluator.evaluateAndStore(memory, snapshot, repository);
      return;
    }

    // Check for respawn condition before other operations
    const needsRespawn = this.respawnManager.checkRespawnNeeded(game, memory);
    if (needsRespawn) {
      // Still track performance and evaluate even when respawn is needed
      const snapshot = this.tracker.end(game, {
        processedCreeps: 0,
        spawnedCreeps: [],
        tasksExecuted: {}
      });
      this.logger.log?.("[Kernel] Collecting stats after respawn detection");
      this.statsCollector.collect(game, memory, snapshot);
      this.evaluator.evaluateAndStore(memory, snapshot, repository);
      return;
    }

    // CPU guard after respawn check
    if (game.cpu.getUsed() > game.cpu.limit * this.cpuEmergencyThreshold) {
      this.logger.warn?.(
        `CPU threshold exceeded after respawn check (${game.cpu.getUsed().toFixed(2)}/${game.cpu.limit}), ` +
          `aborting remaining operations`
      );
      const snapshot = this.tracker.end(game, {
        processedCreeps: 0,
        spawnedCreeps: [],
        tasksExecuted: {}
      });
      this.logger.log?.("[Kernel] Collecting stats after CPU threshold (post-respawn)");
      this.statsCollector.collect(game, memory, snapshot);
      this.evaluator.evaluateAndStore(memory, snapshot, repository);
      return;
    }

    this.memoryManager.pruneMissingCreeps(memory, game.creeps);
    const roleCounts = this.memoryManager.updateRoleBookkeeping(memory, game.creeps);

    // Run garbage collection if enabled
    if (this.enableGarbageCollection && game.time % this.garbageCollectionInterval === 0) {
      this.garbageCollector.collect(game, memory);
    }

    // Measure memory utilization
    const memoryUtilization = this.utilizationMonitor.measure(memory);

    // CPU guard after memory operations
    if (game.cpu.getUsed() > game.cpu.limit * this.cpuEmergencyThreshold) {
      this.logger.warn?.(
        `CPU threshold exceeded after memory operations (${game.cpu.getUsed().toFixed(2)}/${game.cpu.limit}), ` +
          `aborting remaining operations`
      );
      const snapshot = this.tracker.end(game, {
        processedCreeps: 0,
        spawnedCreeps: [],
        tasksExecuted: {}
      });
      this.logger.log?.("[Kernel] Collecting stats after CPU threshold (post-memory)");
      this.statsCollector.collect(game, memory, snapshot);
      this.evaluator.evaluateAndStore(memory, snapshot, repository, memoryUtilization);
      return;
    }

    // Plan construction sites before executing behavior
    this.constructionManager.planConstructionSites(game);

    // CPU guard after construction planning
    if (game.cpu.getUsed() > game.cpu.limit * this.cpuEmergencyThreshold) {
      this.logger.warn?.(
        `CPU threshold exceeded after construction planning (${game.cpu.getUsed().toFixed(2)}/${game.cpu.limit}), ` +
          `aborting behavior execution`
      );
      const snapshot = this.tracker.end(game, {
        processedCreeps: 0,
        spawnedCreeps: [],
        tasksExecuted: {}
      });
      this.logger.log?.("[Kernel] Collecting stats after CPU threshold (post-construction)");
      this.statsCollector.collect(game, memory, snapshot);
      this.evaluator.evaluateAndStore(memory, snapshot, repository, memoryUtilization);
      return;
    }

    // Check and manage bootstrap phase
    const bootstrapStatus = this.bootstrapManager.checkBootstrapStatus(game, memory);
    if (bootstrapStatus.shouldTransition && bootstrapStatus.reason) {
      this.bootstrapManager.completeBootstrap(game, memory, bootstrapStatus.reason);
    }

    // Run infrastructure management (roads, traffic)
    this.infrastructureManager.run(game);

    // CPU guard after infrastructure management
    if (game.cpu.getUsed() > game.cpu.limit * this.cpuEmergencyThreshold) {
      this.logger.warn?.(
        `CPU threshold exceeded after infrastructure management (${game.cpu.getUsed().toFixed(2)}/${game.cpu.limit}), ` +
          `aborting behavior execution`
      );
      const snapshot = this.tracker.end(game, {
        processedCreeps: 0,
        spawnedCreeps: [],
        tasksExecuted: {}
      });
      this.logger.log?.("[Kernel] Collecting stats after CPU threshold (post-infrastructure)");
      this.statsCollector.collect(game, memory, snapshot);
      this.evaluator.evaluateAndStore(memory, snapshot, repository, memoryUtilization);
      return;
    }

    // Get bootstrap role minimums from manager if bootstrap is active
    const bootstrapMinimums = this.bootstrapManager.getBootstrapRoleMinimums(bootstrapStatus.isActive);
    const behaviorSummary = this.behavior.execute(game, memory, roleCounts, bootstrapMinimums);
    const snapshot = this.tracker.end(game, behaviorSummary);

    // Collect stats for monitoring (with bootstrap logging every 100 ticks)
    if (game.time % 100 === 0) {
      this.logger.log?.(`[Kernel] Executing stats collection phase (tick ${game.time})`);
    }
    this.statsCollector.collect(game, memory, snapshot);
    if (game.time % 100 === 0 && memory.stats) {
      this.logger.log?.(
        `[Kernel] Stats collection completed: time=${memory.stats.time}, keys=${Object.keys(memory.stats).join(",")}`
      );
    }

    const result = this.evaluator.evaluateAndStore(memory, snapshot, repository, memoryUtilization);

    // Generate pixel if bucket is full
    this.pixelGenerator.tryGeneratePixel(game.cpu.bucket);

    // Render room visuals for operational visibility
    this.visualManager.render(game);

    if (result.report.findings.length > 0) {
      this.logger.warn?.(`[evaluation] ${result.report.summary}`);
    } else {
      this.logger.log?.(`[evaluation] ${result.report.summary}`);
    }
  }
}
