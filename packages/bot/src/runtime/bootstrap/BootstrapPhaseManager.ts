import { profile } from "@profiler";
import type { GameContext } from "@runtime/types/GameContext";

export interface BootstrapConfig {
  /** Controller level required to exit bootstrap phase (default: 2) */
  targetControllerLevel?: number;
  /** Minimum harvester count required to exit bootstrap (default: 4) */
  minHarvesterCount?: number;
  /** Minimum energy available to consider room stable (default: 300) */
  minEnergyAvailable?: number;
}

export interface BootstrapStatus {
  isActive: boolean;
  shouldTransition: boolean;
  reason?: string;
}

export interface RCLPhaseTransition {
  roomName: string;
  previousPhase: string | undefined;
  newPhase: "phase1" | "phase2" | "phase3" | "phase4" | "phase5";
  rclLevel: number;
  reason: string;
}

/**
 * Manages bootstrap phase detection and completion for first-room resource optimization.
 * Bootstrap phase prioritizes harvester spawning to quickly establish energy infrastructure.
 *
 * Entry Conditions:
 * - No bootstrap flag exists in Memory (first run)
 * - Room has minimal infrastructure (controller level < 2)
 *
 * Exit Conditions:
 * - Controller reaches target level (default: 2)
 * - Sufficient harvesters exist (default: 4)
 * - Energy infrastructure is stable (extensions available and filled)
 */
@profile
export class BootstrapPhaseManager {
  private readonly config: Required<BootstrapConfig>;
  private readonly logger: Pick<Console, "log" | "warn">;

  public constructor(config: BootstrapConfig = {}, logger: Pick<Console, "log" | "warn"> = console) {
    this.logger = logger;
    this.config = {
      targetControllerLevel: config.targetControllerLevel ?? 2,
      minHarvesterCount: config.minHarvesterCount ?? 4,
      minEnergyAvailable: config.minEnergyAvailable ?? 300
    };
  }

  /**
   * Check if bootstrap phase should be active based on current game state.
   * Initializes bootstrap tracking in Memory if not present.
   */
  public checkBootstrapStatus(game: GameContext, memory: Memory): BootstrapStatus {
    // Initialize bootstrap tracking if not present
    if (!memory.bootstrap) {
      const shouldStart = this.shouldStartBootstrap(game);
      memory.bootstrap = {
        isActive: shouldStart,
        startedAt: shouldStart ? game.time : undefined
      };

      if (shouldStart) {
        this.logger.log?.("[Bootstrap] Bootstrap phase activated - prioritizing harvester spawning");
      }
    }

    // If bootstrap was already completed, keep it inactive
    if (memory.bootstrap.completedAt !== undefined) {
      return {
        isActive: false,
        shouldTransition: false
      };
    }

    // Check if bootstrap phase should end
    if (memory.bootstrap.isActive) {
      const shouldComplete = this.shouldCompleteBootstrap(game, memory);
      if (shouldComplete.shouldComplete) {
        return {
          isActive: true,
          shouldTransition: true,
          reason: shouldComplete.reason
        };
      }
    }

    return {
      isActive: memory.bootstrap.isActive,
      shouldTransition: false
    };
  }

  /**
   * Complete bootstrap phase transition and update Memory.
   */
  public completeBootstrap(game: GameContext, memory: Memory, reason: string): void {
    if (!memory.bootstrap) {
      return;
    }

    memory.bootstrap.isActive = false;
    memory.bootstrap.completedAt = game.time;

    const duration = memory.bootstrap.startedAt ? game.time - memory.bootstrap.startedAt : 0;
    this.logger.log?.(
      `[Bootstrap] Bootstrap phase completed after ${duration} ticks. Reason: ${reason}. ` +
        `Transitioning to normal operations.`
    );
  }

  /**
   * Determine if bootstrap phase should start based on room state.
   */
  private shouldStartBootstrap(game: GameContext): boolean {
    const rooms = Object.values(game.rooms);
    if (rooms.length === 0) {
      return false;
    }

    // Bootstrap should start if we have a room with low controller level and minimal infrastructure
    const firstRoom = rooms.find(room => room.controller?.my);
    if (!firstRoom?.controller) {
      return false;
    }

    // Start bootstrap if controller is below target level
    return (firstRoom.controller.level ?? 0) < this.config.targetControllerLevel;
  }

  /**
   * Check if bootstrap phase completion criteria are met.
   */
  private shouldCompleteBootstrap(game: GameContext, memory: Memory): { shouldComplete: boolean; reason?: string } {
    const rooms = Object.values(game.rooms);
    if (rooms.length === 0) {
      return { shouldComplete: false };
    }

    const firstRoom = rooms.find(room => room.controller?.my);
    if (!firstRoom?.controller) {
      return { shouldComplete: false };
    }

    // Criteria 1: Controller level reached target
    const controllerLevel = firstRoom.controller.level ?? 0;
    if (controllerLevel >= this.config.targetControllerLevel) {
      return {
        shouldComplete: true,
        reason: `Controller reached level ${controllerLevel}`
      };
    }

    // Criteria 2: Sufficient harvesters + stable energy
    const harvesterCount = memory.roles?.harvester ?? 0;
    // energyAvailable is a Room property not in RoomLike, so we need to check it exists
    const roomWithEnergy = firstRoom as typeof firstRoom & {
      energyAvailable?: number;
      energyCapacityAvailable?: number;
    };
    const energyAvailable = roomWithEnergy.energyAvailable ?? 0;

    if (harvesterCount >= this.config.minHarvesterCount && energyAvailable >= this.config.minEnergyAvailable) {
      return {
        shouldComplete: true,
        reason: `Stable infrastructure: ${harvesterCount} harvesters, ${energyAvailable}/${roomWithEnergy.energyCapacityAvailable ?? 300} energy`
      };
    }

    return { shouldComplete: false };
  }

  /**
   * Get adjusted role minimums for bootstrap phase.
   * During bootstrap, heavily prioritize harvesters over other roles.
   */
  public getBootstrapRoleMinimums(isBootstrap: boolean): Record<string, number> {
    if (!isBootstrap) {
      return {};
    }

    // During bootstrap: 80%+ harvesters, minimal upgraders/builders
    return {
      harvester: 6, // Increased from default 4
      upgrader: 1, // Reduced from default 3
      builder: 0 // Reduced from default 2
    };
  }

  /**
   * Detect RCL phase transitions for all controlled rooms.
   * Activates Phase 2 (Core Framework) when RCL 4 is achieved.
   * Returns array of rooms that have transitioned to a new phase.
   */
  public detectRCLPhaseTransitions(game: GameContext, memory: Memory): RCLPhaseTransition[] {
    const transitions: RCLPhaseTransition[] = [];

    // Initialize rooms memory structure if not present
    if (!memory.rooms) {
      memory.rooms = {};
    }

    for (const roomName in game.rooms) {
      const room = game.rooms[roomName];
      if (!room.controller?.my) {
        continue;
      }

      const controller = room.controller;
      const rclLevel = controller.level ?? 0;

      // Initialize room memory if not present
      memory.rooms[roomName] ??= {};

      const roomMemory = memory.rooms[roomName];
      // Explicit check needed for TypeScript strict null checks
      if (!roomMemory) {
        continue;
      }
      const currentPhase = roomMemory.phase as "phase1" | "phase2" | "phase3" | "phase4" | "phase5" | undefined;
      const detectedLevel = (roomMemory.rclLevelDetected ?? 0) as number;

      // Detect phase based on RCL level
      let targetPhase: "phase1" | "phase2" | "phase3" | "phase4" | "phase5";
      let reason = "";

      if (rclLevel >= 8) {
        targetPhase = "phase5";
        reason = `RCL 8 achieved - Multi-room global optimization active`;
      } else if (rclLevel >= 6) {
        targetPhase = "phase4";
        reason = `RCL 6 achieved - Empire coordination active`;
      } else if (rclLevel >= 4) {
        targetPhase = "phase2";
        reason = `RCL 4 achieved - Core framework with storage and links activated`;
      } else if (rclLevel >= 3) {
        targetPhase = "phase1";
        reason = `RCL 3 achieved - Foundation phase with towers`;
      } else {
        targetPhase = "phase1";
        reason = `RCL ${rclLevel} - Foundation phase`;
      }

      // Check if phase transition occurred
      if (targetPhase !== currentPhase || rclLevel !== detectedLevel) {
        roomMemory.phase = targetPhase;
        roomMemory.rclLevelDetected = rclLevel;
        roomMemory.phaseActivatedAt = game.time;

        transitions.push({
          roomName,
          previousPhase: currentPhase as string | undefined,
          newPhase: targetPhase,
          rclLevel,
          reason
        });

        this.logger.log?.(
          `[Bootstrap] Room ${roomName}: ${currentPhase ?? "none"} → ${targetPhase} (RCL ${rclLevel}). ${reason}`
        );
      }
    }

    return transitions;
  }

  /**
   * Check if a room has storage built and operational.
   * Updates room memory to track storage status.
   */
  public checkStorageStatus(room: GameContext["rooms"][string], memory: Memory): boolean {
    const roomMemory = memory.rooms?.[room.name];
    if (!roomMemory) {
      return false;
    }
    const storage = room.storage;

    if (storage?.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) {
      if (!roomMemory.storageBuilt) {
        roomMemory.storageBuilt = true;
        this.logger.log?.(`[Bootstrap] Room ${room.name}: Storage operational with >10k energy`);
      }
      return true;
    }

    return false;
  }
}
