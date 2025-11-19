import type { RoomLike } from "@runtime/types/GameContext";
import { profile } from "@ralphschuler/screeps-profiler";

/**
 * Defines a wall/rampart upgrade stage tied to controller level
 */
export interface WallUpgradeStage {
  /** Minimum controller level required for this stage */
  controllerLevel: number;
  /** Target hit points for walls/ramparts at this stage */
  targetHits: number;
  /**
   * Repair threshold percentage (0.0-1.0) - Reserved for future use to determine
   * when to start repairs (e.g., repair when hits < targetHits * repairThreshold).
   * Currently not used; repairs begin whenever hits < targetHits.
   */
  repairThreshold: number;
}

/**
 * Default wall upgrade stages from RCL 2 to RCL 8
 * Provides gradual fortification progression tied to controller level
 */
export const DEFAULT_WALL_UPGRADE_STAGES: WallUpgradeStage[] = [
  { controllerLevel: 2, targetHits: 10_000, repairThreshold: 0.5 },
  { controllerLevel: 3, targetHits: 50_000, repairThreshold: 0.6 },
  { controllerLevel: 4, targetHits: 100_000, repairThreshold: 0.7 },
  { controllerLevel: 5, targetHits: 500_000, repairThreshold: 0.75 },
  { controllerLevel: 6, targetHits: 1_000_000, repairThreshold: 0.8 },
  { controllerLevel: 7, targetHits: 3_000_000, repairThreshold: 0.85 },
  { controllerLevel: 8, targetHits: 10_000_000, repairThreshold: 0.9 }
];

/**
 * Manages staged wall and rampart upgrades based on controller level.
 * Ensures even distribution of defensive structure hit points across progression stages.
 *
 * Key features:
 * - Ties wall/rampart hit point targets to room controller level
 * - Prevents over-repair of individual structures
 * - Ensures all walls reach current stage threshold before advancing
 * - Provides utilities for identifying weakest structures needing upgrades
 */
@profile
export class WallUpgradeManager {
  private readonly stages: WallUpgradeStage[];

  /**
   * Create a new WallUpgradeManager with custom or default stages
   * @param stages - Array of upgrade stages (uses defaults if not provided)
   */
  public constructor(stages: WallUpgradeStage[] = DEFAULT_WALL_UPGRADE_STAGES) {
    this.stages = [...stages].sort((a, b) => a.controllerLevel - b.controllerLevel);
  }

  /**
   * Get the target hit points for walls/ramparts based on current controller level
   * @param room - The room to calculate target hits for
   * @returns Target hit points for the current stage, or 0 if no stage applies
   */
  public getTargetHits(room: RoomLike): number {
    const rcl = room.controller?.level ?? 0;

    // Find the highest stage that doesn't exceed current RCL
    const applicableStages = this.stages.filter(s => s.controllerLevel <= rcl);
    if (applicableStages.length === 0) {
      return 0;
    }

    // Return the target hits for the highest applicable stage
    const currentStage = applicableStages[applicableStages.length - 1];
    return currentStage.targetHits;
  }

  /**
   * Get the current upgrade stage for a room
   * @param room - The room to get the stage for
   * @returns The current stage, or null if no stage applies
   */
  public getCurrentStage(room: RoomLike): WallUpgradeStage | null {
    const rcl = room.controller?.level ?? 0;

    const applicableStages = this.stages.filter(s => s.controllerLevel <= rcl);
    if (applicableStages.length === 0) {
      return null;
    }

    return applicableStages[applicableStages.length - 1];
  }

  /**
   * Check if all walls and ramparts in a room meet the current stage threshold
   * @param room - The room to check
   * @returns True if all defensive structures meet or exceed target hits
   */
  public allWallsUpgraded(room: RoomLike): boolean {
    const targetHits = this.getTargetHits(room);
    if (targetHits === 0) {
      return true; // No stage applies, consider it complete
    }

    const walls = room.find(FIND_STRUCTURES, {
      filter: s =>
        (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) &&
        "hits" in s &&
        typeof s.hits === "number"
    }) as (StructureWall | StructureRampart)[];

    // If no walls exist, consider it complete
    if (walls.length === 0) {
      return true;
    }

    // All walls must meet or exceed the target
    return walls.every(wall => wall.hits >= targetHits);
  }

  /**
   * Get the weakest wall or rampart that needs upgrading to the current stage
   * @param room - The room to search
   * @returns The weakest defensive structure below target hits, or null if all are upgraded
   */
  public getWeakestWall(room: RoomLike): StructureWall | StructureRampart | null {
    const targetHits = this.getTargetHits(room);
    if (targetHits === 0) {
      return null;
    }

    const walls = room.find(FIND_STRUCTURES, {
      filter: s =>
        (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) &&
        "hits" in s &&
        typeof s.hits === "number" &&
        s.hits < targetHits
    }) as (StructureWall | StructureRampart)[];

    if (walls.length === 0) {
      return null;
    }

    // Sort by hits (ascending) and return the weakest
    return walls.sort((a, b) => a.hits - b.hits)[0];
  }

  /**
   * Get all walls and ramparts that need repair based on the current stage
   * @param room - The room to search
   * @returns Array of defensive structures needing repair
   */
  public getWallsNeedingRepair(room: RoomLike): (StructureWall | StructureRampart)[] {
    const targetHits = this.getTargetHits(room);
    if (targetHits === 0) {
      return [];
    }

    const walls = room.find(FIND_STRUCTURES, {
      filter: s =>
        (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) &&
        "hits" in s &&
        typeof s.hits === "number" &&
        s.hits < targetHits
    }) as (StructureWall | StructureRampart)[];

    // Sort by hits (ascending) so weakest are first
    return walls.sort((a, b) => a.hits - b.hits);
  }

  /**
   * Check if a specific structure should be repaired based on current stage
   * @param structure - The structure to check
   * @param room - The room the structure is in
   * @returns True if the structure needs repair within current stage limits
   */
  public shouldRepairStructure(structure: Structure, room: RoomLike): boolean {
    // Only applies to walls and ramparts
    if (structure.structureType !== STRUCTURE_WALL && structure.structureType !== STRUCTURE_RAMPART) {
      return false;
    }

    if (!("hits" in structure) || typeof structure.hits !== "number") {
      return false;
    }

    const targetHits = this.getTargetHits(room);
    return structure.hits < targetHits;
  }

  /**
   * Get upgrade progress statistics for a room
   * @param room - The room to analyze
   * @returns Object with progress statistics
   */
  public getUpgradeProgress(room: RoomLike): {
    targetHits: number;
    minHits: number;
    maxHits: number;
    averageHits: number;
    wallCount: number;
    upgradeComplete: boolean;
  } {
    const targetHits = this.getTargetHits(room);
    const walls = room.find(FIND_STRUCTURES, {
      filter: s =>
        (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) &&
        "hits" in s &&
        typeof s.hits === "number"
    }) as (StructureWall | StructureRampart)[];

    if (walls.length === 0) {
      return {
        targetHits,
        minHits: 0,
        maxHits: 0,
        averageHits: 0,
        wallCount: 0,
        upgradeComplete: true
      };
    }

    const hits = walls.map(w => w.hits);
    const minHits = Math.min(...hits);
    const maxHits = Math.max(...hits);
    const averageHits = Math.floor(hits.reduce((sum, h) => sum + h, 0) / hits.length);
    const upgradeComplete = minHits >= targetHits;

    return {
      targetHits,
      minHits,
      maxHits,
      averageHits,
      wallCount: walls.length,
      upgradeComplete
    };
  }
}
