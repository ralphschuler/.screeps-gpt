import { profile } from "@profiler";

/**
 * Configuration options for memory self-healing
 */
export interface SelfHealerConfig {
  /**
   * Whether to automatically repair corrupted memory structures
   * @default true
   */
  autoRepair?: boolean;

  /**
   * Whether to log repair actions
   * @default true
   */
  logRepairs?: boolean;
}

/**
 * Result of a memory health check and repair operation
 */
export interface HealthCheckResult {
  isHealthy: boolean;
  issuesFound: string[];
  issuesRepaired: string[];
  requiresReset: boolean;
}

/**
 * Handles automatic detection and repair of corrupted or missing memory structures.
 * Ensures memory integrity and prevents crashes from invalid memory state.
 */
@profile
export class MemorySelfHealer {
  private readonly config: Required<SelfHealerConfig>;

  public constructor(
    config: SelfHealerConfig = {},
    private readonly logger: Pick<Console, "log" | "warn"> = console
  ) {
    this.config = {
      autoRepair: config.autoRepair ?? true,
      logRepairs: config.logRepairs ?? true
    };
  }

  /**
   * Perform a comprehensive health check and repair of memory structures.
   * This should be called before any other memory operations in the game loop.
   */
  public checkAndRepair(memory: Memory): HealthCheckResult {
    const result: HealthCheckResult = {
      isHealthy: true,
      issuesFound: [],
      issuesRepaired: [],
      requiresReset: false
    };

    // Check for complete memory corruption (circular references, JSON serialization failure)
    if (!this.isSerializable(memory)) {
      result.issuesFound.push("Memory contains circular references or unserializable data");
      result.requiresReset = true;
      result.isHealthy = false;

      if (this.config.logRepairs) {
        this.logger.warn?.("[MemorySelfHealer] CRITICAL: Memory is not serializable. Manual reset required.");
      }
      return result;
    }

    // Validate and repair core memory structures
    this.validateAndRepairCreeps(memory, result);
    this.validateAndRepairRoles(memory, result);
    this.validateAndRepairRooms(memory, result);
    this.validateAndRepairRespawn(memory, result);
    this.validateAndRepairStats(memory, result);
    this.validateAndRepairSystemReport(memory, result);
    this.validateAndRepairVersion(memory, result);

    // Log summary
    if (result.issuesFound.length > 0 && this.config.logRepairs) {
      this.logger.log(
        `[MemorySelfHealer] Found ${result.issuesFound.length} issue(s), repaired ${result.issuesRepaired.length}`
      );
    }

    return result;
  }

  /**
   * Check if memory can be serialized to JSON (detects circular references)
   */
  private isSerializable(memory: Memory): boolean {
    try {
      JSON.stringify(memory);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate and repair Memory.creeps structure
   */
  private validateAndRepairCreeps(memory: Memory, result: HealthCheckResult): void {
    if (!memory.creeps) {
      result.issuesFound.push("Memory.creeps is missing");
      if (this.config.autoRepair) {
        memory.creeps = {};
        result.issuesRepaired.push("Initialized Memory.creeps");
      }
      result.isHealthy = false;
      return;
    }

    if (typeof memory.creeps !== "object" || Array.isArray(memory.creeps)) {
      result.issuesFound.push("Memory.creeps is not a valid object");
      if (this.config.autoRepair) {
        memory.creeps = {};
        result.issuesRepaired.push("Reset Memory.creeps to empty object");
      }
      result.isHealthy = false;
      return;
    }

    // Validate individual creep memories
    for (const name in memory.creeps) {
      const creepMemory = memory.creeps[name];
      if (!creepMemory || typeof creepMemory !== "object") {
        result.issuesFound.push(`Memory.creeps["${name}"] is invalid`);
        if (this.config.autoRepair) {
          delete memory.creeps[name];
          result.issuesRepaired.push(`Removed invalid creep memory for "${name}"`);
        }
        result.isHealthy = false;
      }
    }
  }

  /**
   * Validate and repair Memory.roles structure
   */
  private validateAndRepairRoles(memory: Memory, result: HealthCheckResult): void {
    if (!memory.roles) {
      result.issuesFound.push("Memory.roles is missing");
      if (this.config.autoRepair) {
        memory.roles = {};
        result.issuesRepaired.push("Initialized Memory.roles");
      }
      result.isHealthy = false;
      return;
    }

    if (typeof memory.roles !== "object" || Array.isArray(memory.roles)) {
      result.issuesFound.push("Memory.roles is not a valid object");
      if (this.config.autoRepair) {
        memory.roles = {};
        result.issuesRepaired.push("Reset Memory.roles to empty object");
      }
      result.isHealthy = false;
      return;
    }

    // Validate role counts
    for (const role in memory.roles) {
      const count = memory.roles[role];
      if (typeof count !== "number" || count < 0 || !Number.isFinite(count)) {
        result.issuesFound.push(`Memory.roles["${role}"] has invalid count: ${count}`);
        if (this.config.autoRepair) {
          delete memory.roles[role];
          result.issuesRepaired.push(`Removed invalid role count for "${role}"`);
        }
        result.isHealthy = false;
      }
    }
  }

  /**
   * Validate and repair Memory.rooms structure
   */
  private validateAndRepairRooms(memory: Memory, result: HealthCheckResult): void {
    if (!memory.rooms) {
      result.issuesFound.push("Memory.rooms is missing");
      if (this.config.autoRepair) {
        memory.rooms = {};
        result.issuesRepaired.push("Initialized Memory.rooms");
      }
      result.isHealthy = false;
      return;
    }

    if (typeof memory.rooms !== "object" || Array.isArray(memory.rooms)) {
      result.issuesFound.push("Memory.rooms is not a valid object");
      if (this.config.autoRepair) {
        memory.rooms = {};
        result.issuesRepaired.push("Reset Memory.rooms to empty object");
      }
      result.isHealthy = false;
    }
  }

  /**
   * Validate and repair Memory.respawn structure
   */
  private validateAndRepairRespawn(memory: Memory, result: HealthCheckResult): void {
    if (!memory.respawn) {
      result.issuesFound.push("Memory.respawn is missing");
      if (this.config.autoRepair) {
        memory.respawn = {
          needsRespawn: false,
          respawnRequested: false
        };
        result.issuesRepaired.push("Initialized Memory.respawn");
      }
      result.isHealthy = false;
      return;
    }

    if (typeof memory.respawn !== "object" || Array.isArray(memory.respawn)) {
      result.issuesFound.push("Memory.respawn is not a valid object");
      if (this.config.autoRepair) {
        memory.respawn = {
          needsRespawn: false,
          respawnRequested: false
        };
        result.issuesRepaired.push("Reset Memory.respawn to default state");
      }
      result.isHealthy = false;
      return;
    }

    // Validate respawn fields
    if (typeof memory.respawn.needsRespawn !== "boolean") {
      result.issuesFound.push("Memory.respawn.needsRespawn is not a boolean");
      if (this.config.autoRepair) {
        memory.respawn.needsRespawn = false;
        result.issuesRepaired.push("Reset Memory.respawn.needsRespawn to false");
      }
      result.isHealthy = false;
    }

    if (typeof memory.respawn.respawnRequested !== "boolean") {
      result.issuesFound.push("Memory.respawn.respawnRequested is not a boolean");
      if (this.config.autoRepair) {
        memory.respawn.respawnRequested = false;
        result.issuesRepaired.push("Reset Memory.respawn.respawnRequested to false");
      }
      result.isHealthy = false;
    }

    if (
      memory.respawn.lastSpawnLostTick !== undefined &&
      (typeof memory.respawn.lastSpawnLostTick !== "number" || !Number.isFinite(memory.respawn.lastSpawnLostTick))
    ) {
      result.issuesFound.push("Memory.respawn.lastSpawnLostTick is invalid");
      if (this.config.autoRepair) {
        memory.respawn.lastSpawnLostTick = undefined;
        result.issuesRepaired.push("Reset Memory.respawn.lastSpawnLostTick");
      }
      result.isHealthy = false;
    }
  }

  /**
   * Validate and repair Memory.stats structure
   */
  private validateAndRepairStats(memory: Memory, result: HealthCheckResult): void {
    if (!memory.stats) {
      // Stats can be missing initially, not an error
      return;
    }

    if (typeof memory.stats !== "object" || Array.isArray(memory.stats)) {
      result.issuesFound.push("Memory.stats is not a valid object");
      if (this.config.autoRepair) {
        delete memory.stats;
        result.issuesRepaired.push("Removed invalid Memory.stats");
      }
      result.isHealthy = false;
      return;
    }

    // Validate stats structure
    if (memory.stats.time !== undefined && typeof memory.stats.time !== "number") {
      result.issuesFound.push("Memory.stats.time is not a number");
      if (this.config.autoRepair) {
        delete memory.stats;
        result.issuesRepaired.push("Removed invalid Memory.stats");
      }
      result.isHealthy = false;
    }
  }

  /**
   * Validate and repair Memory.systemReport structure
   */
  private validateAndRepairSystemReport(memory: Memory, result: HealthCheckResult): void {
    if (!memory.systemReport) {
      // System report can be missing initially, not an error
      return;
    }

    if (typeof memory.systemReport !== "object" || Array.isArray(memory.systemReport)) {
      result.issuesFound.push("Memory.systemReport is not a valid object");
      if (this.config.autoRepair) {
        delete memory.systemReport;
        result.issuesRepaired.push("Removed invalid Memory.systemReport");
      }
      result.isHealthy = false;
      return;
    }

    // Validate systemReport structure
    if (memory.systemReport.lastGenerated !== undefined && typeof memory.systemReport.lastGenerated !== "number") {
      result.issuesFound.push("Memory.systemReport.lastGenerated is not a number");
      if (this.config.autoRepair) {
        delete memory.systemReport;
        result.issuesRepaired.push("Removed invalid Memory.systemReport");
      }
      result.isHealthy = false;
    }
  }

  /**
   * Validate and repair Memory.version field
   */
  private validateAndRepairVersion(memory: Memory, result: HealthCheckResult): void {
    if (memory.version !== undefined && typeof memory.version !== "number") {
      result.issuesFound.push("Memory.version is not a number");
      if (this.config.autoRepair) {
        delete memory.version;
        result.issuesRepaired.push("Removed invalid Memory.version (will be initialized by migration manager)");
      }
      result.isHealthy = false;
    }
  }

  /**
   * Perform emergency reset of memory to safe defaults.
   * Only use this as a last resort when memory is completely corrupted.
   */
  public emergencyReset(memory: Memory): void {
    this.logger.warn?.("[MemorySelfHealer] Performing emergency memory reset");

    // Clear all properties except version (for migration tracking)
    const version = memory.version;

    // Delete all properties
    for (const key in memory) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      delete (memory as any)[key];
    }

    // Restore safe defaults
    memory.version = version;
    memory.creeps = {};
    memory.roles = {};
    memory.rooms = {};
    memory.respawn = {
      needsRespawn: false,
      respawnRequested: false
    };

    this.logger.log("[MemorySelfHealer] Emergency reset complete. Memory restored to safe defaults.");
  }
}
