import type { GameContext, RoomLike } from "@runtime/types/GameContext";
import { profile } from "@profiler";

/**
 * Road placement plan
 */
interface RoadPlan {
  pos: { x: number; y: number };
  roomName: string;
}

/**
 * Manages automatic road placement based on pathfinding results.
 * Creates roads along frequently traveled paths to reduce creep fatigue.
 */
@profile
export class RoadPlanner {
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly maxRoadsPerTick: number;

  public constructor(
    logger: Pick<Console, "log" | "warn"> = console,
    maxRoadsPerTick: number = 1 // Limit construction sites per tick
  ) {
    this.logger = logger;
    this.maxRoadsPerTick = maxRoadsPerTick;
  }

  /**
   * Plan roads between two positions in a room
   */
  public planRoadsBetween(room: RoomLike, from: RoomPosition, to: RoomPosition, _game: GameContext): RoadPlan[] {
    const plans: RoadPlan[] = [];

    // Use pathfinding to get the optimal path
    const path = room.findPath(from, to, {
      ignoreCreeps: true,
      ignoreDestructibleStructures: true,
      maxOps: 2000
    });

    // Convert path to road plans
    for (const step of path) {
      plans.push({
        pos: { x: step.x, y: step.y },
        roomName: room.name
      });
    }

    return plans;
  }

  /**
   * Plan roads from sources to spawn
   */
  public planSourceRoads(room: RoomLike, game: GameContext): RoadPlan[] {
    const plans: RoadPlan[] = [];

    const spawns = room.find(FIND_MY_SPAWNS) as StructureSpawn[];
    if (spawns.length === 0) {
      return plans;
    }

    const spawn = spawns[0];
    const sources = room.find(FIND_SOURCES) as Source[];

    for (const source of sources) {
      const sourcePlans = this.planRoadsBetween(room, source.pos, spawn.pos, game);
      plans.push(...sourcePlans);
    }

    return plans;
  }

  /**
   * Plan roads from sources to controller
   */
  public planControllerRoads(room: RoomLike, game: GameContext): RoadPlan[] {
    const plans: RoadPlan[] = [];

    if (!room.controller) {
      return plans;
    }

    const sources = room.find(FIND_SOURCES) as Source[];

    for (const source of sources) {
      const sourcePlans = this.planRoadsBetween(room, source.pos, room.controller.pos, game);
      plans.push(...sourcePlans);
    }

    return plans;
  }

  /**
   * Create road construction sites from plans
   */
  public createRoadSites(room: RoomLike, plans: RoadPlan[], terrain: RoomTerrain): { created: number; failed: number } {
    let created = 0;
    let failed = 0;

    // Get existing structures and construction sites
    const existingStructures = room.find(FIND_STRUCTURES) as Structure[];
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES) as ConstructionSite[];

    for (const plan of plans) {
      if (created >= this.maxRoadsPerTick) {
        break;
      }

      // Check if position is valid (not wall)
      if (terrain.get(plan.pos.x, plan.pos.y) === TERRAIN_MASK_WALL) {
        continue;
      }

      // Check if road or construction site already exists
      const hasRoad = existingStructures.some(
        s => s.pos.x === plan.pos.x && s.pos.y === plan.pos.y && s.structureType === STRUCTURE_ROAD
      );

      const hasRoadSite = constructionSites.some(
        s => s.pos.x === plan.pos.x && s.pos.y === plan.pos.y && s.structureType === STRUCTURE_ROAD
      );

      if (hasRoad || hasRoadSite) {
        continue;
      }

      // Create construction site
      const result = room.createConstructionSite(plan.pos.x, plan.pos.y, STRUCTURE_ROAD);

      if (result === OK) {
        created++;
        this.logger.log?.(`[RoadPlanner] Created road site at ${room.name} (${plan.pos.x},${plan.pos.y})`);
      } else if (result !== ERR_FULL && result !== ERR_INVALID_TARGET) {
        failed++;
        this.logger.warn?.(
          `[RoadPlanner] Failed to create road at ${room.name} (${plan.pos.x},${plan.pos.y}): ${result}`
        );
      }
    }

    return { created, failed };
  }

  /**
   * Automatically plan and create roads for a room
   */
  public autoPlaceRoads(room: RoomLike, game: GameContext): { created: number; failed: number } {
    const terrain = room.getTerrain();

    // Combine all road plans
    const sourcePlans = this.planSourceRoads(room, game);
    const controllerPlans = this.planControllerRoads(room, game);

    // Deduplicate plans (same position)
    const uniquePlans = new Map<string, RoadPlan>();
    for (const plan of [...sourcePlans, ...controllerPlans]) {
      const key = `${plan.pos.x},${plan.pos.y}`;
      uniquePlans.set(key, plan);
    }

    const plans = Array.from(uniquePlans.values());

    return this.createRoadSites(room, plans, terrain);
  }
}
