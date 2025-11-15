import { describe, it, expect, beforeEach } from "vitest";
import { TrafficManager } from "@runtime/infrastructure/TrafficManager";

describe("TrafficManager", () => {
  beforeEach(() => {
    (global as { Game?: { time: number } }).Game = { time: 1000 };

    // Mock RoomPosition constructor
    (
      global as unknown as { RoomPosition?: new (x: number, y: number, roomName: string) => RoomPosition }
    ).RoomPosition = class RoomPosition {
      public x: number;
      public y: number;
      public roomName: string;

      public constructor(x: number, y: number, roomName: string) {
        this.x = x;
        this.y = y;
        this.roomName = roomName;
      }
    } as unknown as new (x: number, y: number, roomName: string) => RoomPosition;
  });

  it("should initialize without errors", () => {
    const manager = new TrafficManager();
    expect(manager).toBeDefined();
  });

  it("should register movement requests", () => {
    const manager = new TrafficManager();

    const destination = { roomName: "W1N1", x: 25, y: 25 } as RoomPosition;
    manager.requestMovement("creep1", destination, 50);

    const request = manager.getRequest("creep1");

    expect(request).toBeDefined();
    expect(request?.priority).toBe(50);
  });

  it("should clear movement requests", () => {
    const manager = new TrafficManager();

    const destination = { roomName: "W1N1", x: 25, y: 25 } as RoomPosition;
    manager.requestMovement("creep1", destination, 50);

    manager.clearRequest("creep1");

    const request = manager.getRequest("creep1");

    expect(request).toBeUndefined();
  });

  describe("Traffic Analysis", () => {
    it("should record movement at positions", () => {
      const manager = new TrafficManager({ enableTrafficAnalysis: true });
      const pos = { roomName: "W1N1", x: 25, y: 25 } as RoomPosition;

      manager.recordMovement(pos);
      manager.recordMovement(pos);
      manager.recordMovement(pos);

      const traffic = manager.getTrafficAt(pos);
      expect(traffic).toBe(3);
    });

    it("should track multiple positions independently", () => {
      const manager = new TrafficManager({ enableTrafficAnalysis: true });
      const pos1 = { roomName: "W1N1", x: 25, y: 25 } as RoomPosition;
      const pos2 = { roomName: "W1N1", x: 26, y: 26 } as RoomPosition;

      manager.recordMovement(pos1);
      manager.recordMovement(pos1);
      manager.recordMovement(pos2);

      expect(manager.getTrafficAt(pos1)).toBe(2);
      expect(manager.getTrafficAt(pos2)).toBe(1);
      expect(manager.getTrackedPositionCount()).toBe(2);
    });

    it("should apply decay to traffic data", () => {
      const manager = new TrafficManager({
        enableTrafficAnalysis: true,
        trafficDecayRate: 0.5,
        trafficCleanupThreshold: 0.1 // Lower threshold to prevent cleanup
      });
      const pos = { roomName: "W1N1", x: 25, y: 25 } as RoomPosition;

      manager.recordMovement(pos);
      expect(manager.getTrafficAt(pos)).toBe(1);

      manager.applyTrafficDecay();
      expect(manager.getTrafficAt(pos)).toBe(0.5);
    });

    it("should cleanup low traffic positions", () => {
      const manager = new TrafficManager({
        enableTrafficAnalysis: true,
        trafficDecayRate: 0.1,
        trafficCleanupThreshold: 0.5
      });
      const pos = { roomName: "W1N1", x: 25, y: 25 } as RoomPosition;

      manager.recordMovement(pos);
      expect(manager.getTrackedPositionCount()).toBe(1);

      manager.applyTrafficDecay();
      // Traffic should be cleaned up as it's below threshold
      expect(manager.getTrackedPositionCount()).toBe(0);
    });

    it("should identify high-traffic positions", () => {
      const manager = new TrafficManager({ enableTrafficAnalysis: true });
      const pos1 = { roomName: "W1N1", x: 25, y: 25 } as RoomPosition;
      const pos2 = { roomName: "W1N1", x: 26, y: 26 } as RoomPosition;
      const pos3 = { roomName: "W1N1", x: 27, y: 27 } as RoomPosition;

      // Create different traffic levels
      for (let i = 0; i < 15; i++) manager.recordMovement(pos1);
      for (let i = 0; i < 8; i++) manager.recordMovement(pos2);
      for (let i = 0; i < 3; i++) manager.recordMovement(pos3);

      const highTraffic = manager.getHighTrafficPositions(10);

      expect(highTraffic).toHaveLength(1);
      expect(highTraffic[0].count).toBe(15);
      expect(highTraffic[0].pos.x).toBe(25);
    });

    it("should sort high-traffic positions by count", () => {
      const manager = new TrafficManager({ enableTrafficAnalysis: true });
      const pos1 = { roomName: "W1N1", x: 25, y: 25 } as RoomPosition;
      const pos2 = { roomName: "W1N1", x: 26, y: 26 } as RoomPosition;

      for (let i = 0; i < 20; i++) manager.recordMovement(pos1);
      for (let i = 0; i < 30; i++) manager.recordMovement(pos2);

      const highTraffic = manager.getHighTrafficPositions(10);

      expect(highTraffic).toHaveLength(2);
      expect(highTraffic[0].count).toBe(30); // pos2 should be first
      expect(highTraffic[1].count).toBe(20); // pos1 should be second
    });

    it("should not record traffic when disabled", () => {
      const manager = new TrafficManager({ enableTrafficAnalysis: false });
      const pos = { roomName: "W1N1", x: 25, y: 25 } as RoomPosition;

      manager.recordMovement(pos);

      expect(manager.getTrafficAt(pos)).toBe(0);
      expect(manager.getTrackedPositionCount()).toBe(0);
    });

    it("should persist and load traffic data from memory", () => {
      const memory = { movementRequests: {}, trafficData: {} };
      const manager1 = new TrafficManager({ enableTrafficAnalysis: true, memory });
      const pos = { roomName: "W1N1", x: 25, y: 25 } as RoomPosition;

      manager1.recordMovement(pos);
      manager1.recordMovement(pos);
      manager1.saveToMemory();

      // Create new manager with same memory reference
      const manager2 = new TrafficManager({ enableTrafficAnalysis: true, memory });

      expect(manager2.getTrafficAt(pos)).toBe(2);
      expect(manager2.getTrackedPositionCount()).toBe(1);
    });
  });

  describe("Memory Management and Size Limits", () => {
    it("should enforce global position limit", () => {
      const manager = new TrafficManager({
        enableTrafficAnalysis: true,
        maxTotalPositions: 10,
        trafficCleanupThreshold: 0.1 // Prevent decay cleanup
      });

      // Add 15 positions with varying traffic counts
      for (let i = 0; i < 15; i++) {
        const pos = { roomName: "W1N1", x: i, y: i } as RoomPosition;
        // Give different traffic counts (higher index = higher traffic)
        for (let j = 0; j <= i; j++) {
          manager.recordMovement(pos);
        }
      }

      expect(manager.getTrackedPositionCount()).toBe(15);

      // Apply decay which should enforce limits
      manager.applyTrafficDecay();

      // Should be capped at maxTotalPositions
      expect(manager.getTrackedPositionCount()).toBeLessThanOrEqual(10);

      // Highest traffic positions should be preserved
      const pos14 = { roomName: "W1N1", x: 14, y: 14 } as RoomPosition;
      expect(manager.getTrafficAt(pos14)).toBeGreaterThan(0);
    });

    it("should enforce per-room position limit", () => {
      const manager = new TrafficManager({
        enableTrafficAnalysis: true,
        maxPositionsPerRoom: 5,
        maxTotalPositions: 100,
        trafficCleanupThreshold: 0.1
      });

      // Add 10 positions in one room
      for (let i = 0; i < 10; i++) {
        const pos = { roomName: "W1N1", x: i, y: i } as RoomPosition;
        for (let j = 0; j <= i; j++) {
          manager.recordMovement(pos);
        }
      }

      expect(manager.getTrackedPositionCount()).toBe(10);

      // Apply decay which should enforce per-room limits
      manager.applyTrafficDecay();

      // Count positions in W1N1 room
      let roomPositionCount = 0;
      for (let i = 0; i < 10; i++) {
        const pos = { roomName: "W1N1", x: i, y: i } as RoomPosition;
        if (manager.getTrafficAt(pos) > 0) {
          roomPositionCount++;
        }
      }

      expect(roomPositionCount).toBeLessThanOrEqual(5);
    });

    it("should apply aggressive decay under memory pressure", () => {
      const manager = new TrafficManager({
        enableTrafficAnalysis: true,
        maxTotalPositions: 10,
        aggressiveDecayThreshold: 0.8, // Trigger at 8 positions
        trafficDecayRate: 0.9,
        trafficCleanupThreshold: 0.5
      });

      // Add 9 positions (above aggressive threshold)
      for (let i = 0; i < 9; i++) {
        const pos = { roomName: "W1N1", x: i, y: i } as RoomPosition;
        manager.recordMovement(pos);
      }

      const pos0 = { roomName: "W1N1", x: 0, y: 0 } as RoomPosition;
      const trafficBefore = manager.getTrafficAt(pos0);

      // Apply decay (should be more aggressive)
      manager.applyTrafficDecay();

      const trafficAfter = manager.getTrafficAt(pos0);

      // Traffic should decay more than normal rate (0.9) due to memory pressure
      expect(trafficAfter).toBeLessThan(trafficBefore * 0.9);
    });

    it("should provide memory usage statistics", () => {
      const manager = new TrafficManager({
        enableTrafficAnalysis: true,
        maxTotalPositions: 100,
        maxPositionsPerRoom: 50
      });

      // Add some positions
      for (let i = 0; i < 10; i++) {
        const pos = { roomName: "W1N1", x: i, y: i } as RoomPosition;
        manager.recordMovement(pos);
      }

      const stats = manager.getMemoryUsageStats();

      expect(stats.positionCount).toBe(10);
      expect(stats.estimatedBytes).toBeGreaterThan(0);
      expect(stats.maxTotalPositions).toBe(100);
      expect(stats.maxPositionsPerRoom).toBe(50);
      expect(stats.utilizationPercent).toBe(10);
    });

    it("should prune lowest traffic positions first", () => {
      const manager = new TrafficManager({
        enableTrafficAnalysis: true,
        maxTotalPositions: 5,
        trafficCleanupThreshold: 0.1
      });

      // Add positions with specific traffic counts
      const lowTrafficPos = { roomName: "W1N1", x: 0, y: 0 } as RoomPosition;
      const highTrafficPos = { roomName: "W1N1", x: 1, y: 1 } as RoomPosition;

      // Low traffic: 2 movements
      manager.recordMovement(lowTrafficPos);
      manager.recordMovement(lowTrafficPos);

      // High traffic: 10 movements
      for (let i = 0; i < 10; i++) {
        manager.recordMovement(highTrafficPos);
      }

      // Add more positions to exceed limit
      for (let i = 2; i < 8; i++) {
        const pos = { roomName: "W1N1", x: i, y: i } as RoomPosition;
        for (let j = 0; j < 5; j++) {
          manager.recordMovement(pos);
        }
      }

      // Apply decay to trigger pruning
      manager.applyTrafficDecay();

      // High traffic position should be preserved
      expect(manager.getTrafficAt(highTrafficPos)).toBeGreaterThan(0);

      // Low traffic position likely pruned
      expect(manager.getTrackedPositionCount()).toBeLessThanOrEqual(5);
    });

    it("should handle multiple rooms independently for per-room limits", () => {
      const manager = new TrafficManager({
        enableTrafficAnalysis: true,
        maxPositionsPerRoom: 3,
        maxTotalPositions: 100,
        trafficCleanupThreshold: 0.1
      });

      // Add 5 positions in room W1N1
      for (let i = 0; i < 5; i++) {
        const pos = { roomName: "W1N1", x: i, y: i } as RoomPosition;
        manager.recordMovement(pos);
      }

      // Add 5 positions in room W2N2
      for (let i = 0; i < 5; i++) {
        const pos = { roomName: "W2N2", x: i, y: i } as RoomPosition;
        manager.recordMovement(pos);
      }

      expect(manager.getTrackedPositionCount()).toBe(10);

      // Apply decay to enforce per-room limits
      manager.applyTrafficDecay();

      // Should have at most 3 positions per room, so max 6 total
      expect(manager.getTrackedPositionCount()).toBeLessThanOrEqual(6);
    });
  });
});
