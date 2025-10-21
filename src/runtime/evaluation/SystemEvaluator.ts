import type {
  EvaluationFinding,
  EvaluationResult,
  PerformanceSnapshot,
  RepositorySignal,
  SystemReport
} from "@shared/contracts";

interface SystemEvaluatorOptions {
  cpuUsageWarningRatio?: number;
  lowBucketThreshold?: number;
  minimumCoverage?: number;
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
      cpuUsageWarningRatio: options.cpuUsageWarningRatio ?? 0.8,
      lowBucketThreshold: options.lowBucketThreshold ?? 500,
      minimumCoverage: options.minimumCoverage ?? 85
    };
  }

  /**
   * Evaluate a single tick snapshot (and optional repository telemetry) into a report.
   */
  public evaluate(snapshot: PerformanceSnapshot, repository?: RepositorySignal, memory?: Memory): SystemReport {
    const findings: EvaluationFinding[] = [];

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

    if (snapshot.cpuUsed > snapshot.cpuLimit * this.options.cpuUsageWarningRatio) {
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
    repository?: RepositorySignal
  ): EvaluationResult {
    const report = this.evaluate(snapshot, repository, memory);
    return this.persist(memory, report);
  }
}
