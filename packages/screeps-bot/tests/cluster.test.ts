import { describe, it, expect, beforeEach } from "vitest";
import { ClusterManager } from "../src/cluster/ClusterManager";
import { createCluster, isWithinRemoteRange } from "../src/cluster/types";

describe("ClusterManager", () => {
  let manager: ClusterManager;

  beforeEach(() => {
    manager = new ClusterManager();
  });

  describe("createCluster", () => {
    it("should create cluster with core room", () => {
      const cluster = createCluster("W1N1");
      expect(cluster.id).toBe("cluster_W1N1");
      expect(cluster.coreRoom).toBe("W1N1");
      expect(cluster.ownedRooms).toEqual(["W1N1"]);
      expect(cluster.remoteRooms).toEqual([]);
      expect(cluster.forwardBases).toEqual([]);
    });
  });

  describe("isWithinRemoteRange", () => {
    it("should return true for adjacent rooms", () => {
      expect(isWithinRemoteRange("W1N1", "W1N2", 2)).toBe(true);
      expect(isWithinRemoteRange("W1N1", "W2N1", 2)).toBe(true);
    });

    it("should return true for same room", () => {
      expect(isWithinRemoteRange("W1N1", "W1N1", 2)).toBe(true);
    });

    it("should return false for rooms beyond range", () => {
      expect(isWithinRemoteRange("W1N1", "W5N5", 2)).toBe(false);
    });

    it("should handle cross-direction rooms", () => {
      expect(isWithinRemoteRange("W1N1", "E1N1", 5)).toBe(true);
    });
  });

  describe("manager.createCluster", () => {
    it("should create and store cluster", () => {
      const cluster = manager.createCluster("W1N1");
      expect(cluster.coreRoom).toBe("W1N1");
      expect(manager.getCluster(cluster.id)).toBe(cluster);
    });
  });

  describe("addRemoteRoom", () => {
    it("should add remote room to cluster", () => {
      const cluster = manager.createCluster("W1N1");
      const added = manager.addRemoteRoom(cluster.id, "W1N2");
      expect(added).toBe(true);
      expect(cluster.remoteRooms).toContain("W1N2");
    });

    it("should not add duplicate remote room", () => {
      const cluster = manager.createCluster("W1N1");
      manager.addRemoteRoom(cluster.id, "W1N2");
      manager.addRemoteRoom(cluster.id, "W1N2");
      expect(cluster.remoteRooms.filter(r => r === "W1N2").length).toBe(1);
    });

    it("should reject rooms beyond remote range", () => {
      const cluster = manager.createCluster("W1N1");
      const added = manager.addRemoteRoom(cluster.id, "W10N10");
      expect(added).toBe(false);
    });

    it("should return false for non-existent cluster", () => {
      const added = manager.addRemoteRoom("invalid_id", "W1N2");
      expect(added).toBe(false);
    });
  });

  describe("addForwardBase", () => {
    it("should add forward base to cluster", () => {
      const cluster = manager.createCluster("W1N1");
      const added = manager.addForwardBase(cluster.id, "W3N3");
      expect(added).toBe(true);
      expect(cluster.forwardBases).toContain("W3N3");
    });

    it("should enforce max forward bases limit", () => {
      const cluster = manager.createCluster("W1N1");
      manager.addForwardBase(cluster.id, "W3N3");
      manager.addForwardBase(cluster.id, "W4N4");
      const added = manager.addForwardBase(cluster.id, "W5N5");
      expect(added).toBe(false);
    });
  });

  describe("removeRemoteRoom", () => {
    it("should remove remote room from cluster", () => {
      const cluster = manager.createCluster("W1N1");
      manager.addRemoteRoom(cluster.id, "W1N2");
      const removed = manager.removeRemoteRoom(cluster.id, "W1N2");
      expect(removed).toBe(true);
      expect(cluster.remoteRooms).not.toContain("W1N2");
    });

    it("should return false if room not in cluster", () => {
      const cluster = manager.createCluster("W1N1");
      const removed = manager.removeRemoteRoom(cluster.id, "W5N5");
      expect(removed).toBe(false);
    });
  });

  describe("setSpecialization", () => {
    it("should set cluster specialization", () => {
      const cluster = manager.createCluster("W1N1");
      manager.setSpecialization(cluster.id, "mineral");
      expect(cluster.specialization).toBe("mineral");
    });
  });

  describe("getClusterForRoom", () => {
    it("should find cluster by core room", () => {
      const cluster = manager.createCluster("W1N1");
      expect(manager.getClusterForRoom("W1N1")).toBe(cluster);
    });

    it("should find cluster by remote room", () => {
      const cluster = manager.createCluster("W1N1");
      manager.addRemoteRoom(cluster.id, "W1N2");
      expect(manager.getClusterForRoom("W1N2")).toBe(cluster);
    });

    it("should return undefined for untracked room", () => {
      expect(manager.getClusterForRoom("W99N99")).toBeUndefined();
    });
  });

  describe("getAllClusters", () => {
    it("should return all clusters", () => {
      manager.createCluster("W1N1");
      manager.createCluster("E1S1");
      const clusters = manager.getAllClusters();
      expect(clusters.length).toBe(2);
    });
  });

  describe("getClusterCount", () => {
    it("should return correct count", () => {
      expect(manager.getClusterCount()).toBe(0);
      manager.createCluster("W1N1");
      expect(manager.getClusterCount()).toBe(1);
    });
  });

  describe("saveToMemory / loadFromMemory", () => {
    it("should save and load clusters", () => {
      const cluster = manager.createCluster("W1N1");
      cluster.specialization = "defense";
      manager.addRemoteRoom(cluster.id, "W1N2");

      const saved = manager.saveToMemory();

      const newManager = new ClusterManager();
      newManager.loadFromMemory(saved);

      const loaded = newManager.getCluster(cluster.id);
      expect(loaded?.coreRoom).toBe("W1N1");
      expect(loaded?.specialization).toBe("defense");
      expect(loaded?.remoteRooms).toContain("W1N2");
    });
  });
});
