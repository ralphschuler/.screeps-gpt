import { moveTo } from "screeps-cartographer";
import type { PathfindingOptions, PathfindingProvider, PathfindingResult } from "./PathfindingProvider";
import { PathCache } from "./PathCache";

/**
 * Advanced pathfinding implementation using screeps-cartographer library
 * Provides optimized pathfinding with caching and multi-room support
 */
export class CartographerPathfinder implements PathfindingProvider {
  private readonly pathCache: PathCache;

  public constructor(pathCache?: PathCache) {
    this.pathCache = pathCache ?? new PathCache();
  }

  public getName(): string {
    return "cartographer";
  }

  public findPath(
    origin: RoomPosition,
    goal: RoomPosition | { pos: RoomPosition },
    opts: PathfindingOptions = {}
  ): PathfindingResult {
    const goalPos = goal instanceof RoomPosition ? goal : goal.pos;
    const range = opts.range ?? 1;
    const currentTick = Game.time;

    // Check cache first
    const cached = this.pathCache.getPath(origin, goalPos, currentTick, { range });
    if (cached && !cached.incomplete) {
      return {
        path: cached.path,
        ops: cached.ops,
        cost: 0, // Cache hit has minimal CPU cost
        incomplete: false
      };
    }

    // Cache miss - perform pathfinding
    const cpuStart = Game.cpu.getUsed();

    // Use native PathFinder for path calculation
    // Cartographer's moveTo handles caching internally for movement
    const result = PathFinder.search(
      origin,
      { pos: goalPos, range },
      {
        roomCallback: opts.costCallback,
        plainCost: opts.plainCost,
        swampCost: opts.swampCost,
        maxOps: opts.maxOps,
        maxRooms: opts.maxRooms
      }
    );

    const cpuCost = Game.cpu.getUsed() - cpuStart;

    // Cache successful paths
    if (!result.incomplete) {
      this.pathCache.setPath(origin, goalPos, result.path, currentTick, {
        ops: result.ops,
        cpuCost,
        incomplete: result.incomplete,
        range
      });
    }

    return {
      path: result.path,
      ops: result.ops,
      cost: cpuCost,
      incomplete: result.incomplete
    };
  }

  public moveTo(
    creep: Creep,
    target: RoomPosition | { pos: RoomPosition },
    opts: PathfindingOptions = {}
  ): ScreepsReturnCode {
    const targetPos = target instanceof RoomPosition ? target : target.pos;

    // Use cartographer's moveTo for optimized movement with caching
    const result = moveTo(creep, targetPos, {
      range: opts.range ?? 1,
      reusePath: opts.reusePath,
      ignoreCreeps: opts.ignoreCreeps,
      maxRooms: opts.maxRooms,
      maxOps: opts.maxOps,
      roomCallback: opts.costCallback,
      plainCost: opts.plainCost,
      swampCost: opts.swampCost
    });

    // Cartographer's moveTo returns compatible Screeps return codes
    return result as ScreepsReturnCode;
  }
}
