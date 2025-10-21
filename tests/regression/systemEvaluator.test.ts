import { describe, expect, it } from "vitest";
import { SystemEvaluator } from "@runtime/evaluation/SystemEvaluator";
import type { PerformanceSnapshot, RepositorySignal } from "@shared/contracts";

describe("SystemEvaluator regression", () => {
  it("produces consistent findings for degraded metrics", () => {
    const evaluator = new SystemEvaluator();
    const snapshot: PerformanceSnapshot = {
      tick: 10,
      cpuUsed: 18,
      cpuLimit: 20,
      cpuBucket: 200,
      creepCount: 0,
      roomCount: 1,
      spawnOrders: 0,
      warnings: [],
      execution: {
        processedCreeps: 0,
        spawnedCreeps: [],
        tasksExecuted: {},
      },
    };

    const repository: RepositorySignal = {
      coverage: {
        statements: 70,
        branches: 60,
        functions: 65,
        lines: 72,
      },
      lintErrors: 3,
      testFailures: 1,
      timestamp: new Date(0).toISOString(),
    };

    const report = evaluator.evaluate(snapshot, repository);
    expect(report.summary).toContain("issues");
    const titles = report.findings.map(finding => finding.title);
    expect(titles).toEqual(expect.arrayContaining([
      "CPU usage approaching limit",
      "CPU bucket is depleted",
      "No creeps in play",
      "Low spawn throughput",
      "Test coverage is below target",
      "Lint violations detected",
      "Tests are failing",
    ]));
    expect(report.findings.length).toBeGreaterThanOrEqual(7);
  });
});
