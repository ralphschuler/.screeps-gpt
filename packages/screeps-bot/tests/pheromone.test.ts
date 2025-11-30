import { describe, it, expect, beforeEach } from "vitest";
import { PheromoneManager } from "../src/pheromone/PheromoneManager";
import { createEmptyPheromones, clampPheromone } from "../src/pheromone/types";
import type { RoomState, RoomPheromones } from "../src/core/types";

describe("PheromoneManager", () => {
  let manager: PheromoneManager;
  let testRoomState: RoomState;

  beforeEach(() => {
    manager = new PheromoneManager();
    testRoomState = {
      name: "W1N1",
      evolutionStage: "growing",
      posture: "eco",
      threatLevel: 0,
      pheromones: {
        expand: 10,
        harvest: 20,
        build: 5,
        upgrade: 15,
        defense: 0,
        war: 0,
        siege: 0,
        logistics: 10
      },
      lastUpdate: 0
    };
  });

  describe("createEmptyPheromones", () => {
    it("should create pheromones with all values at zero", () => {
      const pheromones = createEmptyPheromones();
      expect(pheromones.expand).toBe(0);
      expect(pheromones.harvest).toBe(0);
      expect(pheromones.build).toBe(0);
      expect(pheromones.upgrade).toBe(0);
      expect(pheromones.defense).toBe(0);
      expect(pheromones.war).toBe(0);
      expect(pheromones.siege).toBe(0);
      expect(pheromones.logistics).toBe(0);
    });
  });

  describe("clampPheromone", () => {
    it("should clamp values below 0 to 0", () => {
      expect(clampPheromone(-10)).toBe(0);
    });

    it("should clamp values above 100 to 100", () => {
      expect(clampPheromone(150)).toBe(100);
    });

    it("should not clamp values within range", () => {
      expect(clampPheromone(50)).toBe(50);
    });
  });

  describe("emitEventPheromone", () => {
    it("should increase pheromone intensity", () => {
      manager.emitEventPheromone(testRoomState, "defense", 25);
      expect(testRoomState.pheromones.defense).toBe(25);
    });

    it("should accumulate pheromone values", () => {
      manager.emitEventPheromone(testRoomState, "harvest", 10);
      expect(testRoomState.pheromones.harvest).toBe(30);
    });

    it("should clamp pheromone to max 100", () => {
      manager.emitEventPheromone(testRoomState, "harvest", 100);
      expect(testRoomState.pheromones.harvest).toBe(100);
    });
  });

  describe("getDominantPheromone", () => {
    it("should return the highest intensity pheromone", () => {
      const dominant = manager.getDominantPheromone(testRoomState.pheromones);
      expect(dominant).toBe("harvest");
    });

    it("should return null for low intensity pheromones", () => {
      const lowPheromones: RoomPheromones = {
        expand: 0.5,
        harvest: 0.5,
        build: 0.5,
        upgrade: 0.5,
        defense: 0.5,
        war: 0.5,
        siege: 0.5,
        logistics: 0.5
      };
      const dominant = manager.getDominantPheromone(lowPheromones);
      expect(dominant).toBeNull();
    });
  });

  describe("onHostileDetected", () => {
    it("should emit defense pheromone based on hostile count", () => {
      manager.onHostileDetected(testRoomState, 3, 1);
      expect(testRoomState.pheromones.defense).toBe(15);
    });

    it("should emit war pheromone for high threat", () => {
      manager.onHostileDetected(testRoomState, 5, 2);
      expect(testRoomState.pheromones.war).toBe(20);
    });

    it("should emit siege pheromone for critical threat", () => {
      manager.onHostileDetected(testRoomState, 10, 3);
      expect(testRoomState.pheromones.siege).toBe(20);
    });
  });

  describe("onStructureDestroyed", () => {
    it("should emit defense and build pheromones", () => {
      manager.onStructureDestroyed(testRoomState, STRUCTURE_SPAWN);
      expect(testRoomState.pheromones.defense).toBe(5);
      expect(testRoomState.pheromones.build).toBe(15);
    });
  });

  describe("onNukeDetected", () => {
    it("should emit high siege and defense pheromones", () => {
      manager.onNukeDetected(testRoomState);
      expect(testRoomState.pheromones.siege).toBe(50);
      expect(testRoomState.pheromones.defense).toBe(30);
    });
  });

  describe("initializeRoom", () => {
    it("should return empty pheromones for new room", () => {
      const pheromones = manager.initializeRoom("W5N5");
      expect(pheromones.expand).toBe(0);
      expect(pheromones.harvest).toBe(0);
    });
  });
});
