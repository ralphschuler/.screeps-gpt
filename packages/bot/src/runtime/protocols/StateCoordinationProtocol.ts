import { protocol } from "@ralphschuler/screeps-kernel";

/**
 * State coordination protocol interface for type safety.
 * Handles emergency coordination flags between processes.
 */
export interface IStateCoordinationProtocol {
  /**
   * Set the emergency reset flag to signal all processes to skip execution.
   * Used by MemoryProcess when memory corruption is detected.
   */
  setEmergencyReset(value: boolean): void;

  /**
   * Check if emergency reset flag is active.
   */
  isEmergencyReset(): boolean;

  /**
   * Set the respawn flag to signal respawn detection.
   * Used by RespawnProcess when respawn is detected.
   */
  setNeedsRespawn(value: boolean): void;

  /**
   * Check if respawn flag is active.
   */
  needsRespawn(): boolean;

  /**
   * Clear all coordination flags (should be called after processes handle them).
   */
  clearFlags(): void;
}

/**
 * Protocol for coordinating emergency state between processes.
 * Replaces Memory-based emergency flag communication.
 *
 * @example
 * // MemoryProcess sets emergency reset
 * ctx.protocol.setEmergencyReset(true);
 *
 * @example
 * // Other processes check flag
 * if (ctx.protocol.isEmergencyReset()) {
 *   return; // Skip execution
 * }
 */
@protocol({ name: "StateCoordinationProtocol" })
export class StateCoordinationProtocol implements IStateCoordinationProtocol {
  private emergencyReset = false;
  private needsRespawnFlag = false;

  public setEmergencyReset(value: boolean): void {
    this.emergencyReset = value;
  }

  public isEmergencyReset(): boolean {
    return this.emergencyReset;
  }

  public setNeedsRespawn(value: boolean): void {
    this.needsRespawnFlag = value;
  }

  public needsRespawn(): boolean {
    return this.needsRespawnFlag;
  }

  public clearFlags(): void {
    this.emergencyReset = false;
    this.needsRespawnFlag = false;
  }
}
