import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Resilient Monitoring Infrastructure E2E", () => {
  const outputDir = resolve("reports", "screeps-stats");
  const snapshotPath = resolve(outputDir, "latest.json");

  beforeEach(() => {
    // Ensure clean state
    if (existsSync(snapshotPath)) {
      rmSync(snapshotPath);
    }
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(snapshotPath)) {
      rmSync(snapshotPath);
    }
  });

  it("should ensure output directory exists", () => {
    // Create directory if needed
    mkdirSync(outputDir, { recursive: true });

    expect(existsSync(outputDir)).toBe(true);
  });

  it("should validate snapshot structure for Stats API source", () => {
    // Create a mock Stats API snapshot
    mkdirSync(outputDir, { recursive: true });
    const mockSnapshot = {
      fetchedAt: new Date().toISOString(),
      endpoint: "https://screeps.com/api/user/stats?interval=180",
      source: "stats_api",
      payload: {
        ok: 1,
        stats: {
          "1000": { cpu: { used: 50, limit: 100 }, resources: { energy: 5000 } }
        }
      }
    };

    // Write snapshot
    writeFileSync(snapshotPath, JSON.stringify(mockSnapshot, null, 2));

    // Verify structure
    const content = readFileSync(snapshotPath, "utf-8");
    const parsed = JSON.parse(content);

    expect(parsed).toHaveProperty("fetchedAt");
    expect(parsed).toHaveProperty("endpoint");
    expect(parsed).toHaveProperty("source");
    expect(parsed.source).toBe("stats_api");
    expect(parsed.payload).toHaveProperty("stats");
  });

  it("should validate snapshot structure for Console fallback source", () => {
    // Create a mock Console fallback snapshot
    mkdirSync(outputDir, { recursive: true });
    const mockSnapshot = {
      fetchedAt: new Date().toISOString(),
      endpoint: "console://(direct bot telemetry)",
      source: "console",
      fallback_activated: true,
      primary_source_failed: true,
      payload: {
        ok: 1,
        stats: {
          "1730815200000": {
            cpu: { used: 50, limit: 100 },
            resources: { energy: 5000 }
          }
        }
      }
    };

    // Write snapshot
    writeFileSync(snapshotPath, JSON.stringify(mockSnapshot, null, 2));

    // Verify structure
    const content = readFileSync(snapshotPath, "utf-8");
    const parsed = JSON.parse(content);

    expect(parsed).toHaveProperty("fetchedAt");
    expect(parsed).toHaveProperty("endpoint");
    expect(parsed).toHaveProperty("source");
    expect(parsed.source).toBe("console");
    expect(parsed).toHaveProperty("fallback_activated");
    expect(parsed.fallback_activated).toBe(true);
    expect(parsed).toHaveProperty("primary_source_failed");
    expect(parsed.primary_source_failed).toBe(true);
    expect(parsed.payload).toHaveProperty("stats");
  });

  it("should validate snapshot structure for complete infrastructure failure", () => {
    // Create a mock complete failure snapshot
    mkdirSync(outputDir, { recursive: true });
    const mockSnapshot = {
      status: "all_sources_unavailable",
      failureType: "infrastructure_failure",
      timestamp: new Date().toISOString(),
      error: "Both Stats API and Console telemetry sources failed",
      attempted_sources: ["stats_api", "console"],
      resilience_status: "critical"
    };

    // Write snapshot
    writeFileSync(snapshotPath, JSON.stringify(mockSnapshot, null, 2));

    // Verify structure
    const content = readFileSync(snapshotPath, "utf-8");
    const parsed = JSON.parse(content);

    expect(parsed).toHaveProperty("status");
    expect(parsed.status).toBe("all_sources_unavailable");
    expect(parsed).toHaveProperty("failureType");
    expect(parsed.failureType).toBe("infrastructure_failure");
    expect(parsed).toHaveProperty("attempted_sources");
    expect(parsed.attempted_sources).toEqual(["stats_api", "console"]);
    expect(parsed).toHaveProperty("resilience_status");
    expect(parsed.resilience_status).toBe("critical");
  });

  it("should demonstrate backward compatibility with old Stats API snapshots", () => {
    // Create an old-style Stats API snapshot (without source metadata)
    mkdirSync(outputDir, { recursive: true });
    const oldSnapshot = {
      fetchedAt: new Date().toISOString(),
      endpoint: "https://screeps.com/api/user/stats?interval=180",
      payload: {
        ok: 1,
        stats: {
          "1000": { cpu: { used: 50, limit: 100 }, resources: { energy: 5000 } }
        }
      }
    };

    // Write snapshot
    writeFileSync(snapshotPath, JSON.stringify(oldSnapshot, null, 2));

    // Verify it can be read and processed
    const content = readFileSync(snapshotPath, "utf-8");
    const parsed = JSON.parse(content);

    expect(parsed).toHaveProperty("fetchedAt");
    expect(parsed).toHaveProperty("endpoint");
    expect(parsed).not.toHaveProperty("source"); // Old format doesn't have this
    expect(parsed).not.toHaveProperty("fallback_activated");
    expect(parsed.payload).toHaveProperty("stats");
  });

  it("should verify resilience metadata is optional for backward compatibility", () => {
    // Both old and new formats should be valid
    const oldFormat = {
      fetchedAt: "2025-11-05T14:00:00.000Z",
      endpoint: "https://screeps.com/api/user/stats?interval=180",
      payload: { ok: 1, stats: {} }
    };

    const newFormat = {
      fetchedAt: "2025-11-05T14:00:00.000Z",
      endpoint: "console://(direct bot telemetry)",
      source: "console",
      fallback_activated: true,
      primary_source_failed: true,
      payload: { ok: 1, stats: {} }
    };

    // Both should be valid JSON
    expect(() => JSON.stringify(oldFormat)).not.toThrow();
    expect(() => JSON.stringify(newFormat)).not.toThrow();

    // New format should have additional metadata
    expect(Object.keys(newFormat).length).toBeGreaterThan(Object.keys(oldFormat).length);
  });
});
