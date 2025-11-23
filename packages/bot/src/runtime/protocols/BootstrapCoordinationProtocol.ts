import { protocol } from "@ralphschuler/screeps-kernel";

/**
 * Bootstrap status information.
 */
export interface BootstrapStatus {
  isActive: boolean;
  phase?: string;
  progress?: number;
}

/**
 * Bootstrap coordination protocol interface for type safety.
 * Handles bootstrap phase coordination and status.
 */
export interface IBootstrapCoordinationProtocol {
  /**
   * Set bootstrap status (typically called by BootstrapProcess).
   * @param status - Bootstrap status information
   */
  setBootstrapStatus(status: BootstrapStatus): void;

  /**
   * Get bootstrap status (typically read by BehaviorProcess).
   * @returns Bootstrap status or undefined if not set
   */
  getBootstrapStatus(): BootstrapStatus | undefined;

  /**
   * Check if bootstrap is currently active.
   * @returns true if bootstrap is active
   */
  isBootstrapActive(): boolean;

  /**
   * Get bootstrap role minimums for spawning.
   * @returns Role minimums object or empty object if bootstrap not active
   */
  getBootstrapMinimums(): Record<string, number>;

  /**
   * Clear bootstrap status.
   */
  clearBootstrapStatus(): void;
}

/**
 * Protocol for coordinating bootstrap phase between processes.
 * Replaces Memory.bootstrapStatus communication pattern.
 *
 * @example
 * // BootstrapProcess updates status
 * ctx.protocol.setBootstrapStatus({ isActive: true, phase: 'initial' });
 *
 * @example
 * // BehaviorProcess checks bootstrap
 * if (ctx.protocol.isBootstrapActive()) {
 *   const minimums = ctx.protocol.getBootstrapMinimums();
 * }
 */
@protocol({ name: "BootstrapCoordinationProtocol" })
export class BootstrapCoordinationProtocol implements IBootstrapCoordinationProtocol {
  private bootstrapStatus: BootstrapStatus | undefined;

  public setBootstrapStatus(status: BootstrapStatus): void {
    this.bootstrapStatus = status;
  }

  public getBootstrapStatus(): BootstrapStatus | undefined {
    return this.bootstrapStatus;
  }

  public isBootstrapActive(): boolean {
    return this.bootstrapStatus?.isActive ?? false;
  }

  public getBootstrapMinimums(): Record<string, number> {
    if (!this.isBootstrapActive()) {
      return {};
    }
    // Return standard bootstrap minimums
    return {
      harvester: 2,
      upgrader: 1,
      builder: 1
    };
  }

  public clearBootstrapStatus(): void {
    this.bootstrapStatus = undefined;
  }
}
