import { describe, it, expect } from "vitest";
import {
  comparePTRStats,
  compareEvaluations,
  formatPTRTrendReport,
  formatEvaluationTrendReport,
  type SystemEvaluationReport
} from "../../scripts/lib/report-comparison";
import type { PTRStatsSnapshot } from "../../scripts/check-ptr-alerts";

describe("report-comparison", () => {
  describe("comparePTRStats", () => {
    it("should handle missing historical data", () => {
      const current: PTRStatsSnapshot = {
        fetchedAt: new Date().toISOString(),
        payload: {
          stats: {
            "1000": { cpu: { used: 50, limit: 100 }, resources: { energy: 5000 } }
          },
          ok: 1
        }
      };

      const comparison = comparePTRStats(current, null);

      expect(comparison.hasHistoricalData).toBe(false);
      expect(comparison.trend.description).toContain("No historical data");
    });

    it("should detect CPU usage increase", () => {
      const previous: PTRStatsSnapshot = {
        fetchedAt: new Date().toISOString(),
        payload: {
          stats: {
            "1000": { cpu: { used: 40, limit: 100 }, resources: { energy: 5000 } },
            "1001": { cpu: { used: 40, limit: 100 }, resources: { energy: 5000 } },
            "1002": { cpu: { used: 40, limit: 100 }, resources: { energy: 5000 } },
            "1003": { cpu: { used: 40, limit: 100 }, resources: { energy: 5000 } },
            "1004": { cpu: { used: 40, limit: 100 }, resources: { energy: 5000 } }
          },
          ok: 1
        }
      };

      const current: PTRStatsSnapshot = {
        fetchedAt: new Date().toISOString(),
        payload: {
          stats: {
            "2000": { cpu: { used: 60, limit: 100 }, resources: { energy: 5000 } },
            "2001": { cpu: { used: 60, limit: 100 }, resources: { energy: 5000 } },
            "2002": { cpu: { used: 60, limit: 100 }, resources: { energy: 5000 } },
            "2003": { cpu: { used: 60, limit: 100 }, resources: { energy: 5000 } },
            "2004": { cpu: { used: 60, limit: 100 }, resources: { energy: 5000 } }
          },
          ok: 1
        }
      };

      const comparison = comparePTRStats(current, previous);

      expect(comparison.hasHistoricalData).toBe(true);
      expect(comparison.trend.cpuUsageChange).toBeGreaterThan(0);
      expect(comparison.alerts.length).toBeGreaterThan(0);
      expect(comparison.alerts[0]).toContain("CPU usage increased");
    });

    it("should detect energy decrease", () => {
      const previous: PTRStatsSnapshot = {
        fetchedAt: new Date().toISOString(),
        payload: {
          stats: {
            "1000": { cpu: { used: 40, limit: 100 }, resources: { energy: 5000 } },
            "1001": { cpu: { used: 40, limit: 100 }, resources: { energy: 5000 } },
            "1002": { cpu: { used: 40, limit: 100 }, resources: { energy: 5000 } },
            "1003": { cpu: { used: 40, limit: 100 }, resources: { energy: 5000 } },
            "1004": { cpu: { used: 40, limit: 100 }, resources: { energy: 5000 } }
          },
          ok: 1
        }
      };

      const current: PTRStatsSnapshot = {
        fetchedAt: new Date().toISOString(),
        payload: {
          stats: {
            "2000": { cpu: { used: 40, limit: 100 }, resources: { energy: 3000 } },
            "2001": { cpu: { used: 40, limit: 100 }, resources: { energy: 3000 } },
            "2002": { cpu: { used: 40, limit: 100 }, resources: { energy: 3000 } },
            "2003": { cpu: { used: 40, limit: 100 }, resources: { energy: 3000 } },
            "2004": { cpu: { used: 40, limit: 100 }, resources: { energy: 3000 } }
          },
          ok: 1
        }
      };

      const comparison = comparePTRStats(current, previous);

      expect(comparison.trend.energyChange).toBeLessThan(0);
      expect(comparison.alerts.length).toBeGreaterThan(0);
      expect(comparison.alerts[0]).toContain("Energy reserves decreased");
    });

    it("should not alert on minor changes", () => {
      const previous: PTRStatsSnapshot = {
        fetchedAt: new Date().toISOString(),
        payload: {
          stats: {
            "1000": { cpu: { used: 40, limit: 100 }, resources: { energy: 5000 } }
          },
          ok: 1
        }
      };

      const current: PTRStatsSnapshot = {
        fetchedAt: new Date().toISOString(),
        payload: {
          stats: {
            "2000": { cpu: { used: 42, limit: 100 }, resources: { energy: 5100 } }
          },
          ok: 1
        }
      };

      const comparison = comparePTRStats(current, previous);

      expect(comparison.alerts).toHaveLength(0);
    });
  });

  describe("compareEvaluations", () => {
    it("should handle missing historical data", () => {
      const current: SystemEvaluationReport = {
        tick: 1000,
        summary: "System stable",
        findings: []
      };

      const comparison = compareEvaluations(current, null);

      expect(comparison.hasHistoricalData).toBe(false);
      expect(comparison.trend).toContain("No historical data");
    });

    it("should detect new findings", () => {
      const previous: SystemEvaluationReport = {
        tick: 1000,
        summary: "System stable",
        findings: []
      };

      const current: SystemEvaluationReport = {
        tick: 2000,
        summary: "Issues detected",
        findings: [
          { severity: "high", title: "CPU issue", recommendation: "Fix it" },
          { severity: "medium", title: "Memory issue", recommendation: "Fix it" }
        ]
      };

      const comparison = compareEvaluations(current, previous);

      expect(comparison.changes.findingsAdded).toBe(2);
      expect(comparison.changes.findingsRemoved).toBe(0);
      expect(comparison.changes.summaryChanged).toBe(true);
    });

    it("should detect resolved findings", () => {
      const previous: SystemEvaluationReport = {
        tick: 1000,
        summary: "Issues detected",
        findings: [
          { severity: "high", title: "CPU issue", recommendation: "Fix it" },
          { severity: "medium", title: "Memory issue", recommendation: "Fix it" }
        ]
      };

      const current: SystemEvaluationReport = {
        tick: 2000,
        summary: "System stable",
        findings: []
      };

      const comparison = compareEvaluations(current, previous);

      expect(comparison.changes.findingsAdded).toBe(0);
      expect(comparison.changes.findingsRemoved).toBe(2);
      expect(comparison.changes.summaryChanged).toBe(true);
    });

    it("should detect no changes", () => {
      const previous: SystemEvaluationReport = {
        tick: 1000,
        summary: "System stable",
        findings: []
      };

      const current: SystemEvaluationReport = {
        tick: 2000,
        summary: "System stable",
        findings: []
      };

      const comparison = compareEvaluations(current, previous);

      expect(comparison.changes.findingsAdded).toBe(0);
      expect(comparison.changes.findingsRemoved).toBe(0);
      expect(comparison.changes.summaryChanged).toBe(false);
      expect(comparison.trend).toContain("No changes detected");
    });
  });

  describe("formatPTRTrendReport", () => {
    it("should format report with no historical data", () => {
      const comparison = comparePTRStats(
        {
          fetchedAt: new Date().toISOString(),
          payload: { stats: {}, ok: 1 }
        },
        null
      );

      const report = formatPTRTrendReport(comparison);

      expect(report).toContain("PTR Stats Trend Analysis");
      expect(report).toContain("No historical data available");
    });

    it("should format report with trends and alerts", () => {
      const previous: PTRStatsSnapshot = {
        fetchedAt: new Date().toISOString(),
        payload: {
          stats: {
            "1000": { cpu: { used: 40, limit: 100 }, resources: { energy: 5000 } }
          },
          ok: 1
        }
      };

      const current: PTRStatsSnapshot = {
        fetchedAt: new Date().toISOString(),
        payload: {
          stats: {
            "2000": { cpu: { used: 60, limit: 100 }, resources: { energy: 5000 } }
          },
          ok: 1
        }
      };

      const comparison = comparePTRStats(current, previous);
      const report = formatPTRTrendReport(comparison);

      expect(report).toContain("PTR Stats Trend Analysis");
      expect(report).toContain("Compared to previous run");
    });
  });

  describe("formatEvaluationTrendReport", () => {
    it("should format report with no historical data", () => {
      const comparison = compareEvaluations({ tick: 1000, summary: "Test", findings: [] }, null);

      const report = formatEvaluationTrendReport(comparison);

      expect(report).toContain("System Evaluation Trend Analysis");
      expect(report).toContain("No historical evaluation data");
    });

    it("should format report with changes", () => {
      const previous: SystemEvaluationReport = {
        tick: 1000,
        summary: "System stable",
        findings: []
      };

      const current: SystemEvaluationReport = {
        tick: 2000,
        summary: "Issues detected",
        findings: [{ severity: "high", title: "Issue", recommendation: "Fix" }]
      };

      const comparison = compareEvaluations(current, previous);
      const report = formatEvaluationTrendReport(comparison);

      expect(report).toContain("System Evaluation Trend Analysis");
      expect(report).toContain("new finding(s)");
    });
  });
});
