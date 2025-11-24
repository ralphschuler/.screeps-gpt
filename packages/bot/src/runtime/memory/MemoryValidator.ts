import { z } from "zod";
import { createComponentLogger } from "@runtime/utils/logger";

const logger = createComponentLogger("MemoryValidator");

/**
 * Zod schema for Memory.stats CPU information
 */
const MemoryStatsCpuSchema = z.object({
  used: z.number(),
  limit: z.number(),
  bucket: z.number()
});

/**
 * Zod schema for Memory.stats.creeps information
 */
const MemoryStatsCreepsSchema = z.object({
  count: z.number()
});

/**
 * Zod schema for room stats data (can be a number or object)
 */
const RoomStatsValueSchema = z.union([
  z.number(),
  z.object({
    energyAvailable: z.number(),
    energyCapacityAvailable: z.number(),
    controllerLevel: z.number().optional(),
    controllerProgress: z.number().optional(),
    controllerProgressTotal: z.number().optional()
  })
]);

/**
 * Zod schema for Memory.stats.rooms information
 */
const MemoryStatsRoomsSchema = z
  .object({
    count: z.number()
  })
  .catchall(RoomStatsValueSchema);

/**
 * Zod schema for Memory.stats.spawn information
 */
const MemoryStatsSpawnSchema = z.object({
  orders: z.number()
});

/**
 * Complete zod schema for Memory.stats structure
 */
const MemoryStatsSchema = z.object({
  time: z.number(),
  lastTimeoutTick: z.number().optional(),
  cpu: MemoryStatsCpuSchema,
  creeps: MemoryStatsCreepsSchema,
  rooms: MemoryStatsRoomsSchema,
  spawn: MemoryStatsSpawnSchema.optional()
});

/**
 * Runtime memory validator using zod schemas.
 * Validates Memory objects against TypeScript interfaces to catch type mismatches at runtime.
 */
export class MemoryValidator {
  /**
   * Validates Memory.stats structure against its TypeScript interface.
   * @param stats - Unknown object to validate as Memory.stats
   * @returns Validated Memory.stats object or null if validation fails
   */
  public static validateStats(stats: unknown): Memory["stats"] | null {
    const result = MemoryStatsSchema.safeParse(stats);
    if (!result.success) {
      logger.errorObject(result.error.issues, "Invalid Memory.stats structure:");
      return null;
    }
    return result.data;
  }

  /**
   * Validates and repairs Memory.stats, initializing with defaults if invalid.
   * @param memory - Memory object to validate and potentially repair
   * @param currentTick - Current game tick for initialization
   * @returns true if stats were valid or successfully repaired, false if repair failed
   */
  public static validateAndRepairStats(memory: Memory, currentTick: number): boolean {
    if (!memory.stats) {
      // Initialize with default stats
      memory.stats = {
        time: currentTick,
        cpu: { used: 0, limit: 0, bucket: 0 },
        creeps: { count: 0 },
        rooms: { count: 0 }
      };
      return true;
    }

    // Preserve lastTimeoutTick before validation if it exists and is a number
    let previousLastTimeoutTick: number | undefined;
    if (
      memory.stats &&
      typeof memory.stats === "object" &&
      memory.stats !== null &&
      "lastTimeoutTick" in memory.stats
    ) {
      const value = memory.stats.lastTimeoutTick;
      if (typeof value === "number") {
        previousLastTimeoutTick = value;
      }
    }

    const validated = this.validateStats(memory.stats);
    if (!validated) {
      logger.info("Repairing corrupted Memory.stats with defaults");
      memory.stats = {
        time: currentTick,
        lastTimeoutTick: previousLastTimeoutTick,
        cpu: { used: 0, limit: 0, bucket: 0 },
        creeps: { count: 0 },
        rooms: { count: 0 }
      };
      return true;
    }

    return true;
  }
}
