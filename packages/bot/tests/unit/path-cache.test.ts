import { describe, it, expect, beforeEach } from "vitest";
import { PathCache } from "../../src/runtime/pathfinding/PathCache";

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

// Mock Game global
global.Game = {
  time: 1000
} as unknown as Game;

describe("PathCache", () => {
  let pathCache: PathCache;
  const mockPath = [new RoomPosition(1, 1, "W1N1"), new RoomPosition(2, 2, "W1N1"), new RoomPosition(3, 3, "W1N1")];

  beforeEach(() => {
    pathCache = new PathCache();
    global.Game.time = 1000;
  });

  describe("Path Caching", () => {
    it("should cache and retrieve paths", () => {
      const from = new RoomPosition(1, 1, "W1N1");
      const to = new RoomPosition(10, 10, "W1N1");

      pathCache.setPath(from, to, mockPath, 1000, {
        ops: 100,
        cpuCost: 0.5,
        incomplete: false
      });

      const cached = pathCache.getPath(from, to, 1000);
      expect(cached).not.toBeNull();
      expect(cached?.path).toEqual(mockPath);
      expect(cached?.ops).toBe(100);
      expect(cached?.cpuCost).toBe(0.5);
    });

    it("should return null for cache miss", () => {
      const from = new RoomPosition(1, 1, "W1N1");
      const to = new RoomPosition(10, 10, "W1N1");

      const cached = pathCache.getPath(from, to, 1000);
      expect(cached).toBeNull();
    });

    it("should expire paths after TTL", () => {
      const from = new RoomPosition(1, 1, "W1N1");
      const to = new RoomPosition(10, 10, "W1N1");

      pathCache.setPath(from, to, mockPath, 1000, {
        ops: 100,
        cpuCost: 0.5,
        incomplete: false
      });

      // Within TTL - should return cached path
      let cached = pathCache.getPath(from, to, 1500);
      expect(cached).not.toBeNull();

      // After TTL (default 1500 ticks) - should return null
      cached = pathCache.getPath(from, to, 2501);
      expect(cached).toBeNull();
    });

    it("should respect custom TTL", () => {
      pathCache = new PathCache({ ttl: 500 });
      const from = new RoomPosition(1, 1, "W1N1");
      const to = new RoomPosition(10, 10, "W1N1");

      pathCache.setPath(from, to, mockPath, 1000, {
        ops: 100,
        cpuCost: 0.5,
        incomplete: false
      });

      // Within custom TTL
      let cached = pathCache.getPath(from, to, 1400);
      expect(cached).not.toBeNull();

      // After custom TTL
      cached = pathCache.getPath(from, to, 1501);
      expect(cached).toBeNull();
    });

    it("should update last accessed time on cache hit", () => {
      const from = new RoomPosition(1, 1, "W1N1");
      const to = new RoomPosition(10, 10, "W1N1");

      pathCache.setPath(from, to, mockPath, 1000, {
        ops: 100,
        cpuCost: 0.5,
        incomplete: false
      });

      const cached1 = pathCache.getPath(from, to, 1100);
      expect(cached1?.lastAccessed).toBe(1100);

      const cached2 = pathCache.getPath(from, to, 1200);
      expect(cached2?.lastAccessed).toBe(1200);
    });

    it("should differentiate paths by range", () => {
      const from = new RoomPosition(1, 1, "W1N1");
      const to = new RoomPosition(10, 10, "W1N1");
      const mockPath2 = [new RoomPosition(2, 2, "W1N1")];

      pathCache.setPath(from, to, mockPath, 1000, {
        ops: 100,
        cpuCost: 0.5,
        incomplete: false,
        range: 1
      });

      pathCache.setPath(from, to, mockPath2, 1000, {
        ops: 50,
        cpuCost: 0.3,
        incomplete: false,
        range: 3
      });

      const cached1 = pathCache.getPath(from, to, 1000, { range: 1 });
      const cached3 = pathCache.getPath(from, to, 1000, { range: 3 });

      expect(cached1?.path).toEqual(mockPath);
      expect(cached3?.path).toEqual(mockPath2);
    });
  });

  describe("LRU Eviction", () => {
    it("should evict least recently used path when cache is full", () => {
      pathCache = new PathCache({ maxPathEntries: 3 });

      const from1 = new RoomPosition(1, 1, "W1N1");
      const from2 = new RoomPosition(2, 2, "W1N1");
      const from3 = new RoomPosition(3, 3, "W1N1");
      const from4 = new RoomPosition(4, 4, "W1N1");
      const to = new RoomPosition(10, 10, "W1N1");

      // Fill cache
      pathCache.setPath(from1, to, mockPath, 1000, { ops: 100, cpuCost: 0.5, incomplete: false });
      pathCache.setPath(from2, to, mockPath, 1001, { ops: 100, cpuCost: 0.5, incomplete: false });
      pathCache.setPath(from3, to, mockPath, 1002, { ops: 100, cpuCost: 0.5, incomplete: false });

      // Access from1 to make it recently used
      pathCache.getPath(from1, to, 1003);

      // Add fourth entry - should evict from2 (least recently used)
      pathCache.setPath(from4, to, mockPath, 1004, { ops: 100, cpuCost: 0.5, incomplete: false });

      expect(pathCache.getPath(from1, to, 1005)).not.toBeNull(); // Recently accessed
      expect(pathCache.getPath(from2, to, 1005)).toBeNull(); // Should be evicted
      expect(pathCache.getPath(from3, to, 1005)).not.toBeNull();
      expect(pathCache.getPath(from4, to, 1005)).not.toBeNull();
    });

    it("should track LRU evictions in metrics", () => {
      pathCache = new PathCache({ maxPathEntries: 2 });

      const from1 = new RoomPosition(1, 1, "W1N1");
      const from2 = new RoomPosition(2, 2, "W1N1");
      const from3 = new RoomPosition(3, 3, "W1N1");
      const to = new RoomPosition(10, 10, "W1N1");

      pathCache.setPath(from1, to, mockPath, 1000, { ops: 100, cpuCost: 0.5, incomplete: false });
      pathCache.setPath(from2, to, mockPath, 1001, { ops: 100, cpuCost: 0.5, incomplete: false });
      pathCache.setPath(from3, to, mockPath, 1002, { ops: 100, cpuCost: 0.5, incomplete: false });

      const metrics = pathCache.getMetrics();
      expect(metrics.lruEvictions).toBe(1);
    });
  });

  describe("Cache Invalidation", () => {
    it("should invalidate all paths in a room", () => {
      const from1 = new RoomPosition(1, 1, "W1N1");
      const to1 = new RoomPosition(10, 10, "W1N1");
      const from2 = new RoomPosition(1, 1, "W2N2");
      const to2 = new RoomPosition(10, 10, "W2N2");

      pathCache.setPath(from1, to1, mockPath, 1000, { ops: 100, cpuCost: 0.5, incomplete: false });
      pathCache.setPath(from2, to2, mockPath, 1000, { ops: 100, cpuCost: 0.5, incomplete: false });

      pathCache.invalidateRoom("W1N1");

      expect(pathCache.getPath(from1, to1, 1000)).toBeNull();
      expect(pathCache.getPath(from2, to2, 1000)).not.toBeNull();
    });

    it("should clear all cached paths", () => {
      const from = new RoomPosition(1, 1, "W1N1");
      const to = new RoomPosition(10, 10, "W1N1");

      pathCache.setPath(from, to, mockPath, 1000, { ops: 100, cpuCost: 0.5, incomplete: false });
      pathCache.clear();

      expect(pathCache.getPath(from, to, 1000)).toBeNull();
      expect(pathCache.getMetrics().pathCacheSize).toBe(0);
    });
  });

  describe("Cost Matrix Caching", () => {
    it("should cache and retrieve cost matrices", () => {
      const mockMatrix = { _bits: new Uint8Array(2500) } as CostMatrix;

      pathCache.setCostMatrix("W1N1", "terrain", mockMatrix, 1000);

      const cached = pathCache.getCostMatrix("W1N1", "terrain", 1000);
      expect(cached).toBe(mockMatrix);
    });

    it("should return null for missing cost matrix", () => {
      const cached = pathCache.getCostMatrix("W1N1", "terrain", 1000);
      expect(cached).toBeNull();
    });

    it("should expire cost matrices after TTL", () => {
      const mockMatrix = { _bits: new Uint8Array(2500) } as CostMatrix;
      pathCache = new PathCache({ costMatrixTtl: 1000 });

      pathCache.setCostMatrix("W1N1", "terrain", mockMatrix, 1000);

      // Within TTL
      let cached = pathCache.getCostMatrix("W1N1", "terrain", 1500);
      expect(cached).not.toBeNull();

      // After TTL
      cached = pathCache.getCostMatrix("W1N1", "terrain", 2001);
      expect(cached).toBeNull();
    });

    it("should differentiate terrain and structure matrices", () => {
      const terrainMatrix = { _bits: new Uint8Array(2500) } as CostMatrix;
      const structureMatrix = { _bits: new Uint8Array(2500) } as CostMatrix;

      pathCache.setCostMatrix("W1N1", "terrain", terrainMatrix, 1000);
      pathCache.setCostMatrix("W1N1", "structures", structureMatrix, 1000);

      const cached1 = pathCache.getCostMatrix("W1N1", "terrain", 1000);
      const cached2 = pathCache.getCostMatrix("W1N1", "structures", 1000);

      expect(cached1).toBe(terrainMatrix);
      expect(cached2).toBe(structureMatrix);
    });

    it("should invalidate structure cost matrices", () => {
      const terrainMatrix = { _bits: new Uint8Array(2500) } as CostMatrix;
      const structureMatrix = { _bits: new Uint8Array(2500) } as CostMatrix;

      pathCache.setCostMatrix("W1N1", "terrain", terrainMatrix, 1000);
      pathCache.setCostMatrix("W1N1", "structures", structureMatrix, 1000);

      pathCache.invalidateStructures("W1N1");

      expect(pathCache.getCostMatrix("W1N1", "terrain", 1000)).not.toBeNull();
      expect(pathCache.getCostMatrix("W1N1", "structures", 1000)).toBeNull();
    });
  });

  describe("Metrics", () => {
    it("should track cache hits and misses", () => {
      const from = new RoomPosition(1, 1, "W1N1");
      const to = new RoomPosition(10, 10, "W1N1");

      pathCache.setPath(from, to, mockPath, 1000, { ops: 100, cpuCost: 0.5, incomplete: false });

      pathCache.getPath(from, to, 1000); // hit
      pathCache.getPath(from, to, 1000); // hit
      pathCache.getPath(new RoomPosition(5, 5, "W1N1"), to, 1000); // miss

      const metrics = pathCache.getMetrics();
      expect(metrics.hits).toBe(2);
      expect(metrics.misses).toBe(1);
      expect(metrics.hitRate).toBeCloseTo(2 / 3, 2);
    });

    it("should track CPU saved", () => {
      const from = new RoomPosition(1, 1, "W1N1");
      const to = new RoomPosition(10, 10, "W1N1");

      pathCache.setPath(from, to, mockPath, 1000, { ops: 100, cpuCost: 1.5, incomplete: false });

      pathCache.getPath(from, to, 1001);
      pathCache.getPath(from, to, 1002);

      const metrics = pathCache.getMetrics();
      expect(metrics.cpuSaved).toBe(3.0); // 1.5 * 2 hits
    });

    it("should track cache sizes", () => {
      const from1 = new RoomPosition(1, 1, "W1N1");
      const from2 = new RoomPosition(2, 2, "W1N1");
      const to = new RoomPosition(10, 10, "W1N1");

      pathCache.setPath(from1, to, mockPath, 1000, { ops: 100, cpuCost: 0.5, incomplete: false });
      pathCache.setPath(from2, to, mockPath, 1000, { ops: 100, cpuCost: 0.5, incomplete: false });

      const mockMatrix = { _bits: new Uint8Array(2500) } as CostMatrix;
      pathCache.setCostMatrix("W1N1", "terrain", mockMatrix, 1000);

      const metrics = pathCache.getMetrics();
      expect(metrics.pathCacheSize).toBe(2);
      expect(metrics.costMatrixCacheSize).toBe(1);
    });

    it("should track TTL evictions", () => {
      const from = new RoomPosition(1, 1, "W1N1");
      const to = new RoomPosition(10, 10, "W1N1");

      pathCache.setPath(from, to, mockPath, 1000, { ops: 100, cpuCost: 0.5, incomplete: false });

      // Trigger TTL eviction
      pathCache.getPath(from, to, 3000); // After TTL

      const metrics = pathCache.getMetrics();
      expect(metrics.ttlEvictions).toBe(1);
    });

    it("should reset metrics", () => {
      const from = new RoomPosition(1, 1, "W1N1");
      const to = new RoomPosition(10, 10, "W1N1");

      pathCache.setPath(from, to, mockPath, 1000, { ops: 100, cpuCost: 0.5, incomplete: false });
      pathCache.getPath(from, to, 1000); // hit

      pathCache.resetMetrics();

      const metrics = pathCache.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.cpuSaved).toBe(0);
      expect(metrics.lruEvictions).toBe(0);
      expect(metrics.ttlEvictions).toBe(0);
      // Cache sizes should not be reset
      expect(metrics.pathCacheSize).toBe(1);
    });

    it("should calculate hit rate correctly with zero queries", () => {
      const metrics = pathCache.getMetrics();
      expect(metrics.hitRate).toBe(0);
    });
  });

  describe("Cache Key Generation", () => {
    it("should generate consistent path keys", () => {
      const from = new RoomPosition(1, 2, "W1N1");
      const to = new RoomPosition(10, 20, "W2N2");

      const key1 = PathCache.generatePathKey(from, to, { range: 1 });
      const key2 = PathCache.generatePathKey(from, to, { range: 1 });

      expect(key1).toBe(key2);
      expect(key1).toBe("1,2-10,20-W1N1-W2N2-r1");
    });

    it("should generate different keys for different ranges", () => {
      const from = new RoomPosition(1, 2, "W1N1");
      const to = new RoomPosition(10, 20, "W2N2");

      const key1 = PathCache.generatePathKey(from, to, { range: 1 });
      const key3 = PathCache.generatePathKey(from, to, { range: 3 });

      expect(key1).not.toBe(key3);
    });

    it("should generate consistent cost matrix keys", () => {
      const key1 = PathCache.generateCostMatrixKey("W1N1", "terrain");
      const key2 = PathCache.generateCostMatrixKey("W1N1", "terrain");

      expect(key1).toBe(key2);
      expect(key1).toBe("W1N1-terrain");
    });

    it("should generate different keys for terrain vs structures", () => {
      const key1 = PathCache.generateCostMatrixKey("W1N1", "terrain");
      const key2 = PathCache.generateCostMatrixKey("W1N1", "structures");

      expect(key1).not.toBe(key2);
    });
  });
});
