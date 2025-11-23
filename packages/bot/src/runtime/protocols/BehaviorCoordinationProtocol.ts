import { protocol } from "@ralphschuler/screeps-kernel";
import type { BehaviorSummary } from "@shared/contracts";

/**
 * Behavior coordination protocol interface for type safety.
 * Handles behavior execution summaries and coordination.
 */
export interface IBehaviorCoordinationProtocol {
  /**
   * Set behavior summary (typically called by BehaviorProcess).
   * @param summary - Behavior execution summary
   */
  setBehaviorSummary(summary: BehaviorSummary): void;

  /**
   * Get behavior summary (typically read by MetricsProcess).
   * @returns Behavior summary or undefined if not set
   */
  getBehaviorSummary(): BehaviorSummary | undefined;

  /**
   * Clear behavior summary.
   */
  clearBehaviorSummary(): void;
}

/**
 * Protocol for coordinating behavior execution data between processes.
 * Replaces Memory.behaviorSummary communication pattern.
 *
 * @example
 * // BehaviorProcess stores summary
 * ctx.protocol.setBehaviorSummary({
 *   processedCreeps: 5,
 *   spawnedCreeps: ['harvester1'],
 *   tasksExecuted: { harvest: 10 }
 * });
 *
 * @example
 * // MetricsProcess reads summary
 * const summary = ctx.protocol.getBehaviorSummary();
 */
@protocol({ name: "BehaviorCoordinationProtocol" })
export class BehaviorCoordinationProtocol implements IBehaviorCoordinationProtocol {
  private behaviorSummary: BehaviorSummary | undefined;

  public setBehaviorSummary(summary: BehaviorSummary): void {
    this.behaviorSummary = summary;
  }

  public getBehaviorSummary(): BehaviorSummary | undefined {
    return this.behaviorSummary;
  }

  public clearBehaviorSummary(): void {
    this.behaviorSummary = undefined;
  }
}
