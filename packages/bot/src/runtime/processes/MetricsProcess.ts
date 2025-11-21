import { process as registerProcess, type ProcessContext } from "@ralphschuler/screeps-kernel";
import type { GameContext } from "@runtime/types/GameContext";
import type { RepositorySignal } from "@shared/contracts";
import { PerformanceTracker } from "@runtime/metrics/PerformanceTracker";
import { StatsCollector } from "@runtime/metrics/StatsCollector";
import { PixelGenerator } from "@runtime/metrics/PixelGenerator";
import { SystemEvaluator } from "@runtime/evaluation/SystemEvaluator";

/**
 * Metrics collection and evaluation process that tracks performance and generates insights.
 * Responsibilities:
 * - Performance tracking and CPU accounting
 * - Stats collection for monitoring
 * - Pixel generation when bucket is full
 * - System evaluation and health reports
 * 
 * Priority: 10 (lowest) - Run last to capture complete tick metrics
 */
@registerProcess({ name: "MetricsProcess", priority: 10, singleton: true })
export class MetricsProcess {
  private readonly tracker: PerformanceTracker;
  private readonly statsCollector: StatsCollector;
  private readonly pixelGenerator: PixelGenerator;
  private readonly evaluator: SystemEvaluator;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly repositorySignalProvider?: () => RepositorySignal | undefined;
  private tickStarted: boolean = false;

  public constructor() {
    this.logger = console;
    this.tracker = new PerformanceTracker({}, this.logger);
    this.statsCollector = new StatsCollector({ enableDiagnostics: false });
    this.pixelGenerator = new PixelGenerator({}, this.logger);
    this.evaluator = new SystemEvaluator({}, this.logger);

    // Repository signal provider (if available)
    this.repositorySignalProvider = () => {
      return Memory.systemReport?.report?.repository;
    };
  }

  public run(ctx: ProcessContext<Memory>): void {
    const gameContext = ctx.game as GameContext;
    const memory = ctx.memory;

    // Start performance tracking at the beginning of the tick
    // This should ideally be done before any other process runs
    if (!this.tickStarted) {
      this.tracker.begin(gameContext);
      this.tickStarted = true;
    }

    // If emergency reset or respawn occurred, end tracking with minimal summary
    if (memory.emergencyReset || memory.needsRespawn) {
      const snapshot = this.tracker.end(gameContext, {
        processedCreeps: 0,
        spawnedCreeps: [],
        tasksExecuted: {}
      });

      const repository = this.repositorySignalProvider?.();
      this.statsCollector.collect(gameContext, memory, snapshot);
      this.evaluator.evaluateAndStore(memory, snapshot, repository);
      this.tickStarted = false;
      return;
    }

    // Get behavior summary from memory (set by BehaviorProcess)
    const behaviorSummary = memory.behaviorSummary ?? {
      processedCreeps: 0,
      spawnedCreeps: [],
      tasksExecuted: {}
    };

    // End performance tracking
    const snapshot = this.tracker.end(gameContext, behaviorSummary);

    // Collect stats for monitoring
    if (gameContext.time % 100 === 0) {
      this.logger.log?.(`[MetricsProcess] Executing stats collection phase (tick ${gameContext.time})`);
    }
    this.statsCollector.collect(gameContext, memory, snapshot);
    if (gameContext.time % 100 === 0 && memory.stats) {
      this.logger.log?.(
        `[MetricsProcess] Stats collection completed: time=${memory.stats.time}, keys=${Object.keys(memory.stats).join(",")}`
      );
    }

    // Evaluate system health and store report
    const repository = this.repositorySignalProvider?.();
    const memoryUtilization = memory.memoryUtilization;
    const result = this.evaluator.evaluateAndStore(memory, snapshot, repository, memoryUtilization);

    // Generate pixel if bucket is full
    this.pixelGenerator.tryGeneratePixel(gameContext.cpu.bucket);

    // Log evaluation summary
    if (result.report.findings.length > 0) {
      this.logger.warn?.(`[MetricsProcess] ${result.report.summary}`);
    } else {
      this.logger.log?.(`[MetricsProcess] ${result.report.summary}`);
    }

    // Reset tick started flag for next tick
    this.tickStarted = false;
  }
}
