import { profile } from "@profiler";

/**
 * Migration handler function signature
 */
export type MigrationHandler = (memory: Memory) => void;

/**
 * Migration definition with version and handler
 */
export interface Migration {
  version: number;
  description: string;
  handler: MigrationHandler;
}

/**
 * Result of migration execution
 */
export interface MigrationResult {
  success: boolean;
  fromVersion: number;
  toVersion: number;
  migrationsApplied: number;
  errors: string[];
}

/**
 * Manages memory schema versioning and migrations across version updates.
 * Ensures backward compatibility and safe memory structure changes.
 */
@profile
export class MemoryMigrationManager {
  private readonly migrations: Map<number, Migration> = new Map();
  private readonly currentVersion: number;

  public constructor(
    currentVersion: number,
    private readonly logger: Pick<Console, "log" | "warn"> = console
  ) {
    this.currentVersion = currentVersion;
    this.registerBuiltInMigrations();
  }

  /**
   * Register a migration handler for a specific version
   */
  public registerMigration(migration: Migration): void {
    if (this.migrations.has(migration.version)) {
      this.logger.warn?.(`[Migration] Overwriting existing migration for version ${migration.version}`);
    }
    this.migrations.set(migration.version, migration);
  }

  /**
   * Execute pending migrations to bring memory to current version
   */
  public migrate(memory: Memory): MigrationResult {
    const currentMemoryVersion = memory.version ?? 0;
    const result: MigrationResult = {
      success: true,
      fromVersion: currentMemoryVersion,
      toVersion: this.currentVersion,
      migrationsApplied: 0,
      errors: []
    };

    // No migrations needed if already at current version
    if (currentMemoryVersion >= this.currentVersion) {
      return result;
    }

    this.logger.log(`[Migration] Starting migration from v${currentMemoryVersion} to v${this.currentVersion}`);

    // Apply migrations in order
    const migrationVersions = Array.from(this.migrations.keys())
      .filter(v => v > currentMemoryVersion && v <= this.currentVersion)
      .sort((a, b) => a - b);

    for (const version of migrationVersions) {
      const migration = this.migrations.get(version);
      if (!migration) {
        continue;
      }

      try {
        this.logger.log(`[Migration] Applying v${version}: ${migration.description}`);
        migration.handler(memory);
        result.migrationsApplied++;
      } catch (error) {
        const errorMsg = `Failed to apply migration v${version}: ${String(error)}`;
        this.logger.warn?.(`[Migration] ${errorMsg}`);
        result.errors.push(errorMsg);
        result.success = false;
        break;
      }
    }

    // Update memory version if successful
    if (result.success) {
      memory.version = this.currentVersion;
      this.logger.log(
        `[Migration] Successfully migrated to v${this.currentVersion} (${result.migrationsApplied} migrations applied)`
      );
    } else {
      this.logger.warn?.(`[Migration] Migration failed. Memory remains at v${currentMemoryVersion}`);
    }

    return result;
  }

  /**
   * Validate memory integrity after migration
   */
  public validateMemory(memory: Memory): boolean {
    try {
      // Check that memory has required version field
      if (typeof memory.version !== "number") {
        this.logger.warn?.("[Migration] Memory validation failed: missing or invalid version field");
        return false;
      }

      // Ensure memory can be serialized
      JSON.stringify(memory);

      return true;
    } catch (error) {
      this.logger.warn?.(`[Migration] Memory validation failed: ${String(error)}`);
      return false;
    }
  }

  /**
   * Register built-in migrations for known schema changes
   */
  private registerBuiltInMigrations(): void {
    // Migration 1: Initialize version field
    this.registerMigration({
      version: 1,
      description: "Initialize memory version tracking",
      handler: (memory: Memory) => {
        if (!memory.version) {
          memory.version = 1;
        }
      }
    });
  }

  /**
   * Get current migration status
   */
  public getStatus(memory: Memory): {
    currentVersion: number;
    memoryVersion: number;
    pendingMigrations: number;
    availableMigrations: number;
  } {
    const memoryVersion = memory.version ?? 0;
    const pendingMigrations = Array.from(this.migrations.keys()).filter(
      v => v > memoryVersion && v <= this.currentVersion
    ).length;

    return {
      currentVersion: this.currentVersion,
      memoryVersion,
      pendingMigrations,
      availableMigrations: this.migrations.size
    };
  }
}
