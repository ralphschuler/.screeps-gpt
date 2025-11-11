import { profile } from "@profiler";

/**
 * Configuration for memory utilization monitoring
 */
export interface UtilizationMonitorConfig {
  /**
   * Warning threshold as percentage of estimated max memory (0-1)
   * @default 0.7
   */
  warningThreshold?: number;

  /**
   * Critical threshold as percentage of estimated max memory (0-1)
   * @default 0.9
   */
  criticalThreshold?: number;

  /**
   * Estimated maximum memory in bytes (Screeps limit is ~2MB)
   * @default 2097152 (2MB)
   */
  maxMemoryBytes?: number;
}

/**
 * Memory utilization snapshot
 */
export interface MemoryUtilization {
  currentBytes: number;
  maxBytes: number;
  usagePercent: number;
  isWarning: boolean;
  isCritical: boolean;
  subsystems: Record<string, number>;
}

/**
 * Monitors memory utilization and provides threshold alerts.
 * Helps prevent memory overflow through proactive monitoring.
 */
@profile
export class MemoryUtilizationMonitor {
  private readonly config: Required<UtilizationMonitorConfig>;

  public constructor(
    config: UtilizationMonitorConfig = {},
    private readonly logger: Pick<Console, "log" | "warn"> = console
  ) {
    this.config = {
      warningThreshold: config.warningThreshold ?? 0.7,
      criticalThreshold: config.criticalThreshold ?? 0.9,
      maxMemoryBytes: config.maxMemoryBytes ?? 2097152 // 2MB
    };
  }

  /**
   * Measure current memory utilization and check thresholds
   */
  public measure(memory: Memory): MemoryUtilization {
    const currentBytes = this.estimateMemorySize(memory);
    const usagePercent = currentBytes / this.config.maxMemoryBytes;

    const utilization: MemoryUtilization = {
      currentBytes,
      maxBytes: this.config.maxMemoryBytes,
      usagePercent,
      isWarning: usagePercent >= this.config.warningThreshold,
      isCritical: usagePercent >= this.config.criticalThreshold,
      subsystems: this.measureSubsystems(memory)
    };

    // Log warnings
    if (utilization.isCritical) {
      this.logger.warn?.(
        `[Memory] CRITICAL: Memory usage at ${(usagePercent * 100).toFixed(1)}% ` +
          `(${this.formatBytes(currentBytes)}/${this.formatBytes(this.config.maxMemoryBytes)})`
      );
    } else if (utilization.isWarning) {
      this.logger.warn?.(
        `[Memory] WARNING: Memory usage at ${(usagePercent * 100).toFixed(1)}% ` +
          `(${this.formatBytes(currentBytes)}/${this.formatBytes(this.config.maxMemoryBytes)})`
      );
    }

    return utilization;
  }

  /**
   * Check if there's sufficient memory capacity for an allocation
   */
  public canAllocate(memory: Memory, estimatedBytes: number): boolean {
    const currentBytes = this.estimateMemorySize(memory);
    const projectedUsage = (currentBytes + estimatedBytes) / this.config.maxMemoryBytes;

    if (projectedUsage >= this.config.criticalThreshold) {
      this.logger.warn?.(
        `[Memory] Cannot allocate ${this.formatBytes(estimatedBytes)}: would exceed critical threshold`
      );
      return false;
    }

    return true;
  }

  /**
   * Measure memory usage by subsystem
   */
  private measureSubsystems(memory: Memory): Record<string, number> {
    const subsystems: Record<string, number> = {};

    try {
      if (memory.creeps) {
        subsystems.creeps = JSON.stringify(memory.creeps).length;
      }
      if (memory.rooms) {
        subsystems.rooms = JSON.stringify(memory.rooms).length;
      }
      if (memory.stats) {
        subsystems.stats = JSON.stringify(memory.stats).length;
      }
      if (memory.systemReport) {
        subsystems.systemReport = JSON.stringify(memory.systemReport).length;
      }
      if (memory.roles) {
        subsystems.roles = JSON.stringify(memory.roles).length;
      }
      if (memory.respawn) {
        subsystems.respawn = JSON.stringify(memory.respawn).length;
      }
    } catch (error) {
      this.logger.warn?.(`[Memory] Error measuring subsystems: ${String(error)}`);
    }

    return subsystems;
  }

  /**
   * Estimate total memory size using JSON serialization
   */
  private estimateMemorySize(memory: Memory): number {
    try {
      return JSON.stringify(memory).length;
    } catch (error) {
      this.logger.warn?.(`[Memory] Failed to estimate memory size: ${String(error)}`);
      return 0;
    }
  }

  /**
   * Format bytes into human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }

  /**
   * Get memory budget recommendation for a subsystem
   */
  public getBudget(subsystem: string, memory: Memory): number {
    const utilization = this.measure(memory);
    const subsystemUsage = utilization.subsystems[subsystem] ?? 0;

    // If under warning threshold, allow liberal allocation
    if (!utilization.isWarning) {
      return this.config.maxMemoryBytes * 0.1; // 10% of total
    }

    // If at warning, be more conservative
    if (!utilization.isCritical) {
      return Math.max(subsystemUsage, this.config.maxMemoryBytes * 0.05); // 5% of total
    }

    // If critical, only allow current usage
    return subsystemUsage;
  }
}
