import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { saveReport, loadLatestReport, listReports, applyRetentionPolicy } from "../../scripts/lib/report-storage";
import { comparePTRStats, compareEvaluations, type SystemEvaluationReport } from "../../scripts/lib/report-comparison";
import type { PTRStatsSnapshot } from "../../scripts/check-ptr-alerts";

const TEST_REPORTS_DIR = resolve("test-e2e-reports-temp");

describe("Historical Report Tracking - End to End", () => {
  beforeEach(() => {
    // Create a temporary test reports directory
    if (existsSync(TEST_REPORTS_DIR)) {
      rmSync(TEST_REPORTS_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_REPORTS_DIR, { recursive: true });
    // Temporarily override reports directory
    process.chdir(TEST_REPORTS_DIR);
  });

  afterEach(() => {
    // Clean up test directory
    process.chdir(resolve(TEST_REPORTS_DIR, ".."));
    if (existsSync(TEST_REPORTS_DIR)) {
      rmSync(TEST_REPORTS_DIR, { recursive: true, force: true });
    }
  });

  it("should track PTR stats trends over multiple runs", async () => {
    // Simulate first monitoring run with baseline stats
    const run1Stats: PTRStatsSnapshot = {
      fetchedAt: new Date().toISOString(),
      payload: {
        stats: {
          "1000": { cpu: { used: 40, limit: 100 }, resources: { energy: 5000 } },
          "1001": { cpu: { used: 40, limit: 100 }, resources: { energy: 5000 } },
          "1002": { cpu: { used: 40, limit: 100 }, resources: { energy: 5000 } }
        },
        ok: 1
      }
    };

    await saveReport("ptr-stats", run1Stats);
    await new Promise(resolve => setTimeout(resolve, 50)); // Ensure distinct timestamps

    // Simulate second run with increased CPU usage
    const run2Stats: PTRStatsSnapshot = {
      fetchedAt: new Date().toISOString(),
      payload: {
        stats: {
          "2000": { cpu: { used: 60, limit: 100 }, resources: { energy: 4500 } },
          "2001": { cpu: { used: 60, limit: 100 }, resources: { energy: 4500 } },
          "2002": { cpu: { used: 60, limit: 100 }, resources: { energy: 4500 } }
        },
        ok: 1
      }
    };

    await saveReport("ptr-stats", run2Stats);

    // Load the two most recent reports
    const reports = await listReports("ptr-stats");
    expect(reports).toHaveLength(2);

    const latest = await loadLatestReport<PTRStatsSnapshot>("ptr-stats");
    expect(latest).toBeTruthy();

    // Compare run2 with run1
    const comparison = comparePTRStats(run2Stats, run1Stats);

    expect(comparison.hasHistoricalData).toBe(true);
    expect(comparison.trend.cpuUsageChange).toBeGreaterThan(0);
    expect(comparison.alerts.length).toBeGreaterThan(0);
    expect(comparison.alerts[0]).toContain("CPU usage increased");
  });

  it("should track system evaluation changes over time", async () => {
    // Simulate first evaluation with no findings
    const eval1: SystemEvaluationReport = {
      tick: 1000,
      summary: "System stable: no anomalies detected.",
      findings: []
    };

    await saveReport("evaluations", eval1);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Simulate second evaluation with new findings
    const eval2: SystemEvaluationReport = {
      tick: 2000,
      summary: "Performance degradation detected.",
      findings: [
        {
          severity: "high",
          title: "CPU Usage High",
          recommendation: "Optimize spawn logic"
        },
        {
          severity: "medium",
          title: "Low Energy Reserves",
          recommendation: "Improve harvester efficiency"
        }
      ]
    };

    await saveReport("evaluations", eval2);

    // Load and compare
    const reports = await listReports("evaluations");
    expect(reports).toHaveLength(2);

    const comparison = compareEvaluations(eval2, eval1);

    expect(comparison.hasHistoricalData).toBe(true);
    expect(comparison.changes.findingsAdded).toBe(2);
    expect(comparison.changes.findingsRemoved).toBe(0);
    expect(comparison.changes.summaryChanged).toBe(true);
    expect(comparison.trend).toContain("new finding(s)");
  });

  it("should apply retention policy correctly", async () => {
    // Create 15 reports
    for (let i = 0; i < 15; i++) {
      const report: PTRStatsSnapshot = {
        fetchedAt: new Date().toISOString(),
        payload: { stats: { [`${i}`]: { cpu: { used: 40, limit: 100 } } }, ok: 1 }
      };
      await saveReport("ptr-stats", report);
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    let reports = await listReports("ptr-stats");
    expect(reports).toHaveLength(15);

    // Apply retention policy: keep minimum 10, max age 0 days (all old)
    const deletedCount = await applyRetentionPolicy("ptr-stats", {
      maxAgeDays: 0,
      minReportsToKeep: 10
    });

    expect(deletedCount).toBe(5);

    reports = await listReports("ptr-stats");
    expect(reports).toHaveLength(10);
  });

  it("should handle workflow-like sequence of save, load, compare, cleanup", async () => {
    // Simulate a complete workflow cycle

    // Run 1: Save baseline
    const baseline: PTRStatsSnapshot = {
      fetchedAt: new Date().toISOString(),
      payload: {
        stats: {
          "1000": { cpu: { used: 30, limit: 100 }, resources: { energy: 6000 } }
        },
        ok: 1
      }
    };
    await saveReport("ptr-stats", baseline);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Run 2: Load previous, save new, compare
    const previous = await loadLatestReport<PTRStatsSnapshot>("ptr-stats");
    expect(previous).toBeTruthy();

    const current: PTRStatsSnapshot = {
      fetchedAt: new Date().toISOString(),
      payload: {
        stats: {
          "2000": { cpu: { used: 35, limit: 100 }, resources: { energy: 5800 } }
        },
        ok: 1
      }
    };
    await saveReport("ptr-stats", current);

    const comparison = comparePTRStats(current, previous);
    expect(comparison.hasHistoricalData).toBe(true);

    // Run 3: Cleanup (should keep both since minimum is 10)
    const deleted = await applyRetentionPolicy("ptr-stats", {
      maxAgeDays: 30,
      minReportsToKeep: 10
    });
    expect(deleted).toBe(0);

    const reports = await listReports("ptr-stats");
    expect(reports).toHaveLength(2);
  });
});
