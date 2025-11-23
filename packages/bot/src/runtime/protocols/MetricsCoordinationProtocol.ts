import { protocol } from "@ralphschuler/screeps-kernel";

/**
 * Memory utilization metrics.
 */
export interface MemoryUtilization {
  used: number;
  limit: number;
  percentage: number;
}

/**
 * Metrics coordination protocol interface for type safety.
 * Handles performance and memory metrics coordination.
 */
export interface IMetricsCoordinationProtocol {
  /**
   * Set memory utilization metrics (typically called by MemoryProcess).
   * @param utilization - Memory utilization data
   */
  setMemoryUtilization(utilization: MemoryUtilization): void;

  /**
   * Get memory utilization metrics (typically read by MetricsProcess).
   * @returns Memory utilization or undefined if not set
   */
  getMemoryUtilization(): MemoryUtilization | undefined;

  /**
   * Clear memory utilization metrics.
   */
  clearMemoryUtilization(): void;
}

/**
 * Protocol for coordinating metrics data between processes.
 * Replaces Memory.memoryUtilization communication pattern.
 *
 * @example
 * // MemoryProcess stores utilization
 * ctx.protocol.setMemoryUtilization({ used: 1024, limit: 2048, percentage: 50 });
 *
 * @example
 * // MetricsProcess reads utilization
 * const utilization = ctx.protocol.getMemoryUtilization();
 */
@protocol({ name: "MetricsCoordinationProtocol" })
export class MetricsCoordinationProtocol implements IMetricsCoordinationProtocol {
  private memoryUtilization: MemoryUtilization | undefined;

  public setMemoryUtilization(utilization: MemoryUtilization): void {
    this.memoryUtilization = utilization;
  }

  public getMemoryUtilization(): MemoryUtilization | undefined {
    return this.memoryUtilization;
  }

  public clearMemoryUtilization(): void {
    this.memoryUtilization = undefined;
  }
}
