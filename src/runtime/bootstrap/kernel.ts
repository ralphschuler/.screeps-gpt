import type { RepositorySignal } from "@shared/contracts";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import { SystemEvaluator } from "@runtime/evaluation/SystemEvaluator";
import { MemoryManager } from "@runtime/memory/MemoryManager";
import { PerformanceTracker } from "@runtime/metrics/PerformanceTracker";
import type { GameContext } from "@runtime/types/GameContext";

export interface KernelConfig {
  memoryManager?: MemoryManager;
  tracker?: PerformanceTracker;
  behavior?: BehaviorController;
  evaluator?: SystemEvaluator;
  repositorySignalProvider?: () => RepositorySignal | undefined;
  logger?: Pick<Console, "log" | "warn">;
}

/**
 * Central coordinator that ties together memory maintenance, behaviour execution,
 * metric collection, and evaluation for every Screeps tick.
 */
export class Kernel {
  private readonly memoryManager: MemoryManager;
  private readonly tracker: PerformanceTracker;
  private readonly behavior: BehaviorController;
  private readonly evaluator: SystemEvaluator;
  private readonly repositorySignalProvider?: () => RepositorySignal | undefined;
  private readonly logger: Pick<Console, "log" | "warn">;

  public constructor(config: KernelConfig = {}) {
    this.logger = config.logger ?? console;
    this.memoryManager = config.memoryManager ?? new MemoryManager(this.logger);
    this.tracker = config.tracker ?? new PerformanceTracker(this.logger);
    this.behavior = config.behavior ?? new BehaviorController(this.logger);
    this.evaluator = config.evaluator ?? new SystemEvaluator({}, this.logger);
    this.repositorySignalProvider = config.repositorySignalProvider;
  }

  /**
   * Execute one iteration of the Screeps loop using the provided environment.
   */
  public run(game: GameContext, memory: Memory): void {
    const repository = this.repositorySignalProvider?.();

    this.tracker.begin(game);
    this.memoryManager.pruneMissingCreeps(memory, game.creeps);
    const roleCounts = this.memoryManager.updateRoleBookkeeping(memory, game.creeps);

    const behaviorSummary = this.behavior.execute(game, memory, roleCounts);
    const snapshot = this.tracker.end(game, behaviorSummary);
    const result = this.evaluator.evaluateAndStore(memory, snapshot, repository);

    if (result.report.findings.length > 0) {
      this.logger.warn?.(`[evaluation] ${result.report.summary}`);
    } else {
      this.logger.log?.(`[evaluation] ${result.report.summary}`);
    }
  }
}
