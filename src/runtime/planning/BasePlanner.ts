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
 * Plans and manages automatic base building using a bunker layout pattern.
 * Based on the Screeps wiki automatic base building guide.
 */
export class BasePlanner {
  private readonly roomName: string;
  private anchor: RoomPosition | null = null;

  /**
   * Simple bunker layout centered around spawn
   * Offsets are relative to the anchor point (spawn position)
   */
  private readonly bunkerLayout: Array<{
    type: BuildableStructureConstant;
    dx: number;
    dy: number;
    rcl: number;
  }> = [
    // RCL 2: Extensions (5 total)
    { type: "extension" as BuildableStructureConstant, dx: 1, dy: 0, rcl: 2 },
    { type: "extension" as BuildableStructureConstant, dx: -1, dy: 0, rcl: 2 },
    { type: "extension" as BuildableStructureConstant, dx: 0, dy: 1, rcl: 2 },
    { type: "extension" as BuildableStructureConstant, dx: 0, dy: -1, rcl: 2 },
    { type: "extension" as BuildableStructureConstant, dx: 1, dy: 1, rcl: 2 },

    // RCL 2: Container near sources (placed separately)
    { type: "container" as BuildableStructureConstant, dx: 2, dy: 0, rcl: 2 },

    // RCL 3: More extensions (10 total, 5 more)
    { type: "extension" as BuildableStructureConstant, dx: -1, dy: 1, rcl: 3 },
    { type: "extension" as BuildableStructureConstant, dx: 1, dy: -1, rcl: 3 },
    { type: "extension" as BuildableStructureConstant, dx: -1, dy: -1, rcl: 3 },
    { type: "extension" as BuildableStructureConstant, dx: 2, dy: 1, rcl: 3 },
    { type: "extension" as BuildableStructureConstant, dx: 2, dy: -1, rcl: 3 },

    // RCL 3: Tower
    { type: "tower" as BuildableStructureConstant, dx: 0, dy: 2, rcl: 3 },

    // RCL 4: Storage
    { type: "storage" as BuildableStructureConstant, dx: -2, dy: 0, rcl: 4 },

    // RCL 4: More extensions (20 total, 10 more)
    { type: "extension" as BuildableStructureConstant, dx: -2, dy: 1, rcl: 4 },
    { type: "extension" as BuildableStructureConstant, dx: -2, dy: -1, rcl: 4 },
    { type: "extension" as BuildableStructureConstant, dx: 3, dy: 0, rcl: 4 },
    { type: "extension" as BuildableStructureConstant, dx: 3, dy: 1, rcl: 4 },
    { type: "extension" as BuildableStructureConstant, dx: 3, dy: -1, rcl: 4 },
    { type: "extension" as BuildableStructureConstant, dx: -3, dy: 0, rcl: 4 },
    { type: "extension" as BuildableStructureConstant, dx: -3, dy: 1, rcl: 4 },
    { type: "extension" as BuildableStructureConstant, dx: -3, dy: -1, rcl: 4 },
    { type: "extension" as BuildableStructureConstant, dx: 0, dy: 3, rcl: 4 },
    { type: "extension" as BuildableStructureConstant, dx: 0, dy: -3, rcl: 4 }
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
    const bestPos = this.findBestOpenSpace(terrain);
    if (bestPos) {
      this.anchor = bestPos;
    }

    return this.anchor;
  }

  /**
   * Simplified distance transform to find open spaces.
   * Returns the position furthest from walls.
   */
  private findBestOpenSpace(terrain: RoomTerrain, terrainWall: number = 1): RoomPosition | null {
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

    // Find position with maximum distance (prefer center areas)
    let maxDist = 0;
    let bestPos: RoomPosition | null = null;

    for (let x = 10; x < 40; x++) {
      for (let y = 10; y < 40; y++) {
        if (distanceField[x][y] > maxDist) {
          maxDist = distanceField[x][y];
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
