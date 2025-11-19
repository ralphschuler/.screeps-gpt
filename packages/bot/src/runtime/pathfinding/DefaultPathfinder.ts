import type { PathfindingOptions, PathfindingProvider, PathfindingResult } from "./PathfindingProvider";
import { PathCache } from "./PathCache";

/**
 * Default pathfinding implementation using native Screeps PathFinder
 * This is the baseline implementation that uses the built-in Screeps pathfinding.
 *
 * @param pathCache - Shared PathCache instance. Required to prevent cache fragmentation.
 */
export class DefaultPathfinder implements PathfindingProvider {
  private readonly pathCache: PathCache;

  public constructor(pathCache: PathCache) {
    this.pathCache = pathCache;
  }

  public getName(): string {
    return "default";
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

    // Cache successful paths (don't cache incomplete paths as they may be suboptimal)
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

    return creep.moveTo(targetPos, {
      range: opts.range,
      reusePath: opts.reusePath,
      ignoreCreeps: opts.ignoreCreeps,
      maxRooms: opts.maxRooms,
      maxOps: opts.maxOps,
      costCallback: opts.costCallback,
      plainCost: opts.plainCost,
      swampCost: opts.swampCost
    });
  }
}
