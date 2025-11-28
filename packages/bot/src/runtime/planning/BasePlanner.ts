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
 * Result of structure removal check - structures that need to be demolished.
 */
export interface MisplacedStructure {
  structure: Structure;
  reason: string;
}

/**
 * Configuration options for the BasePlanner.
 */
export interface BasePlannerConfig {
  /** Enable visualization support (default: false) */
  enableVisualization?: boolean;
}

/**
 * Spawn placement scoring constants for findBestOpenSpace algorithm.
 * These values determine optimal spawn location in newly claimed rooms.
 */
const SPAWN_PLACEMENT = {
  /**
   * Minimum distance from walls required for spawn placement.
   * Rationale: 4 tiles allows a 3x3 extension cluster around the spawn, which is the
   * minimum needed for efficient early base layouts. This distance ensures enough
   * buildable space for extensions and infrastructure.
   */
  MIN_WALL_DISTANCE: 4,
  /**
   * Weight factor for wall distance in scoring.
   * Rationale: Higher values prioritize open areas over proximity to sources,
   * reducing risk of cramped layouts. A value of 2 balances buildable space
   * with reasonable travel distances for creeps.
   */
  WALL_DISTANCE_WEIGHT: 2,
  /**
   * Maximum ideal distance to sources (beyond this, penalty applies).
   * Rationale: 20 tiles is roughly the maximum distance a hauler can travel
   * efficiently without excessive travel time. Based on typical room dimensions.
   */
  MAX_IDEAL_SOURCE_DISTANCE: 20,
  /**
   * Minimum ideal distance to sources (closer than this, penalty applies).
   * Rationale: 5 tiles ensures the spawn is not placed directly adjacent to sources,
   * which can block building space and create traffic jams. This buffer allows for
   * extension clusters and roads between spawn and sources.
   */
  MIN_IDEAL_SOURCE_DISTANCE: 5,
  /**
   * Penalty multiplier for being too far from sources.
   * Rationale: A moderate penalty (0.5) discourages excessive travel distance for
   * haulers, but does not outweigh the need for buildable space.
   */
  FAR_SOURCE_PENALTY: 0.5,
  /**
   * Penalty multiplier for being too close to sources.
   * Rationale: A stronger penalty (2) ensures the spawn is not placed so close to
   * sources that it blocks extension clusters or causes pathing issues.
   */
  CLOSE_SOURCE_PENALTY: 2
} as const;

/**
 * Plans and manages automatic base building using a dynamic layout pattern.
 * Dynamically places structures based on RCL and can identify misplaced structures for removal.
 * Based on community research from Sy-Harabi's guide and ScreepsPlus wiki.
 */
export class BasePlanner {
  private readonly roomName: string;
  private anchor: RoomPosition | null = null;
  private readonly enableVisualization: boolean;

  /**
   * Dynamic layout centered around spawn anchor point.
   * Offsets are relative to the anchor point (spawn position).
   * Uses chess/checkerboard pattern where structures are at even-sum coordinates (dx+dy is even).
   * This ensures all 8 adjacent tiles to spawn remain walkable for creeps.
   * Covers RCL 1-8 for complete base planning.
   */
  private readonly layout: Array<{
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
    { type: "tower" as BuildableStructureConstant, dx: -2, dy: -4, rcl: 5 },

    // RCL 6: Terminal (1 allowed)
    { type: "terminal" as BuildableStructureConstant, dx: -6, dy: -4, rcl: 6 },

    // RCL 6: Labs (3 allowed) - compact cluster for reactions
    { type: "lab" as BuildableStructureConstant, dx: 6, dy: 4, rcl: 6 },
    { type: "lab" as BuildableStructureConstant, dx: 6, dy: 6, rcl: 6 },
    { type: "lab" as BuildableStructureConstant, dx: 4, dy: 6, rcl: 6 },

    // RCL 6: More extensions (40 total, 10 more)
    { type: "extension" as BuildableStructureConstant, dx: -6, dy: -2, rcl: 6 },
    { type: "extension" as BuildableStructureConstant, dx: -4, dy: -6, rcl: 6 },
    { type: "extension" as BuildableStructureConstant, dx: 6, dy: -4, rcl: 6 },
    { type: "extension" as BuildableStructureConstant, dx: 4, dy: -6, rcl: 6 },
    { type: "extension" as BuildableStructureConstant, dx: -6, dy: 4, rcl: 6 },
    { type: "extension" as BuildableStructureConstant, dx: 8, dy: 0, rcl: 6 },
    { type: "extension" as BuildableStructureConstant, dx: 0, dy: 8, rcl: 6 },
    { type: "extension" as BuildableStructureConstant, dx: -8, dy: 0, rcl: 6 },
    { type: "extension" as BuildableStructureConstant, dx: 0, dy: -8, rcl: 6 },
    { type: "extension" as BuildableStructureConstant, dx: -6, dy: 6, rcl: 6 },

    // RCL 6: Third link (3 allowed)
    { type: "link" as BuildableStructureConstant, dx: 6, dy: -6, rcl: 6 },

    // RCL 7: Second spawn (2 allowed)
    { type: "spawn" as BuildableStructureConstant, dx: -2, dy: 2, rcl: 7 },

    // RCL 7: Third tower (3 allowed)
    { type: "tower" as BuildableStructureConstant, dx: 2, dy: 2, rcl: 7 },

    // RCL 7: Factory (1 allowed)
    { type: "factory" as BuildableStructureConstant, dx: -6, dy: -6, rcl: 7 },

    // RCL 7: More labs (6 total, 3 more)
    { type: "lab" as BuildableStructureConstant, dx: 8, dy: 4, rcl: 7 },
    { type: "lab" as BuildableStructureConstant, dx: 8, dy: 6, rcl: 7 },
    { type: "lab" as BuildableStructureConstant, dx: 8, dy: 8, rcl: 7 },

    // RCL 7: Fourth link (4 allowed)
    { type: "link" as BuildableStructureConstant, dx: -8, dy: 2, rcl: 7 },

    // RCL 7: More extensions (50 total, 10 more)
    { type: "extension" as BuildableStructureConstant, dx: 8, dy: 2, rcl: 7 },
    { type: "extension" as BuildableStructureConstant, dx: 2, dy: 8, rcl: 7 },
    { type: "extension" as BuildableStructureConstant, dx: -8, dy: -2, rcl: 7 },
    { type: "extension" as BuildableStructureConstant, dx: -2, dy: -8, rcl: 7 },
    { type: "extension" as BuildableStructureConstant, dx: 8, dy: -2, rcl: 7 },
    { type: "extension" as BuildableStructureConstant, dx: -8, dy: 4, rcl: 7 },
    { type: "extension" as BuildableStructureConstant, dx: 4, dy: 8, rcl: 7 },
    { type: "extension" as BuildableStructureConstant, dx: -4, dy: 8, rcl: 7 },
    { type: "extension" as BuildableStructureConstant, dx: -8, dy: -4, rcl: 7 },
    { type: "extension" as BuildableStructureConstant, dx: 2, dy: -8, rcl: 7 },

    // RCL 8: Third spawn (3 allowed)
    { type: "spawn" as BuildableStructureConstant, dx: 2, dy: -2, rcl: 8 },

    // RCL 8: Three more towers (6 total)
    { type: "tower" as BuildableStructureConstant, dx: -4, dy: 2, rcl: 8 },
    { type: "tower" as BuildableStructureConstant, dx: 4, dy: 2, rcl: 8 },
    { type: "tower" as BuildableStructureConstant, dx: -2, dy: 4, rcl: 8 },

    // RCL 8: Observer (1 allowed)
    { type: "observer" as BuildableStructureConstant, dx: -8, dy: 8, rcl: 8 },

    // RCL 8: Power Spawn (1 allowed)
    { type: "powerSpawn" as BuildableStructureConstant, dx: -4, dy: 4, rcl: 8 },

    // RCL 8: Nuker (1 allowed)
    { type: "nuker" as BuildableStructureConstant, dx: 8, dy: -8, rcl: 8 },

    // RCL 8: More labs (10 total, 4 more)
    { type: "lab" as BuildableStructureConstant, dx: 6, dy: 8, rcl: 8 },
    { type: "lab" as BuildableStructureConstant, dx: 4, dy: 8, rcl: 8 },
    { type: "lab" as BuildableStructureConstant, dx: 10, dy: 6, rcl: 8 },
    { type: "lab" as BuildableStructureConstant, dx: 10, dy: 4, rcl: 8 },

    // RCL 8: Two more links (6 total)
    { type: "link" as BuildableStructureConstant, dx: 8, dy: -4, rcl: 8 },
    { type: "link" as BuildableStructureConstant, dx: -8, dy: -6, rcl: 8 },

    // RCL 8: More extensions (60 total, 10 more)
    { type: "extension" as BuildableStructureConstant, dx: -4, dy: -8, rcl: 8 },
    { type: "extension" as BuildableStructureConstant, dx: 4, dy: -8, rcl: 8 },
    { type: "extension" as BuildableStructureConstant, dx: -8, dy: 6, rcl: 8 },
    { type: "extension" as BuildableStructureConstant, dx: 6, dy: -8, rcl: 8 },
    { type: "extension" as BuildableStructureConstant, dx: -6, dy: -8, rcl: 8 },
    { type: "extension" as BuildableStructureConstant, dx: -6, dy: 8, rcl: 8 },
    { type: "extension" as BuildableStructureConstant, dx: 8, dy: -6, rcl: 8 },
    { type: "extension" as BuildableStructureConstant, dx: -8, dy: -8, rcl: 8 },
    { type: "extension" as BuildableStructureConstant, dx: 10, dy: 0, rcl: 8 },
    { type: "extension" as BuildableStructureConstant, dx: 0, dy: 10, rcl: 8 }
  ];

  public constructor(roomName: string, config: BasePlannerConfig = {}) {
    this.roomName = roomName;
    this.enableVisualization = config.enableVisualization ?? false;
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
   * Calculate the source proximity penalty for spawn placement scoring.
   * Returns a penalty value based on average distance to sources.
   *
   * @param avgSourceDist - The average Chebyshev distance from position to all sources
   * @returns A penalty value (higher = worse position). Returns 0 if within ideal range,
   *          positive penalty if too far or too close to sources.
   */
  private calculateSourceProximityPenalty(avgSourceDist: number): number {
    if (avgSourceDist > SPAWN_PLACEMENT.MAX_IDEAL_SOURCE_DISTANCE) {
      return (avgSourceDist - SPAWN_PLACEMENT.MAX_IDEAL_SOURCE_DISTANCE) * SPAWN_PLACEMENT.FAR_SOURCE_PENALTY;
    } else if (avgSourceDist < SPAWN_PLACEMENT.MIN_IDEAL_SOURCE_DISTANCE) {
      return (SPAWN_PLACEMENT.MIN_IDEAL_SOURCE_DISTANCE - avgSourceDist) * SPAWN_PLACEMENT.CLOSE_SOURCE_PENALTY;
    }
    return 0;
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

    // Pre-compute source positions to avoid repeated property access
    const sources = room ? (room.find(FIND_SOURCES) as Array<{ pos: { x: number; y: number } }>) : [];
    const sourcePositions = sources.map(s => ({ x: s.pos.x, y: s.pos.y }));

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

        if (sourcePositions.length > 0) {
          // Calculate average distance to sources (lower is better)
          let totalSourceDist = 0;
          for (const sourcePos of sourcePositions) {
            const dx = Math.abs(x - sourcePos.x);
            const dy = Math.abs(y - sourcePos.y);
            totalSourceDist += Math.max(dx, dy); // Chebyshev distance
          }
          const avgSourceDist = totalSourceDist / sourcePositions.length;

          // Apply proximity penalty using helper function
          score -= this.calculateSourceProximityPenalty(avgSourceDist);
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

    for (const item of this.layout) {
      if (item.rcl <= rcl) {
        plans.push({
          structureType: item.type,
          pos: {
            x: anchor.x + item.dx,
            y: anchor.y + item.dy
          },
          rcl: item.rcl
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

  /**
   * Get structure color for visualization based on structure type.
   */
  private getStructureColor(structureType: BuildableStructureConstant): string {
    const colors: Record<string, string> = {
      spawn: "#ffff00",
      extension: "#00ff00",
      tower: "#ff0000",
      storage: "#00ffff",
      link: "#ff00ff",
      terminal: "#ffa500",
      lab: "#00ff88",
      factory: "#888888",
      observer: "#ffffff",
      powerSpawn: "#ff8800",
      nuker: "#ff0088",
      container: "#aaaaaa",
      road: "#666666",
      rampart: "#008800",
      constructedWall: "#444444",
      extractor: "#8888ff"
    };
    return colors[structureType] ?? "#ffffff";
  }

  /**
   * Visualize the planned base layout using Room.visual.
   * Call this method each tick to show the layout overlay.
   *
   * @param room - Room to visualize in (must have visual property)
   * @param rcl - RCL to show layout for (default: 8 for full layout)
   * @param showLabels - Show structure type labels (default: false)
   * @returns Number of structures visualized
   */
  public visualize(
    room: { visual: RoomVisual; getTerrain: () => RoomTerrain },
    rcl: number = 8,
    showLabels: boolean = false
  ): number {
    if (!this.enableVisualization) {
      return 0;
    }

    if (!this.anchor) {
      const terrain = room.getTerrain();
      // Try to calculate anchor for visualization
      const bestPos = this.findBestOpenSpace(terrain);
      if (bestPos) {
        this.anchor = bestPos;
      }
    }

    if (!this.anchor) {
      return 0;
    }

    const plans = this.getPlanForRCL(rcl, this.anchor);
    let count = 0;

    for (const plan of plans) {
      const color = this.getStructureColor(plan.structureType);

      // Draw structure circle
      room.visual.circle(plan.pos.x, plan.pos.y, {
        radius: 0.35,
        fill: color,
        stroke: "#000000",
        strokeWidth: 0.1,
        opacity: 0.6
      });

      // Draw RCL indicator
      room.visual.text(String(plan.rcl), plan.pos.x, plan.pos.y + 0.1, {
        color: "#000000",
        font: 0.4,
        align: "center"
      });

      // Optionally draw structure type label
      if (showLabels) {
        const shortType = plan.structureType.substring(0, 3);
        room.visual.text(shortType, plan.pos.x, plan.pos.y - 0.6, {
          color: color,
          font: 0.25,
          align: "center",
          opacity: 0.8
        });
      }

      count++;
    }

    // Draw anchor point marker
    room.visual.circle(this.anchor.x, this.anchor.y, {
      radius: 0.5,
      fill: "transparent",
      stroke: "#ffff00",
      strokeWidth: 0.15,
      opacity: 1.0
    });

    // Draw info text
    room.visual.text(
      `Dynamic Layout | RCL ${rcl} | ${count} structures`,
      this.anchor.x,
      this.anchor.y - 2,
      {
        color: "#ffffff",
        font: 0.5,
        align: "center",
        backgroundColor: "#000000",
        backgroundPadding: 0.2
      }
    );

    return count;
  }

  /**
   * Get layout statistics for debugging and console commands.
   *
   * @param rcl - RCL to get statistics for (default: 8)
   * @returns Object with layout statistics
   */
  public getLayoutStats(rcl: number = 8): {
    totalStructures: number;
    byType: Record<string, number>;
    byRCL: Record<number, number>;
    boundingBox: { minX: number; maxX: number; minY: number; maxY: number } | null;
  } {
    const filtered = this.layout.filter(item => item.rcl <= rcl);

    const byType: Record<string, number> = {};
    const byRCL: Record<number, number> = {};
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    for (const item of filtered) {
      byType[item.type] = (byType[item.type] ?? 0) + 1;
      byRCL[item.rcl] = (byRCL[item.rcl] ?? 0) + 1;
      minX = Math.min(minX, item.dx);
      maxX = Math.max(maxX, item.dx);
      minY = Math.min(minY, item.dy);
      maxY = Math.max(maxY, item.dy);
    }

    return {
      totalStructures: filtered.length,
      byType,
      byRCL,
      boundingBox:
        filtered.length > 0
          ? {
              minX,
              maxX,
              minY,
              maxY
            }
          : null
    };
  }

  /**
   * Identify structures that are misplaced (not in planned positions) and should be removed.
   * This enables the dynamic planner to clean up structures in wrong positions.
   *
   * @param room - Room to check for misplaced structures
   * @param terrain - Room terrain data
   * @param currentRCL - Current room controller level
   * @param findMySpawns - FindConstant for spawns
   * @param findStructures - FindConstant for structures
   * @returns Array of misplaced structures with reasons
   */
  public getMisplacedStructures(
    room: RoomLike,
    terrain: RoomTerrain,
    currentRCL: number,
    findMySpawns: FindConstant,
    findStructures: FindConstant
  ): MisplacedStructure[] {
    const anchor = this.calculateAnchor(room, terrain, findMySpawns);
    if (!anchor) {
      return [];
    }

    const planned = this.getPlanForRCL(currentRCL, anchor);
    const misplaced: MisplacedStructure[] = [];

    // Get existing structures (exclude controller, sources, minerals, etc.)
    const existingStructures = room.find(findStructures) as Structure[];

    // Structure types that the planner manages (excludes roads, ramparts, walls, containers that may be placed elsewhere)
    const managedTypes = new Set<string>([
      "spawn",
      "extension",
      "tower",
      "storage",
      "link",
      "terminal",
      "lab",
      "factory",
      "observer",
      "powerSpawn",
      "nuker"
    ]);

    for (const structure of existingStructures) {
      // Skip structure types we don't manage
      if (!managedTypes.has(structure.structureType)) {
        continue;
      }

      // Check if this structure is in a planned position
      const isPlanned = planned.some(
        plan => plan.pos.x === structure.pos.x && plan.pos.y === structure.pos.y && plan.structureType === structure.structureType
      );

      if (!isPlanned) {
        misplaced.push({
          structure,
          reason: `${structure.structureType} at (${structure.pos.x},${structure.pos.y}) is not in planned layout position`
        });
      }
    }

    return misplaced;
  }

  /**
   * Get the room name this planner is configured for.
   */
  public getRoomName(): string {
    return this.roomName;
  }

  /**
   * Get the current anchor position if set.
   */
  public getAnchor(): RoomPosition | null {
    return this.anchor;
  }

  /**
   * Reset the anchor position to force recalculation.
   */
  public resetAnchor(): void {
    this.anchor = null;
  }
}
