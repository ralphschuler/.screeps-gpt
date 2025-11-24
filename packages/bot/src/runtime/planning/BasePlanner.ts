import type { RoomLike } from "@runtime/types/GameContext";

interface RoomPosition {
  x: number;
  y: number;
}

interface StructurePlan {
  structureType: BuildableStructureConstant;
  pos: RoomPosition;
  rcl: number;
}

/**
 * Spawn placement scoring constants for findBestOpenSpace algorithm.
 * These values determine optimal spawn location in newly claimed rooms.
 */
const SPAWN_PLACEMENT = {
  /** Minimum distance from walls required for spawn placement (need room for extensions) */
  MIN_WALL_DISTANCE: 4,
  /** Weight factor for wall distance in scoring (higher = prefer more open areas) */
  WALL_DISTANCE_WEIGHT: 2,
  /** Maximum ideal distance to sources (beyond this, penalty applies) */
  MAX_IDEAL_SOURCE_DISTANCE: 20,
  /** Minimum ideal distance to sources (closer than this, penalty applies) */
  MIN_IDEAL_SOURCE_DISTANCE: 5,
  /** Penalty multiplier for being too far from sources */
  FAR_SOURCE_PENALTY: 0.5,
  /** Penalty multiplier for being too close to sources (stronger to ensure building space) */
  CLOSE_SOURCE_PENALTY: 2
} as const;

/**
 * Plans and manages automatic base building using a bunker layout pattern.
 * Based on the Screeps wiki automatic base building guide.
 */
export class BasePlanner {
  private readonly roomName: string;
  private anchor: RoomPosition | null = null;

  /**
   * Chess/checkerboard pattern layout centered around spawn
   * Offsets are relative to the anchor point (spawn position)
   * Structures are placed at even-sum coordinates (dx+dy is even)
   * This ensures all 8 adjacent tiles to spawn remain walkable for creeps
   * Covers RCL 1-5 for Phase 3 requirements
   */
  private readonly bunkerLayout: Array<{
    type: BuildableStructureConstant;
    dx: number;
    dy: number;
    rcl: number;
  }> = [
    // RCL 1: First spawn (anchor point) - critical for room integration
    { type: "spawn" as BuildableStructureConstant, dx: 0, dy: 0, rcl: 1 },

    // RCL 2: Extensions (5 total) - placed at distance 2 with even-sum coordinates
    { type: "extension" as BuildableStructureConstant, dx: 2, dy: 0, rcl: 2 },
    { type: "extension" as BuildableStructureConstant, dx: 0, dy: 2, rcl: 2 },
    { type: "extension" as BuildableStructureConstant, dx: -2, dy: 0, rcl: 2 },
    { type: "extension" as BuildableStructureConstant, dx: 0, dy: -2, rcl: 2 },
    { type: "extension" as BuildableStructureConstant, dx: 2, dy: 2, rcl: 2 },

    // RCL 2: Container
    { type: "container" as BuildableStructureConstant, dx: -2, dy: 2, rcl: 2 },

    // RCL 3: More extensions (10 total, 5 more)
    { type: "extension" as BuildableStructureConstant, dx: -2, dy: -2, rcl: 3 },
    { type: "extension" as BuildableStructureConstant, dx: 4, dy: 0, rcl: 3 },
    { type: "extension" as BuildableStructureConstant, dx: 0, dy: 4, rcl: 3 },
    { type: "extension" as BuildableStructureConstant, dx: -4, dy: 0, rcl: 3 },
    { type: "extension" as BuildableStructureConstant, dx: 0, dy: -4, rcl: 3 },

    // RCL 3: Tower
    { type: "tower" as BuildableStructureConstant, dx: 2, dy: -2, rcl: 3 },

    // RCL 4: Storage
    { type: "storage" as BuildableStructureConstant, dx: -4, dy: -4, rcl: 4 },

    // RCL 4: More extensions (20 total, 10 more)
    { type: "extension" as BuildableStructureConstant, dx: 4, dy: 2, rcl: 4 },
    { type: "extension" as BuildableStructureConstant, dx: 2, dy: 4, rcl: 4 },
    { type: "extension" as BuildableStructureConstant, dx: -4, dy: 2, rcl: 4 },
    { type: "extension" as BuildableStructureConstant, dx: -2, dy: 4, rcl: 4 },
    { type: "extension" as BuildableStructureConstant, dx: 4, dy: -2, rcl: 4 },
    { type: "extension" as BuildableStructureConstant, dx: 2, dy: -4, rcl: 4 },
    { type: "extension" as BuildableStructureConstant, dx: -4, dy: -2, rcl: 4 },
    { type: "extension" as BuildableStructureConstant, dx: -2, dy: -4, rcl: 4 },
    { type: "extension" as BuildableStructureConstant, dx: 4, dy: 4, rcl: 4 },
    { type: "extension" as BuildableStructureConstant, dx: -4, dy: 4, rcl: 4 },

    // RCL 5: Links (2 allowed)
    { type: "link" as BuildableStructureConstant, dx: 4, dy: -4, rcl: 5 },
    { type: "link" as BuildableStructureConstant, dx: -4, dy: 6, rcl: 5 },

    // RCL 5: More extensions (30 total, 10 more)
    { type: "extension" as BuildableStructureConstant, dx: 6, dy: 0, rcl: 5 },
    { type: "extension" as BuildableStructureConstant, dx: 0, dy: 6, rcl: 5 },
    { type: "extension" as BuildableStructureConstant, dx: -6, dy: 0, rcl: 5 },
    { type: "extension" as BuildableStructureConstant, dx: 0, dy: -6, rcl: 5 },
    { type: "extension" as BuildableStructureConstant, dx: 6, dy: 2, rcl: 5 },
    { type: "extension" as BuildableStructureConstant, dx: 2, dy: 6, rcl: 5 },
    { type: "extension" as BuildableStructureConstant, dx: -6, dy: 2, rcl: 5 },
    { type: "extension" as BuildableStructureConstant, dx: -2, dy: 6, rcl: 5 },
    { type: "extension" as BuildableStructureConstant, dx: 6, dy: -2, rcl: 5 },
    { type: "extension" as BuildableStructureConstant, dx: -2, dy: -6, rcl: 5 },

    // RCL 5: Second tower
    { type: "tower" as BuildableStructureConstant, dx: 4, dy: -2, rcl: 5 }
  ];

  public constructor(roomName: string) {
    this.roomName = roomName;
  }

  /**
   * Calculate the best anchor point for the bunker layout.
   * Uses a simplified approach: find the spawn position or use distance transform.
   */
  public calculateAnchor(room: RoomLike, terrain: RoomTerrain, findMySpawns: FindConstant): RoomPosition | null {
    if (this.anchor) {
      return this.anchor;
    }

    // Try to find existing spawn to use as anchor
    const spawns = room.find(findMySpawns) as StructureSpawn[];
    if (spawns.length > 0) {
      this.anchor = { x: spawns[0].pos.x, y: spawns[0].pos.y };
      return this.anchor;
    }

    // If no spawn, find best open space using simplified distance transform
    // Also consider proximity to energy sources for optimal spawn placement
    const bestPos = this.findBestOpenSpace(terrain, room);
    if (bestPos) {
      this.anchor = bestPos;
    }

    return this.anchor;
  }

  /**
   * Simplified distance transform to find open spaces.
   * Returns the position furthest from walls while considering source proximity.
   * For newly claimed rooms, this determines optimal spawn placement.
   */
  private findBestOpenSpace(terrain: RoomTerrain, room?: RoomLike, terrainWall: number = 1): RoomPosition | null {
    const distanceField: number[][] = [];

    // Initialize with walls (using terrainWall parameter for testability)
    for (let x = 0; x < 50; x++) {
      distanceField[x] = [];
      for (let y = 0; y < 50; y++) {
        const tile = terrain.get(x, y);
        distanceField[x][y] = tile === terrainWall ? 0 : 255;
      }
    }

    // Simple distance transform (one pass approximation)
    for (let x = 1; x < 49; x++) {
      for (let y = 1; y < 49; y++) {
        if (distanceField[x][y] > 0) {
          distanceField[x][y] = Math.min(
            distanceField[x][y],
            distanceField[x - 1][y] + 1,
            distanceField[x][y - 1] + 1,
            distanceField[x - 1][y - 1] + 1
          );
        }
      }
    }

    // Get source positions if room is available for proximity scoring
    const sources = room ? (room.find(FIND_SOURCES) as Array<{ pos: { x: number; y: number } }>) : [];

    // Find position with best combined score:
    // - High distance from walls (for building space)
    // - Reasonable proximity to sources (for energy access)
    let bestScore = -Infinity;
    let bestPos: RoomPosition | null = null;

    for (let x = 10; x < 40; x++) {
      for (let y = 10; y < 40; y++) {
        const wallDistance = distanceField[x][y];

        // Skip positions too close to walls
        if (wallDistance < SPAWN_PLACEMENT.MIN_WALL_DISTANCE) {
          continue;
        }

        // Calculate score: balance wall distance and source proximity
        let score = wallDistance * SPAWN_PLACEMENT.WALL_DISTANCE_WEIGHT;

        if (sources.length > 0) {
          // Calculate average distance to sources (lower is better)
          let totalSourceDist = 0;
          for (const source of sources) {
            const dx = Math.abs(x - source.pos.x);
            const dy = Math.abs(y - source.pos.y);
            totalSourceDist += Math.max(dx, dy); // Chebyshev distance
          }
          const avgSourceDist = totalSourceDist / sources.length;

          // Penalty for being too far or too close to sources
          // Ideal distance is between MIN_IDEAL and MAX_IDEAL
          if (avgSourceDist > SPAWN_PLACEMENT.MAX_IDEAL_SOURCE_DISTANCE) {
            score -= (avgSourceDist - SPAWN_PLACEMENT.MAX_IDEAL_SOURCE_DISTANCE) * SPAWN_PLACEMENT.FAR_SOURCE_PENALTY;
          } else if (avgSourceDist < SPAWN_PLACEMENT.MIN_IDEAL_SOURCE_DISTANCE) {
            score -=
              (SPAWN_PLACEMENT.MIN_IDEAL_SOURCE_DISTANCE - avgSourceDist) * SPAWN_PLACEMENT.CLOSE_SOURCE_PENALTY;
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestPos = { x, y };
        }
      }
    }

    return bestPos;
  }

  /**
   * Get all planned structures for the current RCL
   */
  public getPlanForRCL(rcl: number, anchor: RoomPosition): StructurePlan[] {
    const plans: StructurePlan[] = [];

    for (const layout of this.bunkerLayout) {
      if (layout.rcl <= rcl) {
        plans.push({
          structureType: layout.type,
          pos: {
            x: anchor.x + layout.dx,
            y: anchor.y + layout.dy
          },
          rcl: layout.rcl
        });
      }
    }

    return plans;
  }

  /**
   * Filter out positions that are invalid (walls, edges)
   */
  private isValidPosition(x: number, y: number, terrain: RoomTerrain, terrainWall: number = 1): boolean {
    if (x < 2 || x > 47 || y < 2 || y > 47) {
      return false;
    }
    return terrain.get(x, y) !== terrainWall;
  }

  /**
   * Get structures that should be built at the current RCL
   * but don't exist yet
   */
  public getMissingStructures(
    room: RoomLike,
    terrain: RoomTerrain,
    currentRCL: number,
    findMySpawns: FindConstant,
    findStructures: FindConstant,
    findConstructionSites: FindConstant,
    terrainWall: number = 1
  ): Array<{ type: BuildableStructureConstant; pos: RoomPosition }> {
    const anchor = this.calculateAnchor(room, terrain, findMySpawns);
    if (!anchor) {
      return [];
    }

    const planned = this.getPlanForRCL(currentRCL, anchor);
    const missing: Array<{ type: BuildableStructureConstant; pos: RoomPosition }> = [];

    // Get existing structures and construction sites
    const existingStructures = room.find(findStructures) as Structure[];
    const constructionSites = room.find(findConstructionSites) as ConstructionSite[];

    for (const plan of planned) {
      if (!this.isValidPosition(plan.pos.x, plan.pos.y, terrain, terrainWall)) {
        continue;
      }

      // Check if structure already exists
      const exists = existingStructures.some(
        s => s.pos.x === plan.pos.x && s.pos.y === plan.pos.y && s.structureType === plan.structureType
      );

      // Check if construction site already exists
      const siteExists = constructionSites.some(
        s => s.pos.x === plan.pos.x && s.pos.y === plan.pos.y && s.structureType === plan.structureType
      );

      if (!exists && !siteExists) {
        missing.push({
          type: plan.structureType,
          pos: plan.pos
        });
      }
    }

    return missing;
  }
}
