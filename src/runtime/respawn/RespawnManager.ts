import type { GameContext } from "@runtime/types/GameContext";

/**
 * Manages respawn detection and state when all spawns are lost.
 *
 * In Screeps, when a player loses all spawns, they must manually respawn through
 * the UI or API. This manager detects the condition and stores state in Memory
 * so external automation (like GitHub Actions) can trigger the respawn process.
 */
export class RespawnManager {
  public constructor(private readonly logger: Pick<Console, "log" | "warn"> = console) {}

  /**
   * Check if respawn is needed and update Memory state accordingly.
   *
   * @param game The current game context
   * @param memory The memory object
   * @returns true if respawn is needed, false otherwise
   */
  public checkRespawnNeeded(game: GameContext, memory: Memory): boolean {
    const hasSpawns = Object.keys(game.spawns).length > 0;
    const hasCreeps = Object.keys(game.creeps).length > 0;

    // Initialize respawn state if not present
    if (!memory.respawn) {
      memory.respawn = {
        needsRespawn: false,
        respawnRequested: false
      };
    }

    // If we have spawns, we're not in a respawn situation
    if (hasSpawns) {
      if (memory.respawn.needsRespawn) {
        this.logger.log?.("[respawn] Spawns detected, clearing respawn state");
      }
      memory.respawn.needsRespawn = false;
      memory.respawn.respawnRequested = false;
      memory.respawn.lastSpawnLostTick = undefined;
      return false;
    }

    // No spawns detected
    if (!memory.respawn.needsRespawn) {
      // First time detecting no spawns
      memory.respawn.needsRespawn = true;
      memory.respawn.lastSpawnLostTick = game.time;
      memory.respawn.respawnRequested = false;

      this.logger.warn?.(
        `[respawn] CRITICAL: All spawns lost at tick ${game.time}. Respawn needed. Creeps remaining: ${Object.keys(game.creeps).length}`
      );
    }

    // Check if we should log a reminder
    const ticksSinceLost = game.time - (memory.respawn.lastSpawnLostTick ?? game.time);
    if (ticksSinceLost > 0 && ticksSinceLost % 100 === 0) {
      this.logger.warn?.(
        `[respawn] Still waiting for respawn (${ticksSinceLost} ticks since spawn loss). Creeps: ${Object.keys(game.creeps).length}`
      );
    }

    // If we also have no creeps, the situation is more dire
    if (!hasCreeps && !memory.respawn.respawnRequested) {
      memory.respawn.respawnRequested = true;
      this.logger.warn?.(
        `[respawn] CRITICAL: No spawns and no creeps remaining. Immediate respawn required. Set Memory.respawn.respawnRequested = true`
      );
    }

    return true;
  }

  /**
   * Get a human-readable status message about the respawn state.
   */
  public getStatusMessage(memory: Memory, currentTick?: number): string {
    if (!memory.respawn || !memory.respawn.needsRespawn) {
      return "Spawns available - no respawn needed";
    }

    const ticksSinceLost =
      memory.respawn.lastSpawnLostTick && currentTick
        ? `${currentTick - memory.respawn.lastSpawnLostTick} ticks ago`
        : "unknown";

    if (memory.respawn.respawnRequested) {
      return `CRITICAL: Respawn urgently needed - no spawns or creeps (lost ${ticksSinceLost})`;
    }

    return `Respawn needed - all spawns lost (${ticksSinceLost})`;
  }
}
