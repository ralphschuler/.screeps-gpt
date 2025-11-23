import { protocol } from "@ralphschuler/screeps-kernel";

/**
 * Health warning information.
 */
export interface HealthWarning {
  type: string;
  severity: string;
  message: string;
}

/**
 * Recovery state information.
 */
export interface RecoveryState {
  mode: string;
  actionsCount: number;
}

/**
 * Health metrics information.
 */
export interface HealthMetrics {
  score: number;
  state: string;
  metrics: Record<string, number>;
  timestamp: number;
  warnings: HealthWarning[];
  recovery: RecoveryState;
}

/**
 * Health monitoring protocol interface for type safety.
 * Handles health status and recovery coordination.
 */
export interface IHealthMonitoringProtocol {
  /**
   * Set health metrics (typically called by HealthProcess).
   * @param metrics - Health metrics data
   */
  setHealthMetrics(metrics: HealthMetrics): void;

  /**
   * Get health metrics.
   * @returns Health metrics or undefined if not set
   */
  getHealthMetrics(): HealthMetrics | undefined;

  /**
   * Get current health score.
   * @returns Health score (0-100) or undefined if not set
   */
  getHealthScore(): number | undefined;

  /**
   * Check if bot is in recovery mode.
   * @returns true if recovery mode is active
   */
  isInRecovery(): boolean;

  /**
   * Clear health metrics.
   */
  clearHealthMetrics(): void;
}

/**
 * Protocol for health monitoring and recovery coordination.
 * Replaces Memory.health communication pattern.
 *
 * @example
 * // HealthProcess stores metrics
 * ctx.protocol.setHealthMetrics({
 *   score: 85,
 *   state: 'healthy',
 *   metrics: { creeps: 10 },
 *   timestamp: Game.time,
 *   warnings: [],
 *   recovery: { mode: 'NORMAL', actionsCount: 0 }
 * });
 *
 * @example
 * // Other processes check health
 * const healthScore = ctx.protocol.getHealthScore();
 * if (ctx.protocol.isInRecovery()) { ... }
 */
@protocol({ name: "HealthMonitoringProtocol" })
export class HealthMonitoringProtocol implements IHealthMonitoringProtocol {
  private healthMetrics: HealthMetrics | undefined;

  public setHealthMetrics(metrics: HealthMetrics): void {
    this.healthMetrics = metrics;
  }

  public getHealthMetrics(): HealthMetrics | undefined {
    return this.healthMetrics;
  }

  public getHealthScore(): number | undefined {
    return this.healthMetrics?.score;
  }

  public isInRecovery(): boolean {
    const mode = this.healthMetrics?.recovery?.mode;
    return mode !== undefined && mode !== "NORMAL";
  }

  public clearHealthMetrics(): void {
    this.healthMetrics = undefined;
  }
}
