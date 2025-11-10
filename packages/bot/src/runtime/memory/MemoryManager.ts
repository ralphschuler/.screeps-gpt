import { profile } from "@profiler";

interface CreepLike {
  readonly name: string;
  readonly memory: CreepMemory;
}

/**
 * Handles Memory hygiene between ticks by pruning stale creep entries and
 * keeping aggregate role counts up to date.
 */
@profile
export class MemoryManager {
  public constructor(private readonly logger: Pick<Console, "log"> = console) {}

  /**
   * Remove creep memories that no longer correspond to living creeps.
   * @returns the list of creep names that were removed.
   */
  public pruneMissingCreeps(memory: Memory, creeps: Record<string, CreepLike>): string[] {
    const missing: string[] = [];
    const creepMemory = memory.creeps ?? {};

    for (const name of Object.keys(creepMemory)) {
      if (!(name in creeps)) {
        delete creepMemory[name];
        missing.push(name);
      }
    }

    if (missing.length > 0) {
      this.logger.log(`Removed ${missing.length} stale creep memories: ${missing.join(", ")}`);
    }

    memory.creeps = creepMemory;
    return missing;
  }

  /**
   * Record how many creeps exist for each role and persist that breakdown in Memory.
   */
  public updateRoleBookkeeping(memory: Memory, creeps: Record<string, CreepLike>): Record<string, number> {
    const roleCounts: Record<string, number> = {};

    for (const creep of Object.values(creeps)) {
      const role = creep.memory?.role ?? "unassigned";
      roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    }

    memory.roles = roleCounts;
    return roleCounts;
  }
}
