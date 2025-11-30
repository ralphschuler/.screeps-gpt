import { describe, it, expect, beforeEach } from "vitest";
import { RoomStateManager } from "../src/room/RoomStateManager";
import { createInitialRoomState, getEvolutionStageFromRCL, getPostureFromThreatLevel } from "../src/room/types";
import type { RoomState } from "../src/core/types";

describe("RoomStateManager", () => {
  let manager: RoomStateManager;

  beforeEach(() => {
    manager = new RoomStateManager();
  });

  describe("createInitialRoomState", () => {
    it("should create room state with default values", () => {
      const state = createInitialRoomState("W1N1");
      expect(state.name).toBe("W1N1");
      expect(state.evolutionStage).toBe("seed");
      expect(state.posture).toBe("eco");
      expect(state.threatLevel).toBe(0);
    });

    it("should allow specifying evolution stage", () => {
      const state = createInitialRoomState("W1N1", "developed");
      expect(state.evolutionStage).toBe("developed");
    });

    it("should allow specifying posture", () => {
      const state = createInitialRoomState("W1N1", "seed", "defensive");
      expect(state.posture).toBe("defensive");
    });

    it("should initialize pheromones with default values", () => {
      const state = createInitialRoomState("W1N1");
      expect(state.pheromones.harvest).toBe(10);
      expect(state.pheromones.build).toBe(5);
      expect(state.pheromones.upgrade).toBe(5);
      expect(state.pheromones.logistics).toBe(5);
      expect(state.pheromones.expand).toBe(0);
      expect(state.pheromones.defense).toBe(0);
    });
  });

  describe("getEvolutionStageFromRCL", () => {
    it("should return seed for RCL 1-2", () => {
      expect(getEvolutionStageFromRCL(1)).toBe("seed");
      expect(getEvolutionStageFromRCL(2)).toBe("seed");
    });

    it("should return growing for RCL 3-4", () => {
      expect(getEvolutionStageFromRCL(3)).toBe("growing");
      expect(getEvolutionStageFromRCL(4)).toBe("growing");
    });

    it("should return developed for RCL 5-6", () => {
      expect(getEvolutionStageFromRCL(5)).toBe("developed");
      expect(getEvolutionStageFromRCL(6)).toBe("developed");
    });

    it("should return fortified for RCL 7", () => {
      expect(getEvolutionStageFromRCL(7)).toBe("fortified");
    });

    it("should return fullyOperational for RCL 8", () => {
      expect(getEvolutionStageFromRCL(8)).toBe("fullyOperational");
    });
  });

  describe("getPostureFromThreatLevel", () => {
    it("should return eco for threat level 0", () => {
      expect(getPostureFromThreatLevel(0, "eco")).toBe("eco");
    });

    it("should return defensive for threat level 1", () => {
      expect(getPostureFromThreatLevel(1, "eco")).toBe("defensive");
    });

    it("should return war for threat level 2", () => {
      expect(getPostureFromThreatLevel(2, "eco")).toBe("war");
    });

    it("should return siege for threat level 3", () => {
      expect(getPostureFromThreatLevel(3, "eco")).toBe("siege");
    });

    it("should keep evacuate posture when threat is present", () => {
      expect(getPostureFromThreatLevel(1, "evacuate")).toBe("evacuate");
      expect(getPostureFromThreatLevel(2, "evacuate")).toBe("evacuate");
    });

    it("should allow exit from evacuate when threat is zero", () => {
      expect(getPostureFromThreatLevel(0, "evacuate")).toBe("eco");
    });
  });

  describe("initializeRoom", () => {
    it("should create initial room state", () => {
      const state = manager.initializeRoom("W5N5");
      expect(state.name).toBe("W5N5");
      expect(state.evolutionStage).toBe("seed");
    });
  });

  describe("setPosture", () => {
    it("should update room posture", () => {
      const state = createInitialRoomState("W1N1");
      manager.setPosture(state, "war", "Test reason");
      expect(state.posture).toBe("war");
    });
  });

  describe("updateThreatLevel", () => {
    it("should update room threat level", () => {
      const state = createInitialRoomState("W1N1");
      manager.updateThreatLevel(state, 2);
      expect(state.threatLevel).toBe(2);
    });
  });

  describe("isInCombat", () => {
    it("should return true for war posture", () => {
      const state = createInitialRoomState("W1N1", "seed", "war");
      expect(manager.isInCombat(state)).toBe(true);
    });

    it("should return true for siege posture", () => {
      const state = createInitialRoomState("W1N1", "seed", "siege");
      expect(manager.isInCombat(state)).toBe(true);
    });

    it("should return true for defensive posture", () => {
      const state = createInitialRoomState("W1N1", "seed", "defensive");
      expect(manager.isInCombat(state)).toBe(true);
    });

    it("should return false for eco posture", () => {
      const state = createInitialRoomState("W1N1", "seed", "eco");
      expect(manager.isInCombat(state)).toBe(false);
    });
  });

  describe("isEconomyFocused", () => {
    it("should return true for eco posture", () => {
      const state = createInitialRoomState("W1N1", "seed", "eco");
      expect(manager.isEconomyFocused(state)).toBe(true);
    });

    it("should return true for expand posture", () => {
      const state = createInitialRoomState("W1N1", "seed", "expand");
      expect(manager.isEconomyFocused(state)).toBe(true);
    });

    it("should return false for war posture", () => {
      const state = createInitialRoomState("W1N1", "seed", "war");
      expect(manager.isEconomyFocused(state)).toBe(false);
    });
  });
});
