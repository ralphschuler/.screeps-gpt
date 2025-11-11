import type { PathfindingOptions, PathfindingProvider, PathfindingResult } from "./PathfindingProvider";

/**
 * Default pathfinding implementation using native Screeps PathFinder
 * This is the baseline implementation that uses the built-in Screeps pathfinding.
 */
export class DefaultPathfinder implements PathfindingProvider {
  public getName(): string {
    return "default";
  }

  public findPath(
    origin: RoomPosition,
    goal: RoomPosition | { pos: RoomPosition },
    opts: PathfindingOptions = {}
  ): PathfindingResult {
    const cpuStart = Game.cpu.getUsed();

    const goalPos = goal instanceof RoomPosition ? goal : goal.pos;
    const range = opts.range ?? 1;

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
