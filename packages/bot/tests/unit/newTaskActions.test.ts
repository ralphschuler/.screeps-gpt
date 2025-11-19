/* eslint-disable @typescript-eslint/no-deprecated */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  PickupAction,
  DropAction,
  ClaimAction,
  AttackAction,
  HealAction,
  DismantleAction,
  SignControllerAction,
  RecycleAction
} from "@runtime/tasks";

// Mock Game object
global.Game = {
  time: 1000,
  getObjectById: vi.fn()
} as unknown as Game;

describe("New Task Actions", () => {
  let mockCreep: Creep;

  beforeEach(() => {
    mockCreep = {
      id: "creep1" as Id<Creep>,
      name: "TestCreep",
      pos: {
        getRangeTo: vi.fn().mockReturnValue(5)
      },
      body: [
        { type: WORK, hits: 100 },
        { type: CARRY, hits: 100 },
        { type: MOVE, hits: 100 }
      ],
      store: {
        getUsedCapacity: vi.fn().mockReturnValue(0),
        getFreeCapacity: vi.fn().mockReturnValue(50)
      },
      moveTo: vi.fn()
    } as unknown as Creep;
  });

  describe("PickupAction", () => {
    it("should pickup resource when in range", () => {
      const mockResource = {
        id: "resource1" as Id<Resource>,
        pos: { x: 10, y: 10 },
        amount: 100,
        resourceType: RESOURCE_ENERGY
      } as Resource;

      (Game.getObjectById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockResource);
      (mockCreep.pos.getRangeTo as unknown as ReturnType<typeof vi.fn>).mockReturnValue(1);
      mockCreep.pickup = vi.fn().mockReturnValue(OK);

      const action = new PickupAction(mockResource.id);
      const result = action.action(mockCreep);

      expect(mockCreep.pickup).toHaveBeenCalledWith(mockResource);
      expect(result).toBe(true);
    });

    it("should move to resource when not in range", () => {
      const mockResource = {
        id: "resource1" as Id<Resource>,
        pos: { x: 10, y: 10 },
        amount: 100
      } as Resource;

      (Game.getObjectById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockResource);
      (mockCreep.pos.getRangeTo as unknown as ReturnType<typeof vi.fn>).mockReturnValue(5);
      mockCreep.pickup = vi.fn().mockReturnValue(ERR_NOT_IN_RANGE);

      const action = new PickupAction(mockResource.id);
      const result = action.action(mockCreep);

      expect(mockCreep.moveTo).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should complete when resource doesn't exist", () => {
      (Game.getObjectById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const action = new PickupAction("resource1" as Id<Resource>);
      const result = action.action(mockCreep);

      expect(result).toBe(true);
    });
  });

  describe("DropAction", () => {
    it("should drop resource", () => {
      mockCreep.drop = vi.fn().mockReturnValue(OK);
      mockCreep.store.getUsedCapacity = vi.fn().mockReturnValue(50);

      const action = new DropAction(RESOURCE_ENERGY);
      const result = action.action(mockCreep);

      expect(mockCreep.drop).toHaveBeenCalledWith(RESOURCE_ENERGY, 50);
      expect(result).toBe(true);
    });

    it("should complete when nothing to drop", () => {
      mockCreep.store.getUsedCapacity = vi.fn().mockReturnValue(0);

      const action = new DropAction(RESOURCE_ENERGY);
      const result = action.action(mockCreep);

      expect(result).toBe(true);
    });
  });

  describe("ClaimAction", () => {
    it("should claim controller when in range", () => {
      const mockController = {
        id: "controller1" as Id<StructureController>,
        pos: { x: 25, y: 25 }
      } as StructureController;

      (Game.getObjectById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockController);
      (mockCreep.pos.getRangeTo as unknown as ReturnType<typeof vi.fn>).mockReturnValue(1);
      mockCreep.claimController = vi.fn().mockReturnValue(OK);
      mockCreep.body = [{ type: CLAIM, hits: 100 }];

      const action = new ClaimAction(mockController.id);
      const result = action.action(mockCreep);

      expect(mockCreep.claimController).toHaveBeenCalledWith(mockController);
      expect(result).toBe(true);
    });

    it("should move to controller when not in range", () => {
      const mockController = {
        id: "controller1" as Id<StructureController>,
        pos: { x: 25, y: 25 }
      } as StructureController;

      (Game.getObjectById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockController);
      (mockCreep.pos.getRangeTo as unknown as ReturnType<typeof vi.fn>).mockReturnValue(5);
      mockCreep.claimController = vi.fn().mockReturnValue(ERR_NOT_IN_RANGE);

      const action = new ClaimAction(mockController.id);
      const result = action.action(mockCreep);

      expect(mockCreep.moveTo).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe("AttackAction", () => {
    it("should attack target when in range", () => {
      const mockTarget = {
        id: "hostile1" as Id<Creep>,
        pos: { x: 15, y: 15 }
      } as Creep;

      (Game.getObjectById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockTarget);
      (mockCreep.pos.getRangeTo as unknown as ReturnType<typeof vi.fn>).mockReturnValue(1);
      mockCreep.attack = vi.fn().mockReturnValue(OK);
      mockCreep.body = [{ type: ATTACK, hits: 100 }];

      const action = new AttackAction(mockTarget.id);
      const result = action.action(mockCreep);

      expect(mockCreep.attack).toHaveBeenCalledWith(mockTarget);
      expect(result).toBe(false); // Continue attacking
    });

    it("should move to target when not in range", () => {
      const mockTarget = {
        id: "hostile1" as Id<Creep>,
        pos: { x: 15, y: 15 }
      } as Creep;

      (Game.getObjectById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockTarget);
      (mockCreep.pos.getRangeTo as unknown as ReturnType<typeof vi.fn>).mockReturnValue(5);
      mockCreep.attack = vi.fn().mockReturnValue(ERR_NOT_IN_RANGE);

      const action = new AttackAction(mockTarget.id);
      const result = action.action(mockCreep);

      expect(mockCreep.moveTo).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe("HealAction", () => {
    it("should heal target when damaged", () => {
      const mockTarget = {
        id: "friend1" as Id<Creep>,
        pos: { x: 15, y: 15 },
        hits: 50,
        hitsMax: 100
      } as Creep;

      (Game.getObjectById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockTarget);
      (mockCreep.pos.getRangeTo as unknown as ReturnType<typeof vi.fn>).mockReturnValue(1);
      mockCreep.heal = vi.fn().mockReturnValue(OK);
      mockCreep.body = [{ type: HEAL, hits: 100 }];

      const action = new HealAction(mockTarget.id);
      const result = action.action(mockCreep);

      expect(mockCreep.heal).toHaveBeenCalledWith(mockTarget);
      expect(result).toBe(false); // Continue healing
    });

    it("should complete when target is fully healed", () => {
      const mockTarget = {
        id: "friend1" as Id<Creep>,
        pos: { x: 15, y: 15 },
        hits: 100,
        hitsMax: 100
      } as Creep;

      (Game.getObjectById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockTarget);

      const action = new HealAction(mockTarget.id);
      const result = action.action(mockCreep);

      expect(result).toBe(true);
    });
  });

  describe("DismantleAction", () => {
    it("should dismantle structure when in range", () => {
      const mockStructure = {
        id: "structure1" as Id<Structure>,
        pos: { x: 20, y: 20 }
      } as Structure;

      (Game.getObjectById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockStructure);
      (mockCreep.pos.getRangeTo as unknown as ReturnType<typeof vi.fn>).mockReturnValue(1);
      mockCreep.dismantle = vi.fn().mockReturnValue(OK);
      mockCreep.body = [{ type: WORK, hits: 100 }];

      const action = new DismantleAction(mockStructure.id);
      const result = action.action(mockCreep);

      expect(mockCreep.dismantle).toHaveBeenCalledWith(mockStructure);
      expect(result).toBe(false); // Continue dismantling
    });
  });

  describe("SignControllerAction", () => {
    it("should sign controller with text", () => {
      const mockController = {
        id: "controller1" as Id<StructureController>,
        pos: { x: 25, y: 25 }
      } as StructureController;

      (Game.getObjectById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockController);
      (mockCreep.pos.getRangeTo as unknown as ReturnType<typeof vi.fn>).mockReturnValue(1);
      mockCreep.signController = vi.fn().mockReturnValue(OK);

      const action = new SignControllerAction(mockController.id, "Test sign");
      const result = action.action(mockCreep);

      expect(mockCreep.signController).toHaveBeenCalledWith(mockController, "Test sign");
      expect(result).toBe(true);
    });
  });

  describe("RecycleAction", () => {
    it("should recycle creep at spawn", () => {
      const mockSpawn = {
        id: "spawn1" as Id<StructureSpawn>,
        pos: { x: 25, y: 25 },
        recycleCreep: vi.fn().mockReturnValue(OK)
      } as unknown as StructureSpawn;

      (Game.getObjectById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSpawn);
      (mockCreep.pos.getRangeTo as unknown as ReturnType<typeof vi.fn>).mockReturnValue(1);

      const action = new RecycleAction(mockSpawn.id);
      const result = action.action(mockCreep);

      expect(mockSpawn.recycleCreep).toHaveBeenCalledWith(mockCreep);
      expect(result).toBe(true);
    });
  });
});
