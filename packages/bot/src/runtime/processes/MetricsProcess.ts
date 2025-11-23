 
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { process as registerProcess, type ProcessContext } from "@ralphschuler/screeps-kernel";
import type { GameContext } from "@runtime/types/GameContext";
import type { RuntimeProtocols } from "@runtime/protocols";
import type { RepositorySignal, BehaviorSummary } from "@shared/contracts";
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
  private readonly statsCollector: StatsCollector;
  private readonly pixelGenerator: PixelGenerator;
  private readonly evaluator: SystemEvaluator;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly repositorySignalProvider?: () => RepositorySignal | undefined;

  public constructor() {
    this.logger = console;
    this.statsCollector = new StatsCollector({ enableDiagnostics: false });
    this.pixelGenerator = new PixelGenerator({}, this.logger);
    this.evaluator = new SystemEvaluator({}, this.logger);

    // Repository signal provider (if available)
    this.repositorySignalProvider = () => {
      return Memory.systemReport?.report?.repository;
    };
  }

  public run(ctx: ProcessContext<Memory, RuntimeProtocols>): void {
    const gameContext = ctx.game as GameContext;
    const memory = ctx.memory;

    // If emergency reset or respawn occurred, collect minimal stats (check protocol)
    if (ctx.protocol.isEmergencyReset() || ctx.protocol.needsRespawn()) {
      const repository = this.repositorySignalProvider?.();
      // Create minimal snapshot without performance tracking
      const minimalSnapshot = {
        tick: gameContext.time,
        cpuUsed: gameContext.cpu.getUsed(),
        cpuLimit: gameContext.cpu.limit,
        cpuBucket: gameContext.cpu.bucket,
        creepCount: Object.keys(gameContext.creeps).length,
        roomCount: Object.keys(gameContext.rooms).length,
        spawnOrders: 0,
        warnings: [],
        execution: {
          processedCreeps: 0,
          spawnedCreeps: [],
          tasksExecuted: {}
        }
      };
      this.statsCollector.collect(gameContext, memory, minimalSnapshot);
      this.evaluator.evaluateAndStore(memory, minimalSnapshot, repository);
      return;
    }

     
    // Get behavior summary from protocol (set by BehaviorProcess)
    const behaviorSummaryFromProtocol: BehaviorSummary | undefined = ctx.protocol.getBehaviorSummary();
    const behaviorSummary: BehaviorSummary = behaviorSummaryFromProtocol ?? {
      processedCreeps: 0,
      spawnedCreeps: [],
      tasksExecuted: {}
    };

    // Create performance snapshot by measuring CPU used during the entire tick
    const snapshot = {
      tick: gameContext.time,
      cpuUsed: gameContext.cpu.getUsed(),
      cpuLimit: gameContext.cpu.limit,
      cpuBucket: gameContext.cpu.bucket,
      creepCount: Object.keys(gameContext.creeps).length,
      roomCount: Object.keys(gameContext.rooms).length,
      spawnOrders: behaviorSummary.spawnedCreeps.length,
      warnings: [],
      execution: behaviorSummary
    };

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
     
    const memoryUtilization = ctx.protocol.getMemoryUtilization();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const result = this.evaluator.evaluateAndStore(memory, snapshot, repository, memoryUtilization);

    // Generate pixel if bucket is full
    this.pixelGenerator.tryGeneratePixel(gameContext.cpu.bucket);

    // Log evaluation summary
    if (result.report.findings.length > 0) {
      this.logger.warn?.(`[MetricsProcess] ${result.report.summary}`);
    } else {
      this.logger.log?.(`[MetricsProcess] ${result.report.summary}`);
    }
  }
}
