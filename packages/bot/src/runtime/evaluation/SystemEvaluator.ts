import type {
  EvaluationFinding,
  EvaluationResult,
  PerformanceSnapshot,
  RepositorySignal,
  SystemReport
} from "@shared/contracts";
import type { MemoryUtilization } from "@runtime/memory";

interface SystemEvaluatorOptions {
  cpuUsageWarningRatio?: number;
  cpuCriticalRatio?: number;
  lowBucketThreshold?: number;
  minimumCoverage?: number;
  memoryWarningThreshold?: number;
  memoryCriticalThreshold?: number;
}

/**
 * Converts runtime and repository metrics into actionable health reports and
 * persists them to Memory for later review.
 */
export class SystemEvaluator {
  private readonly options: Required<SystemEvaluatorOptions>;

  public constructor(
    options: SystemEvaluatorOptions = {},
    private readonly logger: Pick<Console, "log" | "warn"> = console
  ) {
    this.options = {
      cpuUsageWarningRatio: options.cpuUsageWarningRatio ?? 0.85,
      cpuCriticalRatio: options.cpuCriticalRatio ?? 0.95,
      lowBucketThreshold: options.lowBucketThreshold ?? 500,
      minimumCoverage: options.minimumCoverage ?? 85,
      memoryWarningThreshold: options.memoryWarningThreshold ?? 0.7,
      memoryCriticalThreshold: options.memoryCriticalThreshold ?? 0.9
    };
  }

  /**
   * Evaluate a single tick snapshot (and optional repository telemetry) into a report.
   */
  public evaluate(
    snapshot: PerformanceSnapshot,
    repository?: RepositorySignal,
    memory?: Memory,
    memoryUtilization?: MemoryUtilization
  ): SystemReport {
    const findings: EvaluationFinding[] = [];

    // Check memory health if utilization data provided
    if (memoryUtilization) {
      findings.push(...this.evaluateMemoryHealth(memoryUtilization));
    }

    // Check for respawn condition first (most critical)
    if (memory?.respawn?.needsRespawn) {
      const hasCreeps = snapshot.creepCount > 0;
      findings.push({
        severity: "critical",
        title: "Respawn required - all spawns lost",
        detail: hasCreeps
          ? `All spawns have been lost. ${snapshot.creepCount} creeps remaining but cannot spawn reinforcements.`
          : "All spawns and creeps have been lost. Immediate respawn required to continue play.",
        recommendation: hasCreeps
          ? "Trigger respawn process through Screeps API or UI to establish a new base."
          : "URGENT: Trigger immediate respawn through Screeps API or UI. No active units remain."
      });
    }

    if (snapshot.cpuUsed > snapshot.cpuLimit * this.options.cpuCriticalRatio) {
      findings.push({
        severity: "critical",
        title: "CPU usage at critical level - timeout risk",
        detail: `CPU usage ${snapshot.cpuUsed.toFixed(2)} exceeds ${(this.options.cpuCriticalRatio * 100).toFixed(0)}% of the limit ${snapshot.cpuLimit}. Script execution timeout imminent.`,
        recommendation: "Reduce creep count, simplify behaviors, or increase CPU limit to prevent timeout."
      });
    } else if (snapshot.cpuUsed > snapshot.cpuLimit * this.options.cpuUsageWarningRatio) {
      findings.push({
        severity: "warning",
        title: "CPU usage approaching limit",
        detail: `CPU usage ${snapshot.cpuUsed.toFixed(2)} exceeds ${(this.options.cpuUsageWarningRatio * 100).toFixed(0)}% of the limit ${snapshot.cpuLimit}.`,
        recommendation: "Profile hot paths or reduce creep behaviors to stay within CPU limits."
      });
    }

    if (snapshot.cpuBucket < this.options.lowBucketThreshold) {
      findings.push({
        severity: "critical",
        title: "CPU bucket is depleted",
        detail: `Bucket at ${snapshot.cpuBucket} prevents emergency CPU bursts.`,
        recommendation: "Pause non-essential tasks to allow the bucket to recover."
      });
    }

    if (snapshot.creepCount === 0 && !memory?.respawn?.needsRespawn) {
      findings.push({
        severity: "critical",
        title: "No creeps in play",
        detail: "All creeps are missing which indicates a stalled economy.",
        recommendation: "Ensure at least one harvester is spawned at all times."
      });
    }

    if (snapshot.execution.spawnedCreeps.length === 0 && snapshot.creepCount < 3 && !memory?.respawn?.needsRespawn) {
      findings.push({
        severity: "warning",
        title: "Low spawn throughput",
        detail: "The spawn did not queue new creeps despite a low population.",
        recommendation: "Increase minimum harvester count or review spawn rules."
      });
    }

    if (repository?.coverage) {
      const coverage = repository.coverage;
      if (coverage.statements < this.options.minimumCoverage) {
        findings.push({
          severity: "warning",
          title: "Test coverage is below target",
          detail: `Statements covered: ${coverage.statements.toFixed(2)}%. Target: ${this.options.minimumCoverage}%.`,
          recommendation: "Add unit tests for critical decision branches before deploying."
        });
      }
    }

    if (repository?.lintErrors && repository.lintErrors > 0) {
      findings.push({
        severity: "warning",
        title: "Lint violations detected",
        detail: `${repository.lintErrors} lint issues were reported in the latest CI run.`,
        recommendation: 'Run "bun run lint:fix" locally to resolve style issues.'
      });
    }

    if (repository?.testFailures && repository.testFailures > 0) {
      findings.push({
        severity: "critical",
        title: "Tests are failing",
        detail: `${repository.testFailures} tests failed in the latest pipeline.`,
        recommendation: "Investigate failing tests before allowing autonomous deployment."
      });
    }

    // Phase 4: Multi-room management evaluation
    if (memory?.empire && snapshot.roomCount > 1) {
      const empireMemory = memory.empire as {
        cpuBudgets: Record<string, number>;
        threats: Array<{ room: string; hostileCount: number; severity: number }>;
      };

      // Check CPU per room
      const cpuBudgets = empireMemory.cpuBudgets;
      if (cpuBudgets && Object.keys(cpuBudgets).length > 0) {
        const avgCpu = Object.values(cpuBudgets).reduce((a, b) => a + b, 0) / Object.keys(cpuBudgets).length;

        if (avgCpu > 10) {
          findings.push({
            severity: "warning",
            title: "CPU per room exceeds target",
            detail: `Average: ${avgCpu.toFixed(1)} CPU/tick per room. Target: <10.`,
            recommendation: "Optimize room processing or reduce empire size."
          });
        }
      }

      // Check for unstable rooms
      const rooms = memory.rooms;
      if (rooms) {
        const stableRooms = Object.entries(rooms).filter(
          ([, data]) => data.rclLevelDetected && data.rclLevelDetected >= 3
        ).length;
        const totalRooms = snapshot.roomCount;

        if (stableRooms < totalRooms * 0.75 && totalRooms > 1) {
          findings.push({
            severity: "warning",
            title: "Too many unstable rooms",
            detail: `${stableRooms}/${totalRooms} rooms at RCL 3+.`,
            recommendation: "Focus on stabilizing existing rooms before expansion."
          });
        }
      }
    }

    const summary =
      findings.length === 0
        ? "System stable: no anomalies detected."
        : `${findings.length} issue${findings.length === 1 ? "" : "s"} detected.`;

    return {
      tick: snapshot.tick,
      summary,
      findings,
      repository
    };
  }

  /**
   * Evaluate memory health based on utilization metrics
   */
  private evaluateMemoryHealth(utilization: MemoryUtilization): EvaluationFinding[] {
    const findings: EvaluationFinding[] = [];

    if (utilization.isCritical) {
      const largestSubsystems = Object.entries(utilization.subsystems)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, size]) => `${name} (${this.formatBytes(size)})`)
        .join(", ");

      findings.push({
        severity: "critical",
        title: "Memory usage at critical level",
        detail: `Memory usage at ${(utilization.usagePercent * 100).toFixed(1)}% (${this.formatBytes(utilization.currentBytes)}/${this.formatBytes(utilization.maxBytes)}). Largest consumers: ${largestSubsystems}`,
        recommendation:
          "Enable garbage collection, reduce retention periods, or clear historical data to prevent overflow."
      });
    } else if (utilization.isWarning) {
      findings.push({
        severity: "warning",
        title: "Memory usage approaching limit",
        detail: `Memory usage at ${(utilization.usagePercent * 100).toFixed(1)}% (${this.formatBytes(utilization.currentBytes)}/${this.formatBytes(utilization.maxBytes)})`,
        recommendation: "Review memory retention policies and enable garbage collection to prevent overflow."
      });
    }

    return findings;
  }

  /**
   * Format bytes into human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }

  /**
   * Persist the provided report into Memory if it is newer than the stored entry.
   */
  public persist(memory: Memory, report: SystemReport): EvaluationResult {
    const previousTick = memory.systemReport?.lastGenerated ?? -1;
    const shouldPersist = report.tick >= previousTick;

    if (shouldPersist) {
      memory.systemReport = {
        lastGenerated: report.tick,
        report
      };
      this.logger.log?.(`System evaluation stored for tick ${report.tick}`);
    }

    return { report, persisted: shouldPersist };
  }

  /**
   * Convenience helper that evaluates and immediately persists the result in Memory.
   */
  public evaluateAndStore(
    memory: Memory,
    snapshot: PerformanceSnapshot,
    repository?: RepositorySignal,
    memoryUtilization?: MemoryUtilization
  ): EvaluationResult {
    const report = this.evaluate(snapshot, repository, memory, memoryUtilization);
    return this.persist(memory, report);
  }
}
