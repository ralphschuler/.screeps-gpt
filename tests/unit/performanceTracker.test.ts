import { describe, expect, it, vi } from "vitest";
import { PerformanceTracker } from "@runtime/metrics/PerformanceTracker";
import type { BehaviorSummary } from "@shared/contracts";

const behavior: BehaviorSummary = {
  processedCreeps: 1,
  spawnedCreeps: [],
  tasksExecuted: {}
};

describe("PerformanceTracker", () => {
  it("computes CPU usage deltas", () => {
    let cpu = 0;
    const tracker = new PerformanceTracker({ log: vi.fn(), warn: vi.fn() });
    const game = {
      time: 42,
      cpu: {
        getUsed: () => cpu,
        limit: 10,
        bucket: 1000
      },
      creeps: { alpha: { memory: { role: "harvester" } } },
      rooms: {}
    };

    tracker.begin(game);
    cpu = 6.5;
    const snapshot = tracker.end(game, behavior);
    expect(snapshot.cpuUsed).toBeCloseTo(6.5);
    expect(snapshot.tick).toBe(42);
  });

  it("raises warnings when CPU or bucket thresholds are exceeded", () => {
    let cpu = 0;
    const warn = vi.fn();
    const tracker = new PerformanceTracker({ log: vi.fn(), warn });
    const game = {
      time: 7,
      cpu: {
        getUsed: () => cpu,
        limit: 10,
        bucket: 300
      },
      creeps: {},
      rooms: {}
    };

    tracker.begin(game);
    cpu = 9;
    const snapshot = tracker.end(game, behavior);
    expect(snapshot.warnings).toHaveLength(2);
    expect(warn).toHaveBeenCalled();
  });

  it("throws if end is called before begin", () => {
    const tracker = new PerformanceTracker();
    const game = {
      time: 1,
      cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
      creeps: {},
      rooms: {}
    };

    expect(() => tracker.end(game, behavior)).toThrow(/begin/);
  });
});
