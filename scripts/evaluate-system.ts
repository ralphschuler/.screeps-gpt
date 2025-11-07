import { existsSync } from "node:fs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SystemEvaluator } from "../src/runtime/evaluation/SystemEvaluator";
import type { CoverageSummary, PerformanceSnapshot, RepositorySignal } from "../src/shared/contracts";
import { saveReport, loadLatestReport, applyRetentionPolicy } from "./lib/report-storage.js";
import {
  compareEvaluations,
  formatEvaluationTrendReport,
  type SystemEvaluationReport
} from "./lib/report-comparison.js";

async function loadCoverage(): Promise<CoverageSummary | undefined> {
  const coveragePath = resolve("coverage/coverage-summary.json");
  if (!existsSync(coveragePath)) {
    return undefined;
  }

  const content = await readFile(coveragePath, "utf8");
  const data = JSON.parse(content) as {
    total?: {
      statements?: { pct: number };
      branches?: { pct: number };
      functions?: { pct: number };
      lines?: { pct: number };
    };
  };

  const summary = data.total;
  if (!summary) {
    return undefined;
  }

  return {
    statements: summary.statements?.pct ?? 0,
    branches: summary.branches?.pct ?? 0,
    functions: summary.functions?.pct ?? 0,
    lines: summary.lines?.pct ?? 0
  };
}

function createSnapshot(): PerformanceSnapshot {
  return {
    tick: Number(process.env.SCREEPS_LAST_TICK ?? Date.now()),
    cpuUsed: Number(process.env.EVAL_CPU_USED ?? 0),
    cpuLimit: Number(process.env.EVAL_CPU_LIMIT ?? 100),
    cpuBucket: Number(process.env.EVAL_CPU_BUCKET ?? 10000),
    creepCount: Number(process.env.EVAL_CREEP_COUNT ?? 4),
    roomCount: Number(process.env.EVAL_ROOM_COUNT ?? 1),
    spawnOrders: Number(process.env.EVAL_SPAWN_ORDERS ?? 0),
    warnings: [],
    execution: {
      processedCreeps: Number(process.env.EVAL_PROCESSED_CREEPS ?? 4),
      spawnedCreeps: [],
      tasksExecuted: {}
    }
  };
}

async function run(): Promise<void> {
  const evaluator = new SystemEvaluator();
  const coverage = await loadCoverage();

  const repository: RepositorySignal = {
    coverage,
    lintErrors: Number(process.env.EVAL_LINT_ERRORS ?? 0) || 0,
    testFailures: Number(process.env.EVAL_TEST_FAILURES ?? 0) || 0,
    timestamp: new Date().toISOString()
  };

  const snapshot = createSnapshot();
  const report = evaluator.evaluate(snapshot, repository);

  // Load previous evaluation for trend analysis (before saving current one)
  const previousReport = await loadLatestReport<SystemEvaluationReport>("evaluations");

  // Compare with historical data
  const comparison = compareEvaluations(report as SystemEvaluationReport, previousReport);
  const trendReport = formatEvaluationTrendReport(comparison);

  // Save to standard location for compatibility
  const outputPath = resolve("reports/system-evaluation.json");
  await mkdir(resolve("reports"), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  // Save timestamped report for historical tracking
  try {
    const savedPath = await saveReport("evaluations", report);
    console.log(`✓ Evaluation report saved to: ${savedPath}`);
  } catch (error) {
    console.error("Failed to save timestamped evaluation report:", error);
  }

  console.log("\n" + trendReport);
  console.log(`\nEvaluation summary: ${report.summary}`);

  if (report.findings.length > 0) {
    for (const finding of report.findings) {
      console.log(` - [${finding.severity}] ${finding.title}: ${finding.recommendation}`);
    }
  }

  // Apply retention policy to clean up old reports
  try {
    const deletedCount = await applyRetentionPolicy("evaluations", {
      maxAgeDays: 30,
      minReportsToKeep: 10
    });
    if (deletedCount > 0) {
      console.log(`✓ Cleaned up ${deletedCount} old evaluation report(s)`);
    }
  } catch (error) {
    console.error("Failed to apply retention policy:", error);
  }
}

run().catch(error => {
  console.error("System evaluation failed", error);
  process.exitCode = 1;
});
