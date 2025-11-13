import { describe, expect, it, vi, beforeEach } from "vitest";
import { WallUpgradeManager, DEFAULT_WALL_UPGRADE_STAGES } from "@runtime/defense/WallUpgradeManager";
import type { RoomLike } from "@runtime/types/GameContext";

describe("WallUpgradeManager", () => {
  let wallUpgradeManager: WallUpgradeManager;

  beforeEach(() => {
    wallUpgradeManager = new WallUpgradeManager();
  });

  describe("Stage configuration", () => {
    it("should use default stages when no stages provided", () => {
      const manager = new WallUpgradeManager();
      expect(manager).toBeDefined();
    });

    it("should accept custom stages", () => {
      const customStages = [
        { controllerLevel: 2, targetHits: 5_000, repairThreshold: 0.5 },
        { controllerLevel: 4, targetHits: 50_000, repairThreshold: 0.7 }
      ];
      const manager = new WallUpgradeManager(customStages);
      expect(manager).toBeDefined();
    });

    it("should have 7 default stages from RCL 2 to RCL 8", () => {
      expect(DEFAULT_WALL_UPGRADE_STAGES).toHaveLength(7);
      expect(DEFAULT_WALL_UPGRADE_STAGES[0].controllerLevel).toBe(2);
      expect(DEFAULT_WALL_UPGRADE_STAGES[6].controllerLevel).toBe(8);
    });
  });

  describe("getTargetHits", () => {
    it("should return 0 for room with no controller", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: null,
        find: vi.fn()
      };

      const targetHits = wallUpgradeManager.getTargetHits(mockRoom);
      expect(targetHits).toBe(0);
    });

    it("should return 0 for RCL 1 (below minimum stage)", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: {
          level: 1
        } as StructureController,
        find: vi.fn()
      };

      const targetHits = wallUpgradeManager.getTargetHits(mockRoom);
      expect(targetHits).toBe(0);
    });

    it("should return 10,000 hits for RCL 2", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: {
          level: 2
        } as StructureController,
        find: vi.fn()
      };

      const targetHits = wallUpgradeManager.getTargetHits(mockRoom);
      expect(targetHits).toBe(10_000);
    });

    it("should return 100,000 hits for RCL 4", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: {
          level: 4
        } as StructureController,
        find: vi.fn()
      };

      const targetHits = wallUpgradeManager.getTargetHits(mockRoom);
      expect(targetHits).toBe(100_000);
    });

    it("should return 10,000,000 hits for RCL 8", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: {
          level: 8
        } as StructureController,
        find: vi.fn()
      };

      const targetHits = wallUpgradeManager.getTargetHits(mockRoom);
      expect(targetHits).toBe(10_000_000);
    });

    it("should return highest applicable stage for intermediate levels", () => {
      // RCL 3 should use RCL 3 stage (50,000)
      const mockRoom3: RoomLike = {
        name: "W0N0",
        controller: { level: 3 } as StructureController,
        find: vi.fn()
      };
      expect(wallUpgradeManager.getTargetHits(mockRoom3)).toBe(50_000);

      // RCL 5 should use RCL 5 stage (500,000)
      const mockRoom5: RoomLike = {
        name: "W0N0",
        controller: { level: 5 } as StructureController,
        find: vi.fn()
      };
      expect(wallUpgradeManager.getTargetHits(mockRoom5)).toBe(500_000);
    });
  });

  describe("getCurrentStage", () => {
    it("should return null for room with no controller", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: null,
        find: vi.fn()
      };

      const stage = wallUpgradeManager.getCurrentStage(mockRoom);
      expect(stage).toBeNull();
    });

    it("should return null for RCL 1", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: { level: 1 } as StructureController,
        find: vi.fn()
      };

      const stage = wallUpgradeManager.getCurrentStage(mockRoom);
      expect(stage).toBeNull();
    });

    it("should return correct stage for RCL 4", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        find: vi.fn()
      };

      const stage = wallUpgradeManager.getCurrentStage(mockRoom);
      expect(stage).not.toBeNull();
      expect(stage?.controllerLevel).toBe(4);
      expect(stage?.targetHits).toBe(100_000);
    });
  });

  describe("allWallsUpgraded", () => {
    it("should return true when no walls exist", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        find: vi.fn(() => [])
      };

      const result = wallUpgradeManager.allWallsUpgraded(mockRoom);
      expect(result).toBe(true);
    });

    it("should return true when all walls meet target", () => {
      const wall1: StructureWall = {
        id: "wall1" as Id<StructureWall>,
        structureType: STRUCTURE_WALL,
        hits: 100_000,
        hitsMax: 300_000_000
      } as StructureWall;

      const rampart1: StructureRampart = {
        id: "rampart1" as Id<StructureRampart>,
        structureType: STRUCTURE_RAMPART,
        hits: 150_000,
        hitsMax: 300_000_000
      } as StructureRampart;

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        find: vi.fn(() => [wall1, rampart1])
      };

      const result = wallUpgradeManager.allWallsUpgraded(mockRoom);
      expect(result).toBe(true);
    });

    it("should return false when at least one wall is below target", () => {
      const wall1: StructureWall = {
        id: "wall1" as Id<StructureWall>,
        structureType: STRUCTURE_WALL,
        hits: 100_000,
        hitsMax: 300_000_000
      } as StructureWall;

      const wall2: StructureWall = {
        id: "wall2" as Id<StructureWall>,
        structureType: STRUCTURE_WALL,
        hits: 50_000, // Below target for RCL 4 (100,000)
        hitsMax: 300_000_000
      } as StructureWall;

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        find: vi.fn(() => [wall1, wall2])
      };

      const result = wallUpgradeManager.allWallsUpgraded(mockRoom);
      expect(result).toBe(false);
    });

    it("should return true when target is 0 (no applicable stage)", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: { level: 1 } as StructureController,
        find: vi.fn(() => [])
      };

      const result = wallUpgradeManager.allWallsUpgraded(mockRoom);
      expect(result).toBe(true);
    });
  });

  describe("getWeakestWall", () => {
    it("should return null when no walls exist", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        find: vi.fn(() => [])
      };

      const weakest = wallUpgradeManager.getWeakestWall(mockRoom);
      expect(weakest).toBeNull();
    });

    it("should return null when all walls meet or exceed target", () => {
      const wall1: StructureWall = {
        id: "wall1" as Id<StructureWall>,
        structureType: STRUCTURE_WALL,
        hits: 100_000, // Exactly at target for RCL 4
        hitsMax: 300_000_000
      } as StructureWall;

      const wall2: StructureWall = {
        id: "wall2" as Id<StructureWall>,
        structureType: STRUCTURE_WALL,
        hits: 150_000, // Above target
        hitsMax: 300_000_000
      } as StructureWall;

      const allWalls = [wall1, wall2];

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        find: vi.fn((type: FindConstant, opts?: FilterOptions<FIND_STRUCTURES>) => {
          if (type === FIND_STRUCTURES && opts?.filter) {
            return allWalls.filter(opts.filter as (s: Structure) => boolean);
          }
          return allWalls;
        })
      };

      const weakest = wallUpgradeManager.getWeakestWall(mockRoom);
      expect(weakest).toBeNull();
    });

    it("should return the weakest wall below target", () => {
      const wall1: StructureWall = {
        id: "wall1" as Id<StructureWall>,
        structureType: STRUCTURE_WALL,
        hits: 80_000,
        hitsMax: 300_000_000
      } as StructureWall;

      const wall2: StructureWall = {
        id: "wall2" as Id<StructureWall>,
        structureType: STRUCTURE_WALL,
        hits: 30_000, // Weakest
        hitsMax: 300_000_000
      } as StructureWall;

      const rampart1: StructureRampart = {
        id: "rampart1" as Id<StructureRampart>,
        structureType: STRUCTURE_RAMPART,
        hits: 60_000,
        hitsMax: 300_000_000
      } as StructureRampart;

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        find: vi.fn(() => [wall1, wall2, rampart1])
      };

      const weakest = wallUpgradeManager.getWeakestWall(mockRoom);
      expect(weakest).toBe(wall2);
      expect(weakest?.hits).toBe(30_000);
    });

    it("should return null when target is 0", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: { level: 1 } as StructureController,
        find: vi.fn(() => [])
      };

      const weakest = wallUpgradeManager.getWeakestWall(mockRoom);
      expect(weakest).toBeNull();
    });
  });

  describe("getWallsNeedingRepair", () => {
    it("should return empty array when no walls need repair", () => {
      const wall1: StructureWall = {
        id: "wall1" as Id<StructureWall>,
        structureType: STRUCTURE_WALL,
        hits: 100_000, // At target for RCL 4
        hitsMax: 300_000_000
      } as StructureWall;

      const wall2: StructureWall = {
        id: "wall2" as Id<StructureWall>,
        structureType: STRUCTURE_WALL,
        hits: 200_000, // Above target
        hitsMax: 300_000_000
      } as StructureWall;

      const allWalls = [wall1, wall2];

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        find: vi.fn((type: FindConstant, opts?: FilterOptions<FIND_STRUCTURES>) => {
          if (type === FIND_STRUCTURES && opts?.filter) {
            return allWalls.filter(opts.filter as (s: Structure) => boolean);
          }
          return allWalls;
        })
      };

      const walls = wallUpgradeManager.getWallsNeedingRepair(mockRoom);
      expect(walls).toHaveLength(0);
    });

    it("should return walls below target sorted by hits", () => {
      const wall1: StructureWall = {
        id: "wall1" as Id<StructureWall>,
        structureType: STRUCTURE_WALL,
        hits: 80_000,
        hitsMax: 300_000_000
      } as StructureWall;

      const wall2: StructureWall = {
        id: "wall2" as Id<StructureWall>,
        structureType: STRUCTURE_WALL,
        hits: 30_000,
        hitsMax: 300_000_000
      } as StructureWall;

      const wall3: StructureWall = {
        id: "wall3" as Id<StructureWall>,
        structureType: STRUCTURE_WALL,
        hits: 50_000,
        hitsMax: 300_000_000
      } as StructureWall;

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        find: vi.fn(() => [wall1, wall2, wall3])
      };

      const walls = wallUpgradeManager.getWallsNeedingRepair(mockRoom);
      expect(walls).toHaveLength(3);
      expect(walls[0].hits).toBe(30_000); // Weakest first
      expect(walls[1].hits).toBe(50_000);
      expect(walls[2].hits).toBe(80_000);
    });

    it("should return empty array when target is 0", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: { level: 1 } as StructureController,
        find: vi.fn(() => [])
      };

      const walls = wallUpgradeManager.getWallsNeedingRepair(mockRoom);
      expect(walls).toHaveLength(0);
    });
  });

  describe("shouldRepairStructure", () => {
    it("should return false for non-wall structures", () => {
      const spawn: StructureSpawn = {
        id: "spawn1" as Id<StructureSpawn>,
        structureType: STRUCTURE_SPAWN,
        hits: 1000,
        hitsMax: 5000
      } as StructureSpawn;

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        find: vi.fn()
      };

      const result = wallUpgradeManager.shouldRepairStructure(spawn, mockRoom);
      expect(result).toBe(false);
    });

    it("should return true for wall below target", () => {
      const wall: StructureWall = {
        id: "wall1" as Id<StructureWall>,
        structureType: STRUCTURE_WALL,
        hits: 50_000,
        hitsMax: 300_000_000
      } as StructureWall;

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        find: vi.fn()
      };

      const result = wallUpgradeManager.shouldRepairStructure(wall, mockRoom);
      expect(result).toBe(true);
    });

    it("should return false for wall at or above target", () => {
      const wall: StructureWall = {
        id: "wall1" as Id<StructureWall>,
        structureType: STRUCTURE_WALL,
        hits: 100_000,
        hitsMax: 300_000_000
      } as StructureWall;

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        find: vi.fn()
      };

      const result = wallUpgradeManager.shouldRepairStructure(wall, mockRoom);
      expect(result).toBe(false);
    });

    it("should return true for rampart below target", () => {
      const rampart: StructureRampart = {
        id: "rampart1" as Id<StructureRampart>,
        structureType: STRUCTURE_RAMPART,
        hits: 75_000,
        hitsMax: 300_000_000
      } as StructureRampart;

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        find: vi.fn()
      };

      const result = wallUpgradeManager.shouldRepairStructure(rampart, mockRoom);
      expect(result).toBe(true);
    });
  });

  describe("getUpgradeProgress", () => {
    it("should return progress with no walls", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        find: vi.fn(() => [])
      };

      const progress = wallUpgradeManager.getUpgradeProgress(mockRoom);
      expect(progress.targetHits).toBe(100_000);
      expect(progress.wallCount).toBe(0);
      expect(progress.minHits).toBe(0);
      expect(progress.maxHits).toBe(0);
      expect(progress.averageHits).toBe(0);
      expect(progress.upgradeComplete).toBe(true);
    });

    it("should calculate progress for multiple walls", () => {
      const wall1: StructureWall = {
        id: "wall1" as Id<StructureWall>,
        structureType: STRUCTURE_WALL,
        hits: 30_000,
        hitsMax: 300_000_000
      } as StructureWall;

      const wall2: StructureWall = {
        id: "wall2" as Id<StructureWall>,
        structureType: STRUCTURE_WALL,
        hits: 70_000,
        hitsMax: 300_000_000
      } as StructureWall;

      const wall3: StructureWall = {
        id: "wall3" as Id<StructureWall>,
        structureType: STRUCTURE_WALL,
        hits: 50_000,
        hitsMax: 300_000_000
      } as StructureWall;

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        find: vi.fn(() => [wall1, wall2, wall3])
      };

      const progress = wallUpgradeManager.getUpgradeProgress(mockRoom);
      expect(progress.targetHits).toBe(100_000);
      expect(progress.wallCount).toBe(3);
      expect(progress.minHits).toBe(30_000);
      expect(progress.maxHits).toBe(70_000);
      expect(progress.averageHits).toBe(50_000);
      expect(progress.upgradeComplete).toBe(false);
    });

    it("should mark upgrade as complete when all walls meet target", () => {
      const wall1: StructureWall = {
        id: "wall1" as Id<StructureWall>,
        structureType: STRUCTURE_WALL,
        hits: 100_000,
        hitsMax: 300_000_000
      } as StructureWall;

      const wall2: StructureWall = {
        id: "wall2" as Id<StructureWall>,
        structureType: STRUCTURE_WALL,
        hits: 150_000,
        hitsMax: 300_000_000
      } as StructureWall;

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        find: vi.fn(() => [wall1, wall2])
      };

      const progress = wallUpgradeManager.getUpgradeProgress(mockRoom);
      expect(progress.upgradeComplete).toBe(true);
      expect(progress.minHits).toBe(100_000);
    });
  });

  describe("RCL progression scenarios", () => {
    it("should increase target as RCL increases", () => {
      const mockRoomRCL3: RoomLike = {
        name: "W0N0",
        controller: { level: 3 } as StructureController,
        find: vi.fn()
      };

      const mockRoomRCL5: RoomLike = {
        name: "W0N0",
        controller: { level: 5 } as StructureController,
        find: vi.fn()
      };

      const mockRoomRCL7: RoomLike = {
        name: "W0N0",
        controller: { level: 7 } as StructureController,
        find: vi.fn()
      };

      const targetRCL3 = wallUpgradeManager.getTargetHits(mockRoomRCL3);
      const targetRCL5 = wallUpgradeManager.getTargetHits(mockRoomRCL5);
      const targetRCL7 = wallUpgradeManager.getTargetHits(mockRoomRCL7);

      expect(targetRCL3).toBe(50_000);
      expect(targetRCL5).toBe(500_000);
      expect(targetRCL7).toBe(3_000_000);
      expect(targetRCL5).toBeGreaterThan(targetRCL3);
      expect(targetRCL7).toBeGreaterThan(targetRCL5);
    });

    it("should handle walls at different stages correctly", () => {
      // Walls at RCL 3 target
      const wall1: StructureWall = {
        id: "wall1" as Id<StructureWall>,
        structureType: STRUCTURE_WALL,
        hits: 50_000,
        hitsMax: 300_000_000
      } as StructureWall;

      const mockRoomRCL3: RoomLike = {
        name: "W0N0",
        controller: { level: 3 } as StructureController,
        find: vi.fn(() => [wall1])
      };

      const mockRoomRCL4: RoomLike = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        find: vi.fn(() => [wall1])
      };

      // At RCL 3, wall meets target
      expect(wallUpgradeManager.allWallsUpgraded(mockRoomRCL3)).toBe(true);

      // At RCL 4, same wall now needs upgrade
      expect(wallUpgradeManager.allWallsUpgraded(mockRoomRCL4)).toBe(false);
      expect(wallUpgradeManager.getWeakestWall(mockRoomRCL4)).toBe(wall1);
    });
  });
});
