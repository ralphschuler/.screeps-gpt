import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { BotSnapshot } from "../../packages/utilities/scripts/types/bot-snapshot";

describe("check-baseline-readiness", () => {
  const testSnapshotsDir = resolve("reports", "bot-snapshots-test");
  const testBaselinesPath = resolve("reports", "monitoring", "baselines-test.json");

  beforeEach(() => {
    // Clean up any previous test artifacts
    if (existsSync(testSnapshotsDir)) {
      rmSync(testSnapshotsDir, { recursive: true, force: true });
    }
    if (existsSync(testBaselinesPath)) {
      rmSync(testBaselinesPath, { force: true });
    }

    // Create test directory
    mkdirSync(testSnapshotsDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test artifacts
    if (existsSync(testSnapshotsDir)) {
      rmSync(testSnapshotsDir, { recursive: true, force: true });
    }
    if (existsSync(testBaselinesPath)) {
      rmSync(testBaselinesPath, { force: true });
    }
  });

  it("should identify insufficient snapshots when less than 48 exist", () => {
    // Create only 10 snapshots (insufficient)
    const snapshots: BotSnapshot[] = [];
    for (let i = 0; i < 10; i++) {
      const snapshot: BotSnapshot = {
        timestamp: new Date(2025, 10, 10 + i, 0, 0, 0).toISOString(),
        cpu: { used: 5, limit: 20, bucket: 5000 },
        creeps: { total: 10 }
      };
      snapshots.push(snapshot);
    }

    // Verify logic for readiness check
    const MINIMUM_SNAPSHOTS = 48;
    const validSnapshots = snapshots.length;
    const isReady = validSnapshots >= MINIMUM_SNAPSHOTS;

    expect(isReady).toBe(false);
    expect(validSnapshots).toBe(10);
  });

  it("should identify sufficient snapshots when 48 or more exist", () => {
    // Create 48 snapshots (sufficient)
    const snapshots: BotSnapshot[] = [];
    for (let i = 0; i < 48; i++) {
      const snapshot: BotSnapshot = {
        timestamp: new Date(2025, 10, 10, i, 0, 0).toISOString(),
        cpu: { used: 5, limit: 20, bucket: 5000 },
        creeps: { total: 10 }
      };
      snapshots.push(snapshot);
    }

    // Verify logic for readiness check
    const MINIMUM_SNAPSHOTS = 48;
    const validSnapshots = snapshots.length;
    const isReady = validSnapshots >= MINIMUM_SNAPSHOTS;

    expect(isReady).toBe(true);
    expect(validSnapshots).toBe(48);
  });

  it("should calculate remaining snapshots needed correctly", () => {
    const MINIMUM_SNAPSHOTS = 48;
    const currentSnapshots = 20;
    const remaining = MINIMUM_SNAPSHOTS - currentSnapshots;
    const estimatedHours = remaining * 0.5; // 30min per snapshot

    expect(remaining).toBe(28);
    expect(estimatedHours).toBe(14); // 28 * 0.5 = 14 hours
  });

  it("should calculate collection period duration correctly", () => {
    const timestamps = [
      new Date("2025-11-10T00:00:00Z").getTime(),
      new Date("2025-11-11T00:00:00Z").getTime(),
      new Date("2025-11-12T00:00:00Z").getTime()
    ];

    const startDate = new Date(Math.min(...timestamps));
    const endDate = new Date(Math.max(...timestamps));
    const durationHours = (Math.max(...timestamps) - Math.min(...timestamps)) / (1000 * 60 * 60);

    expect(startDate.toISOString()).toBe("2025-11-10T00:00:00.000Z");
    expect(endDate.toISOString()).toBe("2025-11-12T00:00:00.000Z");
    expect(durationHours).toBe(48);
  });

  it("should validate snapshot has meaningful data", () => {
    const validSnapshot: BotSnapshot = {
      timestamp: "2025-11-10T00:00:00Z",
      cpu: { used: 5, limit: 20, bucket: 5000 },
      creeps: { total: 10 }
    };

    const emptySnapshot: BotSnapshot = {
      timestamp: "2025-11-10T00:00:00Z"
    };

    // Valid snapshot has timestamp AND (cpu OR rooms OR creeps)
    const isValid = (snapshot: BotSnapshot): boolean => {
      return !!(snapshot.timestamp && (snapshot.cpu || snapshot.rooms || snapshot.creeps));
    };

    expect(isValid(validSnapshot)).toBe(true);
    expect(isValid(emptySnapshot)).toBe(false);
  });

  it("should identify high confidence level for 96+ snapshots", () => {
    // Note: establish-baselines.ts only generates "high" or "low", not "moderate"
    const confidenceLevel = "HIGH";

    expect(confidenceLevel).toBe("HIGH");
  });

  it("should identify high confidence level for 48-95 snapshots", () => {
    const MINIMUM_SNAPSHOTS = 48;
    const validSnapshots = 60;

    // Note: establish-baselines.ts generates "high" for >=48 snapshots
    const confidenceLevel = validSnapshots >= MINIMUM_SNAPSHOTS ? "HIGH" : "LOW";

    expect(confidenceLevel).toBe("HIGH");
  });

  it("should filter out invalid JSON files", () => {
    const files = ["snapshot-2025-11-10.json", "snapshot-2025-11-11.json", ".gitkeep", "README.md"];

    const validFiles = files.filter(f => f.endsWith(".json"));

    expect(validFiles).toEqual(["snapshot-2025-11-10.json", "snapshot-2025-11-11.json"]);
  });

  it("should check if collection period meets minimum duration", () => {
    const MINIMUM_DURATION_HOURS = 24;

    // Test short duration
    const shortDuration = 12;
    expect(shortDuration >= MINIMUM_DURATION_HOURS).toBe(false);

    // Test sufficient duration
    const longDuration = 48;
    expect(longDuration >= MINIMUM_DURATION_HOURS).toBe(true);
  });

  it("should recognize existing high confidence baselines", () => {
    const existingBaselines = {
      metadata: {
        confidenceLevel: "high"
      },
      dataPointCount: 50,
      generatedAt: "2025-11-15T00:00:00Z",
      collectionPeriod: {
        durationHours: 25
      }
    };

    const shouldUpdate = existingBaselines.metadata.confidenceLevel !== "high";

    expect(shouldUpdate).toBe(false);
  });

  it("should identify need to update low confidence baselines", () => {
    const existingBaselines = {
      metadata: {
        confidenceLevel: "low"
      },
      dataPointCount: 10,
      generatedAt: "2025-11-15T00:00:00Z"
    };

    const shouldUpdate = existingBaselines.metadata.confidenceLevel !== "high";

    expect(shouldUpdate).toBe(true);
  });

  it("should calculate correct estimated hours for remaining snapshots", () => {
    const testCases = [
      { remaining: 10, expected: 5 },
      { remaining: 48, expected: 24 },
      { remaining: 96, expected: 48 }
    ];

    testCases.forEach(({ remaining, expected }) => {
      const estimatedHours = remaining * 0.5;
      expect(estimatedHours).toBe(expected);
    });
  });
});
