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
});
