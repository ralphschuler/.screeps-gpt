import type { RepositorySignal } from "@shared/contracts";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import { SystemEvaluator } from "@runtime/evaluation/SystemEvaluator";
import { MemoryManager } from "@runtime/memory/MemoryManager";
import { PerformanceTracker } from "@runtime/metrics/PerformanceTracker";
import { StatsCollector } from "@runtime/metrics/StatsCollector";
import { RespawnManager } from "@runtime/respawn/RespawnManager";
import type { GameContext } from "@runtime/types/GameContext";

export interface KernelConfig {
  memoryManager?: MemoryManager;
  tracker?: PerformanceTracker;
  statsCollector?: StatsCollector;
  behavior?: BehaviorController;
  evaluator?: SystemEvaluator;
  respawnManager?: RespawnManager;
  repositorySignalProvider?: () => RepositorySignal | undefined;
  logger?: Pick<Console, "log" | "warn">;
  cpuEmergencyThreshold?: number;
}

/**
 * Central coordinator that ties together memory maintenance, behaviour execution,
 * metric collection, and evaluation for every Screeps tick.
 */
export class Kernel {
  private readonly memoryManager: MemoryManager;
  private readonly tracker: PerformanceTracker;
  private readonly statsCollector: StatsCollector;
  private readonly behavior: BehaviorController;
  private readonly evaluator: SystemEvaluator;
  private readonly respawnManager: RespawnManager;
  private readonly repositorySignalProvider?: () => RepositorySignal | undefined;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly cpuEmergencyThreshold: number;

  public constructor(config: KernelConfig = {}) {
    this.logger = config.logger ?? console;
    this.memoryManager = config.memoryManager ?? new MemoryManager(this.logger);
    this.tracker = config.tracker ?? new PerformanceTracker({}, this.logger);
    this.statsCollector = config.statsCollector ?? new StatsCollector();
    this.behavior = config.behavior ?? new BehaviorController({}, this.logger);
    this.evaluator = config.evaluator ?? new SystemEvaluator({}, this.logger);
    this.respawnManager = config.respawnManager ?? new RespawnManager(this.logger);
    this.repositorySignalProvider = config.repositorySignalProvider;
    this.cpuEmergencyThreshold = config.cpuEmergencyThreshold ?? 0.9;
  }

  /**
   * Execute one iteration of the Screeps loop using the provided environment.
   * Implements CPU budget protection to prevent script execution timeouts.
   */
  public run(game: GameContext, memory: Memory): void {
    const repository = this.repositorySignalProvider?.();

    this.tracker.begin(game);

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
      this.statsCollector.collect(game, memory, snapshot);
      this.evaluator.evaluateAndStore(memory, snapshot, repository);
      return;
    }

    this.memoryManager.pruneMissingCreeps(memory, game.creeps);
    const roleCounts = this.memoryManager.updateRoleBookkeeping(memory, game.creeps);

    const behaviorSummary = this.behavior.execute(game, memory, roleCounts);
    const snapshot = this.tracker.end(game, behaviorSummary);
    this.statsCollector.collect(game, memory, snapshot);
    const result = this.evaluator.evaluateAndStore(memory, snapshot, repository);

    if (result.report.findings.length > 0) {
      this.logger.warn?.(`[evaluation] ${result.report.summary}`);
    } else {
      this.logger.log?.(`[evaluation] ${result.report.summary}`);
    }
  }
}
