/**
 * Memory Schema Tests
 */
import { describe, it, expect } from "vitest";
import {
  createDefaultPheromones,
  createDefaultSwarmState,
  createDefaultOvermindMemory,
  createDefaultClusterMemory,
  createDefaultCreepMemory
} from "../src/memory/schemas";

describe("Memory Schemas", () => {
  describe("createDefaultPheromones", () => {
    it("should create pheromones with default values", () => {
      const pheromones = createDefaultPheromones();
      expect(pheromones.harvest).toBe(10);
      expect(pheromones.build).toBe(5);
      expect(pheromones.upgrade).toBe(5);
      expect(pheromones.logistics).toBe(5);
      expect(pheromones.expand).toBe(0);
      expect(pheromones.defense).toBe(0);
      expect(pheromones.war).toBe(0);
      expect(pheromones.siege).toBe(0);
      expect(pheromones.nukeTarget).toBe(0);
    });
  });

  describe("createDefaultSwarmState", () => {
    it("should create swarm state with proper defaults", () => {
      const state = createDefaultSwarmState();
      expect(state.colonyLevel).toBe("seedColony");
      expect(state.posture).toBe("eco");
      expect(state.danger).toBe(0);
      expect(state.eventLog).toEqual([]);
      expect(state.role).toBe("secondaryCore");
    });

    it("should create swarm state with missing structures flags", () => {
      const state = createDefaultSwarmState();
      expect(state.missingStructures.spawn).toBe(true);
      expect(state.missingStructures.storage).toBe(true);
      expect(state.missingStructures.terminal).toBe(true);
      expect(state.missingStructures.labs).toBe(true);
    });

    it("should create swarm state with empty metrics", () => {
      const state = createDefaultSwarmState();
      expect(state.metrics.energyHarvested).toBe(0);
      expect(state.metrics.controllerProgress).toBe(0);
      expect(state.metrics.hostileCount).toBe(0);
    });
  });

  describe("createDefaultOvermindMemory", () => {
    it("should create overmind memory with empty collections", () => {
      const overmind = createDefaultOvermindMemory();
      expect(overmind.roomsSeen).toEqual({});
      expect(overmind.roomIntel).toEqual({});
      expect(overmind.claimQueue).toEqual([]);
      expect(overmind.warTargets).toEqual([]);
      expect(overmind.nukeCandidates).toEqual([]);
      expect(overmind.powerBanks).toEqual([]);
    });

    it("should create overmind memory with default objectives", () => {
      const overmind = createDefaultOvermindMemory();
      expect(overmind.objectives.targetPowerLevel).toBe(0);
      expect(overmind.objectives.targetRoomCount).toBe(1);
      expect(overmind.objectives.warMode).toBe(false);
      expect(overmind.objectives.expansionPaused).toBe(false);
    });
  });

  describe("createDefaultClusterMemory", () => {
    it("should create cluster with core room", () => {
      const cluster = createDefaultClusterMemory("cluster_W1N1", "W1N1");
      expect(cluster.id).toBe("cluster_W1N1");
      expect(cluster.coreRoom).toBe("W1N1");
      expect(cluster.memberRooms).toContain("W1N1");
    });

    it("should create cluster with empty remote/forward lists", () => {
      const cluster = createDefaultClusterMemory("cluster_W1N1", "W1N1");
      expect(cluster.remoteRooms).toEqual([]);
      expect(cluster.forwardBases).toEqual([]);
      expect(cluster.squads).toEqual([]);
    });

    it("should create cluster with economic role by default", () => {
      const cluster = createDefaultClusterMemory("cluster_W1N1", "W1N1");
      expect(cluster.role).toBe("economic");
    });
  });

  describe("createDefaultCreepMemory", () => {
    it("should create creep memory with role and family", () => {
      const memory = createDefaultCreepMemory("harvester", "economy", "W1N1");
      expect(memory.role).toBe("harvester");
      expect(memory.family).toBe("economy");
      expect(memory.homeRoom).toBe("W1N1");
      expect(memory.version).toBe(1);
    });

    it("should not include optional fields by default", () => {
      const memory = createDefaultCreepMemory("guard", "military", "W1N1");
      expect(memory.targetRoom).toBeUndefined();
      expect(memory.task).toBeUndefined();
      expect(memory.sourceId).toBeUndefined();
    });
  });
});
