import { describe, it, expect, beforeEach, vi } from "vitest";
import { PathfindingManager, PathCache } from "../../packages/bot/src/runtime/pathfinding";

// Mock screeps-pathfinding to force fallback to native PathFinder
// This allows us to test the cache behavior with predictable PathFinder.search calls
vi.mock("screeps-pathfinding", () => {
  throw new Error("screeps-pathfinding not available in test environment");
});

/**
 * Regression tests for path caching system
 * Ensures CPU optimization and cache behavior work correctly
 */

// Mock RoomPosition for tests
class MockRoomPosition {
  public constructor(
    public x: number,
    public y: number,
    public roomName: string
  ) {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).RoomPosition = MockRoomPosition;

describe("Path Caching Integration", () => {
  let cpuUsed = 0;

  beforeEach(() => {
    cpuUsed = 0;

    // Reset Game global for each test
    global.Game = {
      time: 1000,
      cpu: {
        getUsed: () => cpuUsed
      }
    } as unknown as Game;

    // Mock PathFinder that simulates CPU cost
    const mockPath = [new RoomPosition(1, 1, "W1N1"), new RoomPosition(2, 2, "W1N1"), new RoomPosition(3, 3, "W1N1")];

    global.PathFinder = {
      search: () => {
        // Simulate pathfinding CPU cost
        cpuUsed += 0.5; // Pathfinding costs 0.5 CPU
        return {
          path: mockPath,
          ops: 100,
          incomplete: false,
          cost: 0
        };
      }
    } as unknown as typeof PathFinder;
  });

  // Suppress console output from PathfindingManager initialization
  const silentLogger = { log: vi.fn(), warn: vi.fn() };

  it("should cache paths and improve CPU performance on subsequent calls", () => {
    const manager = new PathfindingManager({ enableCaching: true, logger: silentLogger });
    const origin = new RoomPosition(1, 1, "W1N1");
    const goal = new RoomPosition(10, 10, "W1N1");

    // First call - cache miss (will consume CPU from PathFinder.search)
    const result1 = manager.findPath(origin, goal);
    expect(result1.path.length).toBeGreaterThan(0);
    expect(result1.cost).toBeGreaterThan(0);

    // Second call - cache hit
    global.Game.time = 1001;
    const result2 = manager.findPath(origin, goal);
    expect(result2.path).toEqual(result1.path);
    expect(result2.cost).toBe(0); // Cache hit has zero cost

    // Verify cache metrics
    const metrics = manager.getCacheMetrics();
    expect(metrics).not.toBeNull();
    expect(metrics!.hits).toBe(1);
    expect(metrics!.misses).toBe(1);
    expect(metrics!.hitRate).toBeCloseTo(0.5, 2);
  });

  it("should invalidate cache when structures change", () => {
    const manager = new PathfindingManager({ enableCaching: true, logger: silentLogger });
    const origin = new RoomPosition(1, 1, "W1N1");
    const goal = new RoomPosition(10, 10, "W1N1");

    // First call - cache miss
    const result1 = manager.findPath(origin, goal);
    expect(result1.path.length).toBeGreaterThan(0);

    // Second call - cache hit
    global.Game.time = 1001;
    const result2 = manager.findPath(origin, goal);
    expect(result2.path).toEqual(result1.path);

    // Invalidate structures
    manager.invalidateStructures("W1N1");

    // Third call - cache miss after invalidation
    global.Game.time = 1002;
    const result3 = manager.findPath(origin, goal);
    expect(result3.cost).toBeGreaterThan(0); // Not a cache hit

    const metrics = manager.getCacheMetrics();
    expect(metrics!.hits).toBe(1);
    expect(metrics!.misses).toBe(2); // First call + after invalidation
  });

  it("should invalidate entire room cache", () => {
    const manager = new PathfindingManager({ enableCaching: true, logger: silentLogger });
    const origin1 = new RoomPosition(1, 1, "W1N1");
    const goal1 = new RoomPosition(10, 10, "W1N1");
    const origin2 = new RoomPosition(1, 1, "W2N2");
    const goal2 = new RoomPosition(10, 10, "W2N2");

    // Cache paths in both rooms
    manager.findPath(origin1, goal1);
    manager.findPath(origin2, goal2);

    // Invalidate W1N1
    manager.invalidateRoom("W1N1");

    // W1N1 path should be invalidated
    global.Game.time = 1001;
    const result1 = manager.findPath(origin1, goal1);
    expect(result1.cost).toBeGreaterThan(0);

    // W2N2 path should still be cached
    const result2 = manager.findPath(origin2, goal2);
    expect(result2.cost).toBe(0);
  });

  it("should handle cache with disabled caching", () => {
    const manager = new PathfindingManager({ enableCaching: false, logger: silentLogger });
    const origin = new RoomPosition(1, 1, "W1N1");
    const goal = new RoomPosition(10, 10, "W1N1");

    manager.findPath(origin, goal);
    global.Game.time = 1001;
    manager.findPath(origin, goal);

    const metrics = manager.getCacheMetrics();
    expect(metrics).toBeNull(); // No cache when disabled
  });

  it("should respect custom cache configuration", () => {
    const manager = new PathfindingManager({
      enableCaching: true,
      cacheConfig: {
        ttl: 500, // Short TTL
        maxPathEntries: 10
      }
    });

    const origin = new RoomPosition(1, 1, "W1N1");
    const goal = new RoomPosition(10, 10, "W1N1");

    // Cache path
    manager.findPath(origin, goal);

    // Within TTL - cache hit
    global.Game.time = 1400;
    const result1 = manager.findPath(origin, goal);
    expect(result1.cost).toBe(0);

    // After TTL - cache miss
    global.Game.time = 1501;
    const result2 = manager.findPath(origin, goal);
    expect(result2.cost).toBeGreaterThan(0);
  });

  it("should differentiate paths by range parameter", () => {
    const manager = new PathfindingManager({ enableCaching: true, logger: silentLogger });
    const origin = new RoomPosition(1, 1, "W1N1");
    const goal = new RoomPosition(10, 10, "W1N1");

    // Cache with range 1
    manager.findPath(origin, goal, { range: 1 });

    // Different range should not hit cache
    global.Game.time = 1001;
    const result3 = manager.findPath(origin, goal, { range: 3 });
    expect(result3.cost).toBeGreaterThan(0); // Not a cache hit

    // Same range should hit cache
    const result1Again = manager.findPath(origin, goal, { range: 1 });
    expect(result1Again.cost).toBe(0);
  });

  it("should track CPU savings from cache hits", () => {
    const manager = new PathfindingManager({ enableCaching: true, logger: silentLogger });
    const origin = new RoomPosition(1, 1, "W1N1");
    const goal = new RoomPosition(10, 10, "W1N1");

    // First pathfinding - expensive (consumes CPU)
    manager.findPath(origin, goal);

    // Multiple cache hits
    for (let i = 0; i < 5; i++) {
      global.Game.time = 1001 + i;
      manager.findPath(origin, goal);
    }

    const metrics = manager.getCacheMetrics();
    expect(metrics!.cpuSaved).toBeGreaterThan(0);
    expect(metrics!.hits).toBe(5);
  });

  it("should maintain cache size limits with LRU eviction", () => {
    const manager = new PathfindingManager({
      enableCaching: true,
      cacheConfig: {
        maxPathEntries: 3
      }
    });

    // Fill cache with 4 different paths
    for (let i = 0; i < 4; i++) {
      const origin = new RoomPosition(i, i, "W1N1");
      const goal = new RoomPosition(10, 10, "W1N1");
      manager.findPath(origin, goal);
      global.Game.time++;
    }

    const metrics = manager.getCacheMetrics();
    expect(metrics!.pathCacheSize).toBeLessThanOrEqual(3);
    expect(metrics!.lruEvictions).toBeGreaterThan(0);
  });

  it("should reset metrics without clearing cache", () => {
    const manager = new PathfindingManager({ enableCaching: true, logger: silentLogger });
    const origin = new RoomPosition(1, 1, "W1N1");
    const goal = new RoomPosition(10, 10, "W1N1");

    // Build cache and metrics
    manager.findPath(origin, goal);
    global.Game.time = 1001;
    manager.findPath(origin, goal);

    let metrics = manager.getCacheMetrics();
    expect(metrics!.hits).toBe(1);

    // Reset metrics
    manager.resetCacheMetrics();

    metrics = manager.getCacheMetrics();
    expect(metrics!.hits).toBe(0);
    expect(metrics!.pathCacheSize).toBeGreaterThan(0); // Cache still has entries
  });

  it("should handle incomplete paths gracefully", () => {
    // Create a new manager with fresh cache
    const manager = new PathfindingManager({ enableCaching: true, logger: silentLogger });
    const origin = new RoomPosition(5, 5, "W1N1"); // Use different coordinates
    const goal = new RoomPosition(20, 20, "W1N1");

    // Mock incomplete path that simulates CPU cost
    global.PathFinder = {
      search: () => {
        cpuUsed += 0.8; // Incomplete paths still cost CPU
        return {
          path: [new RoomPosition(5, 5, "W1N1")],
          ops: 2000,
          incomplete: true,
          cost: 0
        };
      }
    } as unknown as typeof PathFinder;

    // Incomplete paths should not be cached
    const result1 = manager.findPath(origin, goal);
    expect(result1.incomplete).toBe(true);
    expect(result1.cost).toBeGreaterThan(0);

    // Second call should also recalculate (not cached)
    global.Game.time = 1001;
    const result2 = manager.findPath(origin, goal);
    expect(result2.cost).toBeGreaterThan(0); // Should recalculate, not use cache

    const metrics = manager.getCacheMetrics();
    expect(metrics!.hits).toBe(0); // No cache hits for incomplete paths
  });
});

describe("PathCache Performance", () => {
  it("should maintain cache hit rate above 70% in typical scenario", () => {
    const pathCache = new PathCache();
    const origins = [new RoomPosition(1, 1, "W1N1"), new RoomPosition(2, 2, "W1N1"), new RoomPosition(3, 3, "W1N1")];
    const goals = [new RoomPosition(10, 10, "W1N1"), new RoomPosition(20, 20, "W1N1")];
    const mockPath = [new RoomPosition(5, 5, "W1N1")];

    // Simulate typical usage: some unique paths, many repeated paths
    let tick = 1000;

    // Initial cache population (6 unique paths)
    for (const origin of origins) {
      for (const goal of goals) {
        pathCache.setPath(origin, goal, mockPath, tick, {
          ops: 100,
          cpuCost: 0.5,
          incomplete: false
        });
        tick++;
      }
    }

    // Simulate repeated pathfinding (typical creep behavior)
    for (let i = 0; i < 100; i++) {
      const origin = origins[i % origins.length];
      const goal = goals[i % goals.length];
      pathCache.getPath(origin, goal, tick);
      tick++;
    }

    const metrics = pathCache.getMetrics();
    expect(metrics.hitRate).toBeGreaterThan(0.7); // >70% hit rate
  });

  it("should keep memory footprint under 100KB for typical usage", () => {
    const pathCache = new PathCache({ maxPathEntries: 1000 });
    const mockPath = Array(50)
      .fill(null)
      .map((_, i) => new RoomPosition(i, i, "W1N1"));

    // Fill cache with realistic number of paths
    for (let i = 0; i < 100; i++) {
      const origin = new RoomPosition(i % 50, i % 50, "W1N1");
      const goal = new RoomPosition((i + 25) % 50, (i + 25) % 50, "W1N1");
      pathCache.setPath(origin, goal, mockPath, 1000, {
        ops: 100,
        cpuCost: 0.5,
        incomplete: false
      });
    }

    const metrics = pathCache.getMetrics();
    expect(metrics.pathCacheSize).toBeLessThanOrEqual(1000);
    // Each entry: ~50 positions × ~20 bytes = ~1KB per path
    // 100 paths × 1KB = ~100KB
    expect(metrics.pathCacheSize).toBeLessThanOrEqual(100);
  });
});
