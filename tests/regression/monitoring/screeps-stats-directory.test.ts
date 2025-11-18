import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regression test for Issue: Missing screeps-stats directory
 *
 * Ensures that the reports/screeps-stats/ directory exists in the repository
 * to prevent cascade failures in PTR stats collection.
 *
 * Related Issues:
 * - Missing directory caused silent collection failures
 * - check-ptr-alerts.ts couldn't save timestamped files to reports/ptr-stats/
 * - collect-bot-snapshot.ts fell back to minimal data
 * - Cannot establish baselines without stats data
 *
 * @see docs/operations/troubleshooting-telemetry.md Issue 6
 */
describe("Screeps Stats Directory Infrastructure", () => {
  const screepsStatsDir = resolve("reports", "screeps-stats");
  const latestStatsPath = resolve(screepsStatsDir, "latest.json");

  it("should have reports/screeps-stats directory in repository", () => {
    expect(existsSync(screepsStatsDir)).toBe(true);
  });

  it("should have .gitkeep file to track directory", () => {
    const gitkeepPath = resolve(screepsStatsDir, ".gitkeep");
    expect(existsSync(gitkeepPath)).toBe(true);
  });

  it("should have placeholder latest.json for bootstrap", () => {
    expect(existsSync(latestStatsPath)).toBe(true);
  });

  it("should have valid JSON structure in latest.json", () => {
    const content = readFileSync(latestStatsPath, "utf-8");
    expect(() => JSON.parse(content)).not.toThrow();

    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty("timestamp");
    expect(parsed).toHaveProperty("source");
  });

  it("should prevent cascade failure in data collection pipeline", () => {
    // Verify the data flow can proceed:
    // 1. scripts can write to screeps-stats/latest.json
    expect(existsSync(screepsStatsDir)).toBe(true);

    // 2. check-ptr-alerts.ts can read from this location
    expect(existsSync(latestStatsPath)).toBe(true);

    // 3. Directory exists for timestamped PTR stats files
    const ptrStatsDir = resolve("reports", "ptr-stats");
    expect(existsSync(ptrStatsDir)).toBe(true);

    // 4. Bot snapshots directory exists
    const snapshotsDir = resolve("reports", "bot-snapshots");
    expect(existsSync(snapshotsDir)).toBe(true);
  });
});
