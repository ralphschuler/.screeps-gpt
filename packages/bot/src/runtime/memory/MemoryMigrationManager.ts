import { profile } from "@ralphschuler/screeps-profiler";

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
 * Backup snapshot of memory state before migration
 */
export interface MigrationBackup {
  version: number;
  timestamp: number;
  snapshot: string;
  checksum: string;
}

/**
 * Preview of migration changes without applying them
 */
export interface MigrationPreview {
  success: boolean;
  fromVersion: number;
  toVersion: number;
  migrationsToApply: number;
  error?: string;
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
   * Includes automatic backup and rollback on failure
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

    // Create backup before applying migrations
    const backup = this.createBackup(memory);

    try {
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

        // Validate memory after migration
        if (!this.validateMemory(memory)) {
          const errorMsg = "Memory validation failed after migration";
          this.logger.warn?.(`[Migration] ${errorMsg}`);
          result.errors.push(errorMsg);
          result.success = false;
          throw new Error(errorMsg);
        }

        this.logger.log(
          `[Migration] Successfully migrated to v${this.currentVersion} (${result.migrationsApplied} migrations applied)`
        );
      } else {
        // Rollback on migration failure
        this.rollback(memory, backup);
        this.logger.warn?.(
          `[Migration] Migration failed and was rolled back. Memory restored to v${currentMemoryVersion}`
        );
      }
    } catch (error) {
      // Rollback on any unexpected error
      this.rollback(memory, backup);
      const errorMsg = `Unexpected error during migration: ${String(error)}`;
      this.logger.warn?.(`[Migration] ${errorMsg}`);
      result.errors.push(errorMsg);
      result.success = false;
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
        memory.version ??= 1;
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

  /**
   * Create a backup snapshot of memory before migration
   */
  private createBackup(memory: Memory): MigrationBackup {
    const snapshot = JSON.stringify(memory);
    return {
      version: memory.version ?? 0,
      timestamp: typeof Game !== "undefined" ? Game.time : 0,
      snapshot,
      checksum: this.calculateChecksum(snapshot)
    };
  }

  /**
   * Restore memory from a backup snapshot
   */
  private rollback(memory: Memory, backup: MigrationBackup): void {
    try {
      // Parse and restore
      const restored = JSON.parse(backup.snapshot) as Memory;

      // Verify backup integrity by recalculating checksum from restored object
      const recalculatedChecksum = this.calculateChecksum(JSON.stringify(restored));
      if (recalculatedChecksum !== backup.checksum) {
        this.logger.warn?.("[Migration] Backup checksum mismatch after parsing, attempting restore anyway");
      }

      // Update memory in place to match restored backup
      // Assign/overwrite keys from restored
      Object.keys(restored).forEach(key => {
        (memory as Record<string, unknown>)[key] = (restored as Record<string, unknown>)[key];
      });
      // Delete keys not present in restored
      Object.keys(memory).forEach(key => {
        if (!(key in restored)) {
          delete (memory as Record<string, unknown>)[key];
        }
      });

      this.logger.log(`[Migration] Memory rolled back to v${backup.version} from tick ${backup.timestamp}`);
    } catch (error) {
      this.logger.warn?.(`[Migration] Failed to rollback memory: ${String(error)}`);
    }
  }

  /**
   * Calculate a simple checksum for backup verification
   */
  private calculateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char; // Bitwise ops ensure 32-bit signed integer overflow
    }
    return hash.toString(16);
  }

  /**
   * Preview migration changes without applying them
   * Useful for testing migrations before execution
   */
  public previewMigration(memory: Memory): MigrationPreview {
    const currentMemoryVersion = memory.version ?? 0;

    // Already at current version
    if (currentMemoryVersion >= this.currentVersion) {
      return {
        success: true,
        fromVersion: currentMemoryVersion,
        toVersion: this.currentVersion,
        migrationsToApply: 0
      };
    }

    // Count pending migrations
    const migrationsToApply = Array.from(this.migrations.keys()).filter(
      v => v > currentMemoryVersion && v <= this.currentVersion
    ).length;

    // Create a copy to test migrations
    const backup = this.createBackup(memory);

    try {
      const testMemory = JSON.parse(backup.snapshot) as Memory;

      // Apply migrations to test copy
      const migrationVersions = Array.from(this.migrations.keys())
        .filter(v => v > currentMemoryVersion && v <= this.currentVersion)
        .sort((a, b) => a - b);

      for (const version of migrationVersions) {
        const migration = this.migrations.get(version);
        if (!migration) {
          continue;
        }

        migration.handler(testMemory);
      }

      testMemory.version = this.currentVersion;

      // Validate test memory
      const isValid = this.validateMemory(testMemory);

      return {
        success: isValid,
        fromVersion: currentMemoryVersion,
        toVersion: this.currentVersion,
        migrationsToApply,
        error: isValid ? undefined : "Memory validation failed after preview"
      };
    } catch (error) {
      return {
        success: false,
        fromVersion: currentMemoryVersion,
        toVersion: this.currentVersion,
        migrationsToApply,
        error: String(error)
      };
    }
  }
}
