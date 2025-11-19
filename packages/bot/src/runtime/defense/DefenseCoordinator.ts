import type { RoomLike } from "@runtime/types/GameContext";
import { profile } from "@profiler";
import { ThreatDetector, type RoomThreatAssessment, type ThreatLevel } from "./ThreatDetector";
import { TowerManager } from "./TowerManager";
import { CombatManager } from "./CombatManager";

/**
 * Defensive posture state
 */
export type DefensivePosture = "normal" | "alert" | "defensive" | "emergency";

/**
 * Defense coordination result
 */
export interface DefenseCoordinationResult {
  posture: DefensivePosture;
  towersEngaged: number;
  squadsDeployed: number;
  threatsNeutralized: number;
}

/**
 * Defense memory for coordination state
 */
export interface DefenseMemory {
  posture: Record<string, DefensivePosture>;
  lastDefenseAction: number;
}

/**
 * Coordinates defensive responses by integrating threat detection with tower and combat managers.
 * Implements defensive posture management and prioritizes defense over routine operations.
 */
@profile
export class DefenseCoordinator {
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly threatDetector: ThreatDetector;
  private readonly towerManager: TowerManager;
  private readonly combatManager: CombatManager;
  private readonly memoryRef?: DefenseMemory;

  public constructor(
    threatDetector: ThreatDetector,
    towerManager: TowerManager,
    combatManager: CombatManager,
    logger: Pick<Console, "log" | "warn"> = console,
    memory?: DefenseMemory
  ) {
    this.logger = logger;
    this.threatDetector = threatDetector;
    this.towerManager = towerManager;
    this.combatManager = combatManager;
    this.memoryRef = memory;
  }

  /**
   * Execute defense coordination for a room
   */
  public coordinateDefense(room: RoomLike, currentTick: number): DefenseCoordinationResult {
    // Scan for threats
    const threatAssessment = this.threatDetector.scanRoom(room, currentTick);

    // Determine defensive posture
    const posture = this.determinePosture(threatAssessment);
    
    // Store posture in memory
    if (this.memoryRef) {
      this.memoryRef.posture[room.name] = posture;
      if (posture !== "normal") {
        this.memoryRef.lastDefenseAction = currentTick;
      }
    }

    // Execute defensive actions
    const result: DefenseCoordinationResult = {
      posture,
      towersEngaged: 0,
      squadsDeployed: 0,
      threatsNeutralized: 0
    };

    if (threatAssessment.hostileCount > 0) {
      // Activate towers
      const towerActions = this.towerManager.run(room);
      result.towersEngaged = towerActions.attack;

      // Activate combat squads
      const combatResult = this.combatManager.run(room);
      result.squadsDeployed = combatResult.activeSquads;
      result.threatsNeutralized = combatResult.engagements;

      // Log defensive actions
      if (result.towersEngaged > 0 || result.squadsDeployed > 0) {
        this.logger.log?.(
          `[DefenseCoordinator] ${room.name}: ${posture.toUpperCase()} - ` +
          `Towers: ${result.towersEngaged}, Squads: ${result.squadsDeployed}, ` +
          `Engagements: ${result.threatsNeutralized}`
        );
      }
    }

    return result;
  }

  /**
   * Determine defensive posture based on threat assessment
   */
  private determinePosture(assessment: RoomThreatAssessment): DefensivePosture {
    switch (assessment.threatLevel) {
      case "critical":
        return "emergency";
      case "high":
        return "defensive";
      case "medium":
        return "alert";
      case "low":
        return "alert";
      case "none":
      default:
        return "normal";
    }
  }

  /**
   * Check if a room is in defensive mode
   */
  public isDefensiveModeActive(roomName: string): boolean {
    if (!this.memoryRef) {
      return false;
    }

    const posture = this.memoryRef.posture[roomName];
    return posture === "defensive" || posture === "emergency";
  }

  /**
   * Get current defensive posture for a room
   */
  public getPosture(roomName: string): DefensivePosture {
    if (!this.memoryRef) {
      return "normal";
    }

    return this.memoryRef.posture[roomName] ?? "normal";
  }

  /**
   * Check if controller upgrading should be paused
   */
  public shouldPauseUpgrading(roomName: string): boolean {
    const posture = this.getPosture(roomName);
    // Pause upgrading during defensive and emergency postures
    return posture === "defensive" || posture === "emergency";
  }

  /**
   * Check if defender spawning should be prioritized
   */
  public shouldPrioritizeDefenders(roomName: string): boolean {
    const posture = this.getPosture(roomName);
    // Prioritize defenders during alert, defensive, and emergency postures
    return posture !== "normal";
  }

  /**
   * Get threat level for a room
   */
  public getThreatLevel(roomName: string): ThreatLevel {
    const assessment = this.threatDetector.getThreatAssessment(roomName);
    return assessment?.threatLevel ?? "none";
  }

  /**
   * Get all rooms requiring defensive attention
   */
  public getThreatenedRooms(): string[] {
    return this.threatDetector.getThreatenedRooms();
  }
}
