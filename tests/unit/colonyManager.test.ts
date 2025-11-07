import { describe, it, expect, beforeEach } from "vitest";
import { ColonyManager, type ColonyManagerMemory } from "@runtime/planning/ColonyManager";

describe("ColonyManager", () => {
  let memory: ColonyManagerMemory;

  beforeEach(() => {
    memory = {
      expansionQueue: [],
      claimedRooms: [],
      shardMessages: [],
      lastExpansionCheck: 0
    };
  });

  describe("Initialization", () => {
    it("should initialize with default config", () => {
      const manager = new ColonyManager();
      const stats = manager.getStats();

      expect(stats.claimedRooms).toBe(0);
      expect(stats.expansionQueue).toBe(0);
      expect(stats.shardMessages).toBe(0);
    });

    it("should load state from memory", () => {
      memory.claimedRooms = ["W1N1", "W2N2"];
      memory.expansionQueue = [
        {
          targetRoom: "W3N3",
          priority: 75,
          reason: "nearby energy",
          requestedAt: 1000,
          status: "pending"
        }
      ];

      const manager = new ColonyManager({ memory });
      const stats = manager.getStats();

      expect(stats.claimedRooms).toBe(2);
      expect(stats.expansionQueue).toBe(1);
      expect(manager.getClaimedRooms()).toContain("W1N1");
      expect(manager.getClaimedRooms()).toContain("W2N2");
    });

    it("should use custom configuration", () => {
      const logger = { log: () => {}, warn: () => {} };
      const manager = new ColonyManager({
        minRclForExpansion: 5,
        maxRoomsPerShard: 15,
        logger,
        memory
      });

      expect(manager).toBeDefined();
    });
  });

  describe("Room tracking", () => {
    it("should update claimed rooms from Game.rooms", () => {
      const manager = new ColonyManager({ memory });
      const mockRooms = {
        W1N1: {
          controller: { my: true, level: 4 }
        } as Room,
        W2N2: {
          controller: { my: true, level: 5 }
        } as Room,
        W3N3: {
          controller: { my: false }
        } as Room
      };

      manager.run(mockRooms, 100);
      const claimedRooms = manager.getClaimedRooms();

      expect(claimedRooms).toHaveLength(2);
      expect(claimedRooms).toContain("W1N1");
      expect(claimedRooms).toContain("W2N2");
      expect(claimedRooms).not.toContain("W3N3");
    });

    it("should clear claimed rooms that are no longer owned", () => {
      memory.claimedRooms = ["W1N1", "W2N2", "W3N3"];
      const manager = new ColonyManager({ memory });

      const mockRooms = {
        W1N1: {
          controller: { my: true, level: 4 }
        } as Room
      };

      manager.run(mockRooms, 100);
      const claimedRooms = manager.getClaimedRooms();

      expect(claimedRooms).toHaveLength(1);
      expect(claimedRooms).toContain("W1N1");
    });
  });

  describe("Expansion requests", () => {
    it("should queue expansion request", () => {
      const manager = new ColonyManager({ memory });

      manager.requestExpansion("W3N3", "nearby energy source", 75, 1000);
      const queue = manager.getExpansionQueue();

      expect(queue).toHaveLength(1);
      expect(queue[0].targetRoom).toBe("W3N3");
      expect(queue[0].priority).toBe(75);
      expect(queue[0].reason).toBe("nearby energy source");
      expect(queue[0].status).toBe("pending");
    });

    it("should prioritize expansion requests by priority", () => {
      const manager = new ColonyManager({ memory });

      manager.requestExpansion("W3N3", "low priority", 25, 1000);
      manager.requestExpansion("W4N4", "high priority", 90, 1001);
      manager.requestExpansion("W5N5", "medium priority", 50, 1002);

      const queue = manager.getExpansionQueue();

      expect(queue[0].targetRoom).toBe("W4N4");
      expect(queue[1].targetRoom).toBe("W5N5");
      expect(queue[2].targetRoom).toBe("W3N3");
    });

    it("should not queue duplicate expansion requests", () => {
      const logger = { log: () => {}, warn: () => {} };
      const manager = new ColonyManager({ memory, logger });

      manager.requestExpansion("W3N3", "first request", 75, 1000);
      manager.requestExpansion("W3N3", "duplicate request", 80, 1001);

      const queue = manager.getExpansionQueue();

      expect(queue).toHaveLength(1);
      expect(queue[0].reason).toBe("first request");
    });

    it("should not queue expansion to already claimed rooms", () => {
      const logger = { log: () => {}, warn: () => {} };
      memory.claimedRooms = ["W1N1"];
      const manager = new ColonyManager({ memory, logger });

      const mockRooms = {
        W1N1: {
          controller: { my: true, level: 4 }
        } as Room
      };

      manager.run(mockRooms, 100);
      manager.requestExpansion("W1N1", "already owned", 75, 100);

      const queue = manager.getExpansionQueue();

      expect(queue).toHaveLength(0);
    });

    it("should use default priority of 50", () => {
      const manager = new ColonyManager({ memory });

      manager.requestExpansion("W3N3", "default priority", undefined, 1000);
      const queue = manager.getExpansionQueue();

      expect(queue[0].priority).toBe(50);
    });
  });

  describe("Inter-shard communication", () => {
    it("should create shard message", () => {
      const manager = new ColonyManager({ memory });

      manager.sendShardMessage("shard1", "resource_request", { resource: "energy", amount: 10000 }, 1000);
      manager.saveToMemory();

      expect(memory.shardMessages).toHaveLength(1);
      expect(memory.shardMessages[0].to).toBe("shard1");
      expect(memory.shardMessages[0].type).toBe("resource_request");
    });

    it("should clean up old shard messages", () => {
      memory.shardMessages = [
        { from: "shard0", to: "shard1", type: "status_update", payload: {}, timestamp: 100 },
        { from: "shard0", to: "shard1", type: "status_update", payload: {}, timestamp: 500 },
        { from: "shard0", to: "shard1", type: "status_update", payload: {}, timestamp: 1500 }
      ];

      const manager = new ColonyManager({ memory });
      const mockRooms = {};

      manager.run(mockRooms, 1600); // Current tick: 1600, cutoff: 600
      manager.saveToMemory();

      expect(memory.shardMessages.length).toBeLessThan(3);
    });

    it("should handle different message types", () => {
      const manager = new ColonyManager({ memory });

      manager.sendShardMessage("shard1", "resource_request", { resource: "energy" }, 1000);
      manager.sendShardMessage("shard2", "expansion_notice", { room: "W3N3" }, 1001);
      manager.sendShardMessage("shard3", "status_update", { status: "operational" }, 1002);
      manager.saveToMemory();

      expect(memory.shardMessages).toHaveLength(3);
      expect(memory.shardMessages[0].type).toBe("resource_request");
      expect(memory.shardMessages[1].type).toBe("expansion_notice");
      expect(memory.shardMessages[2].type).toBe("status_update");
    });
  });

  describe("Memory persistence", () => {
    it("should save state to memory", () => {
      const manager = new ColonyManager({ memory });

      manager.requestExpansion("W3N3", "test expansion", 75, 1000);
      manager.sendShardMessage("shard1", "status_update", {}, 1000);
      manager.saveToMemory();

      expect(memory.expansionQueue).toHaveLength(1);
      expect(memory.shardMessages).toHaveLength(1);
    });

    it("should persist expansion queue", () => {
      const manager = new ColonyManager({ memory });

      manager.requestExpansion("W3N3", "expansion 1", 75, 1000);
      manager.requestExpansion("W4N4", "expansion 2", 50, 1001);
      manager.saveToMemory();

      expect(memory.expansionQueue).toHaveLength(2);
      expect(memory.expansionQueue[0].targetRoom).toBe("W3N3");
      expect(memory.expansionQueue[1].targetRoom).toBe("W4N4");
    });

    it("should persist claimed rooms", () => {
      const manager = new ColonyManager({ memory });
      const mockRooms = {
        W1N1: {
          controller: { my: true, level: 4 }
        } as Room,
        W2N2: {
          controller: { my: true, level: 5 }
        } as Room
      };

      manager.run(mockRooms, 100);
      manager.saveToMemory();

      expect(memory.claimedRooms).toHaveLength(2);
      expect(memory.claimedRooms).toContain("W1N1");
      expect(memory.claimedRooms).toContain("W2N2");
    });
  });

  describe("Statistics", () => {
    it("should return accurate statistics", () => {
      const manager = new ColonyManager({ memory });
      const mockRooms = {
        W1N1: {
          controller: { my: true, level: 4 }
        } as Room
      };

      manager.run(mockRooms, 100);
      manager.requestExpansion("W3N3", "expansion 1", 75, 100);
      manager.requestExpansion("W4N4", "expansion 2", 50, 101);
      manager.sendShardMessage("shard1", "status_update", {}, 100);

      const stats = manager.getStats();

      expect(stats.claimedRooms).toBe(1);
      expect(stats.expansionQueue).toBe(2);
      expect(stats.pendingExpansions).toBe(2);
      expect(stats.shardMessages).toBe(1);
    });

    it("should count only pending expansions", () => {
      memory.expansionQueue = [
        { targetRoom: "W3N3", priority: 75, reason: "test", requestedAt: 100, status: "pending" },
        { targetRoom: "W4N4", priority: 50, reason: "test", requestedAt: 100, status: "claimed" },
        { targetRoom: "W5N5", priority: 25, reason: "test", requestedAt: 100, status: "failed" }
      ];

      const manager = new ColonyManager({ memory });
      const stats = manager.getStats();

      expect(stats.expansionQueue).toBe(3);
      expect(stats.pendingExpansions).toBe(1);
    });
  });

  describe("Expansion evaluation", () => {
    it("should evaluate expansion opportunities periodically", () => {
      const logger = { log: () => {}, warn: () => {} };
      const manager = new ColonyManager({ memory, logger, minRclForExpansion: 4 });

      const mockRooms = {
        W1N1: {
          controller: { my: true, level: 5 }
        } as Room
      };

      // First run at tick 100
      manager.run(mockRooms, 100);
      manager.saveToMemory();

      expect(memory.lastExpansionCheck).toBe(100);

      // Second run at tick 150 (< 100 tick interval)
      manager.run(mockRooms, 150);
      manager.saveToMemory();

      expect(memory.lastExpansionCheck).toBe(100); // Should not change

      // Third run at tick 200 (>= 100 tick interval)
      manager.run(mockRooms, 200);
      manager.saveToMemory();

      expect(memory.lastExpansionCheck).toBe(200); // Should update
    });

    it("should not evaluate expansion when no rooms meet RCL requirement", () => {
      const logger = { log: () => {}, warn: () => {} };
      const manager = new ColonyManager({ memory, logger, minRclForExpansion: 5 });

      const mockRooms = {
        W1N1: {
          controller: { my: true, level: 3 }
        } as Room
      };

      manager.run(mockRooms, 100);
      manager.saveToMemory();

      // lastExpansionCheck should still be updated even if no rooms qualify
      expect(memory.lastExpansionCheck).toBe(100);
    });
  });
});
