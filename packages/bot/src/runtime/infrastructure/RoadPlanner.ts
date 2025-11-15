import type { GameContext, RoomLike } from "@runtime/types/GameContext";
import { profile } from "@profiler";
import type { TrafficManager } from "./TrafficManager";

/**
 * Road placement plan
 */
interface RoadPlan {
  pos: { x: number; y: number };
  roomName: string;
  priority?: number; // Priority based on traffic
}

/**
 * Manages automatic road placement based on pathfinding results.
 * Creates roads along frequently traveled paths to reduce creep fatigue.
 * Integrates with TrafficManager for traffic-based prioritization.
 */
@profile
export class RoadPlanner {
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly maxRoadsPerTick: number;
  private trafficManager?: TrafficManager;

  public constructor(
    logger: Pick<Console, "log" | "warn"> = console,
    maxRoadsPerTick: number = 1 // Limit construction sites per tick
  ) {
    this.logger = logger;
    this.maxRoadsPerTick = maxRoadsPerTick;
  }

  /**
   * Set traffic manager for traffic-based road prioritization
   */
  public setTrafficManager(trafficManager: TrafficManager): void {
    this.trafficManager = trafficManager;
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

    // Sort plans by priority if available (highest priority first)
    const sortedPlans = [...plans].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    // Get existing structures and construction sites
    const existingStructures = room.find(FIND_STRUCTURES) as Structure[];
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES) as ConstructionSite[];

    for (const plan of sortedPlans) {
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
        const priorityStr = plan.priority ? ` (priority: ${plan.priority.toFixed(1)})` : "";
        this.logger.log?.(
          `[RoadPlanner] Created road site at ${room.name} (${plan.pos.x},${plan.pos.y})${priorityStr}`
        );
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

  /**
   * Identify roads needing repair in a room
   * @param room Room to check for damaged roads
   * @param healthThreshold Percentage of max hits below which road needs repair (default: 0.8)
   * @returns Array of roads needing repair
   */
  public identifyRepairNeeds(room: RoomLike, healthThreshold: number = 0.8): StructureRoad[] {
    const structures = room.find(FIND_STRUCTURES) as Structure[];
    return structures.filter((s): s is StructureRoad => {
      return s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax * healthThreshold;
    });
  }

  /**
   * Prioritize road repairs based on traffic data
   * @param roads Roads to prioritize
   * @returns Sorted array with high-traffic roads first
   */
  public prioritizeRepairs(roads: StructureRoad[]): StructureRoad[] {
    if (!this.trafficManager) {
      // No traffic data available, sort by hits (most damaged first)
      return roads.sort((a, b) => a.hits / a.hitsMax - b.hits / b.hitsMax);
    }

    // Sort by traffic count (high to low), then by damage (low to high)
    return roads.sort((a, b) => {
      const trafficA = this.trafficManager!.getTrafficAt(a.pos);
      const trafficB = this.trafficManager!.getTrafficAt(b.pos);

      if (trafficB !== trafficA) {
        return trafficB - trafficA; // Higher traffic first
      }

      // If traffic is equal, prioritize more damaged roads
      return a.hits / a.hitsMax - b.hits / b.hitsMax;
    });
  }

  /**
   * Plan roads based on high-traffic areas
   * @param room Room to plan roads for
   * @param trafficThreshold Minimum traffic count to warrant a road
   * @returns Array of road plans for high-traffic positions
   */
  public planRoadsFromTraffic(room: RoomLike, trafficThreshold: number = 10): RoadPlan[] {
    if (!this.trafficManager) {
      return [];
    }

    const highTrafficPositions = this.trafficManager.getHighTrafficPositions(trafficThreshold);
    const plans: RoadPlan[] = [];

    for (const { pos, count } of highTrafficPositions) {
      // Only plan roads in the specified room
      if (pos.roomName === room.name) {
        plans.push({
          pos: { x: pos.x, y: pos.y },
          roomName: pos.roomName,
          priority: count
        });
      }
    }

    return plans;
  }

  /**
   * Calculate the value of building a road at a position based on traffic and terrain
   * @param pos Position to evaluate
   * @param traffic Traffic count at the position
   * @param terrain Room terrain for terrain type lookup
   * @returns Road value score (higher = more beneficial)
   */
  public calculateRoadValue(pos: RoomPosition, traffic: number, terrain: RoomTerrain): number {
    // Get terrain type at position
    const terrainType = terrain.get(pos.x, pos.y);

    // Determine terrain cost (fatigue per move)
    let terrainCost: number;
    if (terrainType === TERRAIN_MASK_WALL) {
      return 0; // Cannot build on walls
    } else if (terrainType === TERRAIN_MASK_SWAMP) {
      terrainCost = 5; // Swamps have 5x fatigue
    } else {
      terrainCost = 1; // Plains have 1x fatigue
    }

    const roadCost = 1; // Roads always cost 1 fatigue
    const savings = terrainCost - roadCost;

    // Value = traffic × savings per move
    return traffic * savings;
  }

  /**
   * Prioritize road construction based on cost-benefit analysis
   * @param room Room to analyze
   * @param minValueThreshold Minimum value threshold for road construction (default: 10)
   * @returns Sorted array of road plans by value (highest first)
   */
  public prioritizeRoadConstruction(room: RoomLike, minValueThreshold: number = 10): RoadPlan[] {
    if (!this.trafficManager) {
      return [];
    }

    const terrain = room.getTerrain();
    const allTraffic = this.trafficManager.getHighTrafficPositions(0);

    // Calculate value for each position in this room
    const valuedPlans: Array<{ plan: RoadPlan; value: number }> = [];

    for (const { pos, count } of allTraffic) {
      if (pos.roomName !== room.name) {
        continue;
      }

      const value = this.calculateRoadValue(pos, count, terrain);

      if (value >= minValueThreshold) {
        valuedPlans.push({
          plan: {
            pos: { x: pos.x, y: pos.y },
            roomName: pos.roomName,
            priority: value
          },
          value
        });
      }
    }

    // Sort by value descending and return plans
    return valuedPlans.sort((a, b) => b.value - a.value).map(vp => vp.plan);
  }
}
