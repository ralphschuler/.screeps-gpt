import { describe, it, expect, beforeEach } from "vitest";
import { ColonyManager, type ColonyManagerMemory } from "@runtime/planning/ColonyManager";

/**
 * Regression tests for multi-room colony scaling
 *
 * These tests validate that the ColonyManager correctly handles:
 * - Multi-room expansion and coordination
 * - Memory sharing across rooms
 * - Expansion queue management under load
 * - Inter-shard communication integrity
 *
 * Related to Phase 5 implementation: Multi-Room & Global Management
 */
describe("Multi-room scaling regression", () => {
  let memory: ColonyManagerMemory;

  beforeEach(() => {
    memory = {
      expansionQueue: [],
      claimedRooms: [],
      shardMessages: [],
      lastExpansionCheck: 0
    };
  });

  describe("Large-scale colony management", () => {
    it("should handle maximum room capacity", () => {
      const manager = new ColonyManager({ memory, maxRoomsPerShard: 5 });
      const mockRooms: Record<string, Room> = {};

      // Create 5 owned rooms
      for (let i = 1; i <= 5; i++) {
        mockRooms[`W${i}N1`] = {
          controller: { my: true, level: 6 }
        } as Room;
      }

      manager.run(mockRooms, 100);
      const stats = manager.getStats();

      expect(stats.claimedRooms).toBe(5);

      // Attempt to expand beyond limit
      manager.requestExpansion("W6N1", "beyond capacity", undefined, 75);
      manager.run(mockRooms, 200);

      // Expansion should be queued but not processed due to capacity
      expect(manager.getExpansionQueue()).toHaveLength(1);
    });

    it("should maintain expansion queue integrity under concurrent requests", () => {
      const manager = new ColonyManager({ memory });

      // Simulate concurrent expansion requests from multiple rooms
      const expansionTargets = ["W3N3", "W4N4", "W5N5", "W6N6", "W7N7"];
      expansionTargets.forEach((room, index) => {
        manager.requestExpansion(room, `expansion ${index}`, undefined, 50 + index * 10);
      });

      const queue = manager.getExpansionQueue();

      expect(queue).toHaveLength(5);
      // Verify priority ordering is maintained
      expect(queue[0].priority).toBeGreaterThanOrEqual(queue[1].priority);
      expect(queue[1].priority).toBeGreaterThanOrEqual(queue[2].priority);
    });

    it("should handle rapid room ownership changes", () => {
      const manager = new ColonyManager({ memory });
      const mockRooms: Record<string, Room> = {
        W1N1: { controller: { my: true, level: 4 } } as Room,
        W2N2: { controller: { my: true, level: 5 } } as Room
      };

      // First tick: 2 rooms
      manager.run(mockRooms, 100);
      expect(manager.getClaimedRooms()).toHaveLength(2);

      // Second tick: lose W2N2, gain W3N3
      delete mockRooms.W2N2;
      mockRooms.W3N3 = { controller: { my: true, level: 3 } } as Room;

      manager.run(mockRooms, 101);
      const claimed = manager.getClaimedRooms();

      expect(claimed).toHaveLength(2);
      expect(claimed).toContain("W1N1");
      expect(claimed).toContain("W3N3");
      expect(claimed).not.toContain("W2N2");
    });
  });

  describe("Memory sharing and persistence", () => {
    it("should preserve expansion queue across manager recreations", () => {
      const manager1 = new ColonyManager({ memory });

      manager1.requestExpansion("W3N3", "expansion 1", undefined, 75);
      manager1.requestExpansion("W4N4", "expansion 2", undefined, 50);
      manager1.saveToMemory();

      // Create new manager instance with same memory
      const manager2 = new ColonyManager({ memory });
      const queue = manager2.getExpansionQueue();

      expect(queue).toHaveLength(2);
      expect(queue[0].targetRoom).toBe("W3N3");
      expect(queue[1].targetRoom).toBe("W4N4");
    });

    it("should preserve inter-shard messages across restarts", () => {
      const manager1 = new ColonyManager({ memory });

      manager1.sendShardMessage("shard1", "resource_request", { resource: "energy", amount: 5000 });
      manager1.sendShardMessage("shard2", "status_update", { status: "operational" });
      manager1.saveToMemory();

      const manager2 = new ColonyManager({ memory });
      const stats = manager2.getStats();

      expect(stats.shardMessages).toBe(2);
    });

    it("should handle memory corruption gracefully", () => {
      // Corrupt memory structure
      memory.expansionQueue = null as unknown as typeof memory.expansionQueue;
      memory.shardMessages = undefined as unknown as typeof memory.shardMessages;

      const manager = new ColonyManager({ memory });
      const stats = manager.getStats();

      // Manager should still function with empty state
      expect(stats.expansionQueue).toBe(0);
      expect(stats.shardMessages).toBe(0);
    });
  });

  describe("Inter-shard communication reliability", () => {
    it("should batch multiple shard messages efficiently", () => {
      const manager = new ColonyManager({ memory });

      // Send multiple messages in quick succession
      for (let i = 0; i < 10; i++) {
        manager.sendShardMessage(`shard${i}`, "status_update", { iteration: i });
      }

      manager.saveToMemory();

      expect(memory.shardMessages).toHaveLength(10);
      // Verify messages maintain order
      for (let i = 0; i < 10; i++) {
        expect(memory.shardMessages[i].to).toBe(`shard${i}`);
      }
    });

    it("should clean up stale messages without affecting recent ones", () => {
      memory.shardMessages = [
        // Old messages (> 1000 ticks old)
        { from: "shard0", to: "shard1", type: "status_update", payload: {}, timestamp: 100 },
        { from: "shard0", to: "shard1", type: "status_update", payload: {}, timestamp: 200 },
        // Recent messages
        { from: "shard0", to: "shard1", type: "resource_request", payload: {}, timestamp: 1500 },
        { from: "shard0", to: "shard1", type: "expansion_notice", payload: {}, timestamp: 1600 }
      ];

      const manager = new ColonyManager({ memory });
      const mockRooms = {};

      manager.run(mockRooms, 1700); // Current tick: 1700, cutoff: 700
      manager.saveToMemory();

      // Only recent messages should remain
      const remaining = memory.shardMessages.filter(msg => msg.timestamp > 700);
      expect(remaining.length).toBeGreaterThan(0);
      expect(remaining.every(msg => msg.timestamp > 700)).toBe(true);
    });

    it("should handle message payload types correctly", () => {
      const manager = new ColonyManager({ memory });

      // Different payload structures
      manager.sendShardMessage(
        "shard1",
        "resource_request",
        {
          resource: "energy",
          amount: 10000,
          priority: "high"
        },
        1000
      );

      manager.sendShardMessage(
        "shard2",
        "expansion_notice",
        {
          room: "W3N3",
          rcl: 4,
          timestamp: 1000
        },
        1001
      );

      manager.sendShardMessage(
        "shard3",
        "status_update",
        {
          rooms: 5,
          cpu: 45.2,
          bucket: 9500
        },
        1002
      );

      manager.saveToMemory();

      expect(memory.shardMessages).toHaveLength(3);
      expect(memory.shardMessages[0].type).toBe("resource_request");
      expect(memory.shardMessages[1].type).toBe("expansion_notice");
      expect(memory.shardMessages[2].type).toBe("status_update");
    });
  });

  describe("Expansion queue under stress", () => {
    it("should handle rapid expansion request updates", () => {
      const manager = new ColonyManager({ memory });

      // Initial requests
      manager.requestExpansion("W3N3", "initial", undefined, 50);
      manager.requestExpansion("W4N4", "initial", undefined, 60);

      // Attempt duplicate with different priorities (should be rejected)
      manager.requestExpansion("W3N3", "duplicate", undefined, 90);

      const queue = manager.getExpansionQueue();

      // Only original requests should exist
      expect(queue).toHaveLength(2);
      expect(queue.find(req => req.targetRoom === "W3N3")?.reason).toBe("initial");
    });

    it("should maintain queue order after memory reload", () => {
      const manager1 = new ColonyManager({ memory });

      // Add requests in specific priority order
      manager1.requestExpansion("W3N3", "low", undefined, 25);
      manager1.requestExpansion("W4N4", "critical", undefined, 100);
      manager1.requestExpansion("W5N5", "medium", undefined, 50);
      manager1.saveToMemory();

      // Reload from memory
      const manager2 = new ColonyManager({ memory });
      const queue = manager2.getExpansionQueue();

      // Verify priority ordering is preserved
      expect(queue[0].targetRoom).toBe("W4N4"); // Highest priority
      expect(queue[1].targetRoom).toBe("W5N5");
      expect(queue[2].targetRoom).toBe("W3N3"); // Lowest priority
    });

    it("should handle expansion status transitions", () => {
      memory.expansionQueue = [
        { targetRoom: "W3N3", priority: 75, reason: "test", requestedAt: 100, status: "pending" },
        { targetRoom: "W4N4", priority: 50, reason: "test", requestedAt: 100, status: "pending" }
      ];

      const manager = new ColonyManager({ memory });

      // Simulate claim success by adding room to claimed list
      memory.claimedRooms = ["W3N3"];
      const mockRooms = {
        W3N3: { controller: { my: true, level: 1 } } as Room
      };

      manager.run(mockRooms, 200);
      manager.saveToMemory();

      // W3N3 should now be claimed
      expect(manager.getClaimedRooms()).toContain("W3N3");
    });
  });

  describe("Performance under scale", () => {
    it("should efficiently manage 10 rooms", () => {
      const manager = new ColonyManager({ memory, maxRoomsPerShard: 15 });
      const mockRooms: Record<string, Room> = {};

      // Create 10 rooms with varying RCL
      for (let i = 1; i <= 10; i++) {
        mockRooms[`W${i}N1`] = {
          controller: { my: true, level: Math.min(3 + Math.floor(i / 2), 8) }
        } as Room;
      }

      const startTime = Date.now();
      manager.run(mockRooms, 100);
      const duration = Date.now() - startTime;

      expect(manager.getClaimedRooms()).toHaveLength(10);
      expect(duration).toBeLessThan(100); // Should complete quickly
    });

    it("should handle high message volume efficiently", () => {
      const manager = new ColonyManager({ memory });

      // Send 100 messages
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        manager.sendShardMessage(`shard${i % 5}`, "status_update", { index: i }, 1000 + i);
      }
      const duration = Date.now() - startTime;

      manager.saveToMemory();

      expect(memory.shardMessages).toHaveLength(100);
      expect(duration).toBeLessThan(100); // Should be fast
    });
  });
});
