import { describe, expect, it, vi } from "vitest";
import { BootstrapPhaseManager } from "@runtime/bootstrap/BootstrapPhaseManager";
import type { GameContext, RoomLike } from "@runtime/types/GameContext";

function createGameContext(options: {
  time: number;
  controllerLevel?: number;
  energyAvailable?: number;
  energyCapacityAvailable?: number;
}): GameContext {
  const controller =
    options.controllerLevel !== undefined
      ? {
          my: true,
          level: options.controllerLevel,
          progress: 0,
          progressTotal: 1000
        }
      : null;

  const room: RoomLike = {
    name: "W0N0",
    controller,
    energyAvailable: options.energyAvailable ?? 0,
    energyCapacityAvailable: options.energyCapacityAvailable ?? 300,
    find: vi.fn().mockReturnValue([])
  };

  return {
    time: options.time,
    cpu: {
      getUsed: () => 0,
      limit: 100,
      bucket: 10000
    },
    creeps: {},
    spawns: {},
    rooms: { W0N0: room }
  };
}

describe("BootstrapPhaseManager", () => {
  describe("bootstrap phase initialization", () => {
    it("should activate bootstrap for new room with low controller level", () => {
      const manager = new BootstrapPhaseManager();
      const game = createGameContext({ time: 100, controllerLevel: 1 });
      const memory = {} as Memory;

      const status = manager.checkBootstrapStatus(game, memory);

      expect(status.isActive).toBe(true);
      expect(memory.bootstrap).toBeDefined();
      expect(memory.bootstrap?.isActive).toBe(true);
      expect(memory.bootstrap?.startedAt).toBe(100);
    });

    it("should not activate bootstrap for room with high controller level", () => {
      const manager = new BootstrapPhaseManager({ targetControllerLevel: 2 });
      const game = createGameContext({ time: 100, controllerLevel: 2 });
      const memory = {} as Memory;

      const status = manager.checkBootstrapStatus(game, memory);

      expect(status.isActive).toBe(false);
      expect(memory.bootstrap?.isActive).toBe(false);
    });

    it("should not activate bootstrap if no room exists", () => {
      const manager = new BootstrapPhaseManager();
      const game: GameContext = {
        time: 100,
        cpu: { getUsed: () => 0, limit: 100, bucket: 10000 },
        creeps: {},
        spawns: {},
        rooms: {}
      };
      const memory = {} as Memory;

      const status = manager.checkBootstrapStatus(game, memory);

      expect(status.isActive).toBe(false);
    });
  });

  describe("bootstrap phase completion", () => {
    it("should complete bootstrap when controller reaches target level", () => {
      const manager = new BootstrapPhaseManager({ targetControllerLevel: 2 });
      const memory = {
        bootstrap: { isActive: true, startedAt: 100 }
      } as Memory;

      // First check at level 1 - should remain active
      const game1 = createGameContext({ time: 200, controllerLevel: 1 });
      const status1 = manager.checkBootstrapStatus(game1, memory);
      expect(status1.isActive).toBe(true);
      expect(status1.shouldTransition).toBe(false);

      // Second check at level 2 - should complete
      const game2 = createGameContext({ time: 300, controllerLevel: 2 });
      const status2 = manager.checkBootstrapStatus(game2, memory);
      expect(status2.isActive).toBe(true);
      expect(status2.shouldTransition).toBe(true);
      expect(status2.reason).toContain("Controller reached level 2");
    });

    it("should complete bootstrap with sufficient harvesters and energy", () => {
      const manager = new BootstrapPhaseManager({
        targetControllerLevel: 2,
        minHarvesterCount: 4,
        minEnergyAvailable: 300
      });

      const memory = {
        bootstrap: { isActive: true, startedAt: 100 },
        roles: { harvester: 4 }
      } as Memory;

      const game = createGameContext({
        time: 200,
        controllerLevel: 1,
        energyAvailable: 300,
        energyCapacityAvailable: 300
      });

      const status = manager.checkBootstrapStatus(game, memory);
      expect(status.isActive).toBe(true);
      expect(status.shouldTransition).toBe(true);
      expect(status.reason).toContain("Stable infrastructure");
      expect(status.reason).toContain("4 harvesters");
    });

    it("should not complete bootstrap with insufficient harvesters", () => {
      const manager = new BootstrapPhaseManager({
        targetControllerLevel: 2,
        minHarvesterCount: 4,
        minEnergyAvailable: 300
      });

      const memory = {
        bootstrap: { isActive: true, startedAt: 100 },
        roles: { harvester: 2 }
      } as Memory;

      const game = createGameContext({
        time: 200,
        controllerLevel: 1,
        energyAvailable: 300
      });

      const status = manager.checkBootstrapStatus(game, memory);
      expect(status.isActive).toBe(true);
      expect(status.shouldTransition).toBe(false);
    });

    it("should not complete bootstrap with insufficient energy", () => {
      const manager = new BootstrapPhaseManager({
        targetControllerLevel: 2,
        minHarvesterCount: 4,
        minEnergyAvailable: 300
      });

      const memory = {
        bootstrap: { isActive: true, startedAt: 100 },
        roles: { harvester: 4 }
      } as Memory;

      const game = createGameContext({
        time: 200,
        controllerLevel: 1,
        energyAvailable: 100
      });

      const status = manager.checkBootstrapStatus(game, memory);
      expect(status.isActive).toBe(true);
      expect(status.shouldTransition).toBe(false);
    });

    it("should mark bootstrap as completed and log duration", () => {
      const logger = { log: vi.fn(), warn: vi.fn() };
      const manager = new BootstrapPhaseManager({}, logger);

      const memory = {
        bootstrap: { isActive: true, startedAt: 100 }
      } as Memory;

      const game = createGameContext({ time: 250, controllerLevel: 2 });

      manager.completeBootstrap(game, memory, "Controller reached level 2");

      expect(memory.bootstrap?.isActive).toBe(false);
      expect(memory.bootstrap?.completedAt).toBe(250);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("Bootstrap phase completed after 150 ticks"));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("Controller reached level 2"));
    });

    it("should remain inactive once bootstrap is completed", () => {
      const manager = new BootstrapPhaseManager();
      const memory = {
        bootstrap: {
          isActive: false,
          startedAt: 100,
          completedAt: 250
        }
      } as Memory;

      const game = createGameContext({ time: 300, controllerLevel: 1 });
      const status = manager.checkBootstrapStatus(game, memory);

      expect(status.isActive).toBe(false);
      expect(status.shouldTransition).toBe(false);
    });
  });

  describe("bootstrap role minimums", () => {
    it("should return bootstrap-adjusted minimums when bootstrap is active", () => {
      const manager = new BootstrapPhaseManager();
      const minimums = manager.getBootstrapRoleMinimums(true);

      expect(minimums.harvester).toBe(6);
      expect(minimums.upgrader).toBe(1);
      expect(minimums.builder).toBe(0);
    });

    it("should return empty object when bootstrap is not active", () => {
      const manager = new BootstrapPhaseManager();
      const minimums = manager.getBootstrapRoleMinimums(false);

      expect(minimums).toEqual({});
    });
  });

  describe("configuration", () => {
    it("should use default configuration values", () => {
      const manager = new BootstrapPhaseManager();
      const game = createGameContext({ time: 100, controllerLevel: 1 });
      const memory = {} as Memory;

      manager.checkBootstrapStatus(game, memory);

      // Default targetControllerLevel is 2, so level 1 should activate bootstrap
      expect(memory.bootstrap?.isActive).toBe(true);
    });

    it("should respect custom targetControllerLevel", () => {
      const manager = new BootstrapPhaseManager({ targetControllerLevel: 3 });
      const game = createGameContext({ time: 100, controllerLevel: 2 });
      const memory = {} as Memory;

      manager.checkBootstrapStatus(game, memory);

      // Custom target is 3, so level 2 should still activate bootstrap
      expect(memory.bootstrap?.isActive).toBe(true);
    });

    it("should respect custom minHarvesterCount", () => {
      const manager = new BootstrapPhaseManager({
        targetControllerLevel: 2,
        minHarvesterCount: 8,
        minEnergyAvailable: 300
      });

      const memory = {
        bootstrap: { isActive: true, startedAt: 100 },
        roles: { harvester: 6 }
      } as Memory;

      const game = createGameContext({
        time: 200,
        controllerLevel: 1,
        energyAvailable: 300
      });

      const status = manager.checkBootstrapStatus(game, memory);

      // Should not complete with only 6 harvesters when 8 are required
      expect(status.shouldTransition).toBe(false);
    });

    it("should respect custom minEnergyAvailable", () => {
      const manager = new BootstrapPhaseManager({
        targetControllerLevel: 2,
        minHarvesterCount: 4,
        minEnergyAvailable: 500
      });

      const memory = {
        bootstrap: { isActive: true, startedAt: 100 },
        roles: { harvester: 4 }
      } as Memory;

      const game = createGameContext({
        time: 200,
        controllerLevel: 1,
        energyAvailable: 300
      });

      const status = manager.checkBootstrapStatus(game, memory);

      // Should not complete with only 300 energy when 500 is required
      expect(status.shouldTransition).toBe(false);
    });
  });
});
