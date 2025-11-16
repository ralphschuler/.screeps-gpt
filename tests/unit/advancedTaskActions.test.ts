import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  TowerAttackAction,
  TowerHealAction,
  TowerRepairAction,
  BoostCreepAction,
  RunReactionAction,
  LinkTransferAction,
  GenerateSafeModeAction
} from "@runtime/tasks";

// Mock Game object
global.Game = {
  time: 1000,
  getObjectById: vi.fn()
} as unknown as Game;

describe("Advanced Task Actions", () => {
  let mockCreep: Creep;

  beforeEach(() => {
    mockCreep = {
      id: "creep1" as Id<Creep>,
      name: "TestCreep",
      pos: {
        getRangeTo: vi.fn().mockReturnValue(5)
      },
      moveTo: vi.fn()
    } as unknown as Creep;
  });

  describe("TowerAttackAction", () => {
    it("should attack target with tower", () => {
      const mockTower = {
        id: "tower1" as Id<StructureTower>,
        pos: { x: 25, y: 25 },
        attack: vi.fn().mockReturnValue(OK),
        store: {
          getUsedCapacity: vi.fn().mockReturnValue(500)
        }
      } as unknown as StructureTower;

      const mockTarget = {
        id: "hostile1" as Id<Creep>,
        pos: { x: 15, y: 15 }
      } as Creep;

      (Game.getObjectById as any)
        .mockReturnValueOnce(mockTower)
        .mockReturnValueOnce(mockTarget);

      const action = new TowerAttackAction(mockTower.id, mockTarget.id);
      const result = action.action(mockCreep);

      expect(mockTower.attack).toHaveBeenCalledWith(mockTarget);
      expect(result).toBe(false); // Continue attacking
    });

    it("should complete when tower is out of energy", () => {
      const mockTower = {
        id: "tower1" as Id<StructureTower>,
        pos: { x: 25, y: 25 },
        attack: vi.fn().mockReturnValue(OK),
        store: {
          getUsedCapacity: vi.fn().mockReturnValue(0)
        }
      } as unknown as StructureTower;

      const mockTarget = {
        id: "hostile1" as Id<Creep>,
        pos: { x: 15, y: 15 }
      } as Creep;

      (Game.getObjectById as any)
        .mockReturnValueOnce(mockTower)
        .mockReturnValueOnce(mockTarget);

      const action = new TowerAttackAction(mockTower.id, mockTarget.id);
      const result = action.action(mockCreep);

      expect(result).toBe(true);
    });
  });

  describe("TowerHealAction", () => {
    it("should heal creep with tower", () => {
      const mockTower = {
        id: "tower1" as Id<StructureTower>,
        pos: { x: 25, y: 25 },
        heal: vi.fn().mockReturnValue(OK)
      } as unknown as StructureTower;

      const mockTarget = {
        id: "friend1" as Id<Creep>,
        pos: { x: 15, y: 15 },
        hits: 50,
        hitsMax: 100
      } as Creep;

      (Game.getObjectById as any)
        .mockReturnValueOnce(mockTower)
        .mockReturnValueOnce(mockTarget);

      const action = new TowerHealAction(mockTower.id, mockTarget.id);
      const result = action.action(mockCreep);

      expect(mockTower.heal).toHaveBeenCalledWith(mockTarget);
      expect(result).toBe(false); // Continue healing
    });

    it("should complete when target is fully healed", () => {
      const mockTower = {
        id: "tower1" as Id<StructureTower>,
        pos: { x: 25, y: 25 },
        heal: vi.fn().mockReturnValue(OK)
      } as unknown as StructureTower;

      const mockTarget = {
        id: "friend1" as Id<Creep>,
        pos: { x: 15, y: 15 },
        hits: 100,
        hitsMax: 100
      } as Creep;

      (Game.getObjectById as any)
        .mockReturnValueOnce(mockTower)
        .mockReturnValueOnce(mockTarget);

      const action = new TowerHealAction(mockTower.id, mockTarget.id);
      const result = action.action(mockCreep);

      expect(result).toBe(true);
    });
  });

  describe("TowerRepairAction", () => {
    it("should repair structure with tower", () => {
      const mockTower = {
        id: "tower1" as Id<StructureTower>,
        pos: { x: 25, y: 25 },
        repair: vi.fn().mockReturnValue(OK)
      } as unknown as StructureTower;

      const mockStructure = {
        id: "road1" as Id<Structure>,
        pos: { x: 15, y: 15 },
        hits: 500,
        hitsMax: 1000
      } as Structure;

      (Game.getObjectById as any)
        .mockReturnValueOnce(mockTower)
        .mockReturnValueOnce(mockStructure);

      const action = new TowerRepairAction(mockTower.id, mockStructure.id);
      const result = action.action(mockCreep);

      expect(mockTower.repair).toHaveBeenCalledWith(mockStructure);
      expect(result).toBe(false); // Continue repairing
    });
  });

  describe("BoostCreepAction", () => {
    it("should boost creep at lab when in range", () => {
      const mockLab = {
        id: "lab1" as Id<StructureLab>,
        pos: { x: 25, y: 25 },
        boostCreep: vi.fn().mockReturnValue(OK)
      } as unknown as StructureLab;

      (Game.getObjectById as any).mockReturnValue(mockLab);
      (mockCreep.pos.getRangeTo as any).mockReturnValue(1);

      const action = new BoostCreepAction(mockLab.id, "UO" as MineralBoostConstant);
      const result = action.action(mockCreep);

      expect(mockLab.boostCreep).toHaveBeenCalledWith(mockCreep);
      expect(result).toBe(true);
    });

    it("should move to lab when not in range", () => {
      const mockLab = {
        id: "lab1" as Id<StructureLab>,
        pos: { x: 25, y: 25 },
        boostCreep: vi.fn().mockReturnValue(ERR_NOT_IN_RANGE)
      } as unknown as StructureLab;

      (Game.getObjectById as any).mockReturnValue(mockLab);
      (mockCreep.pos.getRangeTo as any).mockReturnValue(5);

      const action = new BoostCreepAction(mockLab.id, "UO" as MineralBoostConstant);
      const result = action.action(mockCreep);

      expect(mockCreep.moveTo).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe("RunReactionAction", () => {
    it("should run reaction at lab", () => {
      const mockLab = {
        id: "lab1" as Id<StructureLab>,
        pos: { x: 25, y: 25 },
        runReaction: vi.fn().mockReturnValue(OK)
      } as unknown as StructureLab;

      const mockLab1 = {
        id: "lab2" as Id<StructureLab>
      } as StructureLab;

      const mockLab2 = {
        id: "lab3" as Id<StructureLab>
      } as StructureLab;

      (Game.getObjectById as any)
        .mockReturnValueOnce(mockLab)
        .mockReturnValueOnce(mockLab1)
        .mockReturnValueOnce(mockLab2);

      const action = new RunReactionAction(mockLab.id, mockLab1.id, mockLab2.id);
      const result = action.action(mockCreep);

      expect(mockLab.runReaction).toHaveBeenCalledWith(mockLab1, mockLab2);
      expect(result).toBe(false); // Continue running reaction
    });

    it("should complete when reaction fails", () => {
      const mockLab = {
        id: "lab1" as Id<StructureLab>,
        pos: { x: 25, y: 25 },
        runReaction: vi.fn().mockReturnValue(ERR_NOT_ENOUGH_RESOURCES)
      } as unknown as StructureLab;

      const mockLab1 = {
        id: "lab2" as Id<StructureLab>
      } as StructureLab;

      const mockLab2 = {
        id: "lab3" as Id<StructureLab>
      } as StructureLab;

      (Game.getObjectById as any)
        .mockReturnValueOnce(mockLab)
        .mockReturnValueOnce(mockLab1)
        .mockReturnValueOnce(mockLab2);

      const action = new RunReactionAction(mockLab.id, mockLab1.id, mockLab2.id);
      const result = action.action(mockCreep);

      expect(result).toBe(true);
    });
  });

  describe("LinkTransferAction", () => {
    it("should transfer energy between links", () => {
      const mockSourceLink = {
        id: "link1" as Id<StructureLink>,
        pos: { x: 10, y: 10 },
        store: {
          getUsedCapacity: vi.fn().mockReturnValue(400)
        },
        transferEnergy: vi.fn().mockReturnValue(OK)
      } as unknown as StructureLink;

      const mockTargetLink = {
        id: "link2" as Id<StructureLink>,
        pos: { x: 20, y: 20 },
        store: {
          getFreeCapacity: vi.fn().mockReturnValue(400)
        }
      } as unknown as StructureLink;

      (Game.getObjectById as any)
        .mockReturnValueOnce(mockSourceLink)
        .mockReturnValueOnce(mockTargetLink);

      const action = new LinkTransferAction(mockSourceLink.id, mockTargetLink.id);
      const result = action.action(mockCreep);

      expect(mockSourceLink.transferEnergy).toHaveBeenCalledWith(mockTargetLink, 400);
      expect(result).toBe(true);
    });

    it("should complete when source is empty", () => {
      const mockSourceLink = {
        id: "link1" as Id<StructureLink>,
        pos: { x: 10, y: 10 },
        store: {
          getUsedCapacity: vi.fn().mockReturnValue(0)
        }
      } as unknown as StructureLink;

      const mockTargetLink = {
        id: "link2" as Id<StructureLink>,
        pos: { x: 20, y: 20 },
        store: {
          getFreeCapacity: vi.fn().mockReturnValue(400)
        }
      } as unknown as StructureLink;

      (Game.getObjectById as any)
        .mockReturnValueOnce(mockSourceLink)
        .mockReturnValueOnce(mockTargetLink);

      const action = new LinkTransferAction(mockSourceLink.id, mockTargetLink.id);
      const result = action.action(mockCreep);

      expect(result).toBe(true);
    });
  });

  describe("GenerateSafeModeAction", () => {
    it("should generate safe mode at controller when in range", () => {
      const mockController = {
        id: "controller1" as Id<StructureController>,
        pos: { x: 25, y: 25 }
      } as StructureController;

      (Game.getObjectById as any).mockReturnValue(mockController);
      (mockCreep.pos.getRangeTo as any).mockReturnValue(1);
      mockCreep.generateSafeMode = vi.fn().mockReturnValue(OK);

      const action = new GenerateSafeModeAction(mockController.id);
      const result = action.action(mockCreep);

      expect(mockCreep.generateSafeMode).toHaveBeenCalledWith(mockController);
      expect(result).toBe(true);
    });

    it("should move to controller when not in range", () => {
      const mockController = {
        id: "controller1" as Id<StructureController>,
        pos: { x: 25, y: 25 }
      } as StructureController;

      (Game.getObjectById as any).mockReturnValue(mockController);
      (mockCreep.pos.getRangeTo as any).mockReturnValue(5);
      mockCreep.generateSafeMode = vi.fn().mockReturnValue(ERR_NOT_IN_RANGE);

      const action = new GenerateSafeModeAction(mockController.id);
      const result = action.action(mockCreep);

      expect(mockCreep.moveTo).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });
});
