import type { RoomLike } from "@runtime/types/GameContext";
import { profile } from "@profiler";

/**
 * Threat level classification
 */
export type ThreatLevel = "none" | "low" | "medium" | "high" | "critical";

/**
 * Detected threat information
 */
export interface DetectedThreat {
  id: Id<Creep>;
  room: string;
  pos: { x: number; y: number };
  owner: string;
  bodyParts: {
    attack: number;
    rangedAttack: number;
    heal: number;
    work: number;
    tough: number;
  };
  threatScore: number;
  detectedAt: number;
}

/**
 * Room threat assessment
 */
export interface RoomThreatAssessment {
  roomName: string;
  threatLevel: ThreatLevel;
  hostileCount: number;
  totalThreatScore: number;
  threats: DetectedThreat[];
  assessedAt: number;
}

/**
 * Threat memory for persistence
 */
export interface ThreatMemory {
  rooms: Record<string, RoomThreatAssessment>;
  lastUpdate: number;
}

/**
 * Detects and assesses threats in rooms.
 * Scans for hostile creeps and calculates threat levels based on body composition.
 */
@profile
export class ThreatDetector {
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly memoryRef?: ThreatMemory;

  public constructor(
    logger: Pick<Console, "log" | "warn"> = console,
    memory?: ThreatMemory
  ) {
    this.logger = logger;
    this.memoryRef = memory;
  }

  /**
   * Scan a room for threats and update threat memory
   */
  public scanRoom(room: RoomLike, currentTick: number): RoomThreatAssessment {
    const hostiles = room.find(FIND_HOSTILE_CREEPS) as Creep[];
    
    const threats: DetectedThreat[] = hostiles.map(hostile => 
      this.analyzeHostile(hostile, room.name, currentTick)
    );

    const totalThreatScore = threats.reduce((sum, t) => sum + t.threatScore, 0);
    const threatLevel = this.calculateThreatLevel(hostiles.length, totalThreatScore);

    const assessment: RoomThreatAssessment = {
      roomName: room.name,
      threatLevel,
      hostileCount: hostiles.length,
      totalThreatScore,
      threats,
      assessedAt: currentTick
    };

    // Update memory if available
    if (this.memoryRef) {
      this.memoryRef.rooms[room.name] = assessment;
      this.memoryRef.lastUpdate = currentTick;
    }

    // Log threats if detected
    if (threatLevel !== "none") {
      this.logger.log?.(
        `[ThreatDetector] ${room.name}: ${threatLevel.toUpperCase()} threat - ` +
        `${hostiles.length} hostiles, score ${totalThreatScore}`
      );
    }

    return assessment;
  }

  /**
   * Analyze a hostile creep and calculate threat score
   */
  private analyzeHostile(hostile: Creep, roomName: string, tick: number): DetectedThreat {
    const bodyParts = {
      attack: 0,
      rangedAttack: 0,
      heal: 0,
      work: 0,
      tough: 0
    };

    // Count body parts
    for (const part of hostile.body) {
      if (part.type === ATTACK) bodyParts.attack++;
      if (part.type === RANGED_ATTACK) bodyParts.rangedAttack++;
      if (part.type === HEAL) bodyParts.heal++;
      if (part.type === WORK) bodyParts.work++;
      if (part.type === TOUGH) bodyParts.tough++;
    }

    // Calculate threat score
    let threatScore = 0;
    threatScore += bodyParts.attack * 10;      // Melee attackers
    threatScore += bodyParts.rangedAttack * 8; // Ranged attackers
    threatScore += bodyParts.heal * 12;        // Healers are high priority
    threatScore += bodyParts.work * 5;         // Dismantlers
    threatScore += bodyParts.tough * 2;        // Tanky creeps

    return {
      id: hostile.id,
      room: roomName,
      pos: { x: hostile.pos.x, y: hostile.pos.y },
      owner: hostile.owner?.username ?? "Unknown",
      bodyParts,
      threatScore,
      detectedAt: tick
    };
  }

  /**
   * Calculate threat level based on hostile count and threat score
   */
  private calculateThreatLevel(hostileCount: number, totalThreatScore: number): ThreatLevel {
    if (hostileCount === 0) {
      return "none";
    }

    // Critical: Many hostiles or very high threat score
    if (hostileCount >= 5 || totalThreatScore >= 300) {
      return "critical";
    }

    // High: Multiple hostiles or high threat score
    if (hostileCount >= 3 || totalThreatScore >= 150) {
      return "high";
    }

    // Medium: A few hostiles or moderate threat
    if (hostileCount >= 2 || totalThreatScore >= 50) {
      return "medium";
    }

    // Low: Single weak hostile
    return "low";
  }

  /**
   * Get threat assessment for a room from memory
   */
  public getThreatAssessment(roomName: string): RoomThreatAssessment | null {
    if (!this.memoryRef) {
      return null;
    }

    return this.memoryRef.rooms[roomName] ?? null;
  }

  /**
   * Check if a room has active threats
   */
  public hasActiveThreats(roomName: string, maxAge: number = 10): boolean {
    const assessment = this.getThreatAssessment(roomName);
    
    if (!assessment || assessment.threatLevel === "none") {
      return false;
    }

    // Check if assessment is recent (within maxAge ticks)
    const age = Game.time - assessment.assessedAt;
    return age <= maxAge;
  }

  /**
   * Clean up old threat data from memory
   */
  public cleanupOldThreats(currentTick: number, maxAge: number = 100): void {
    if (!this.memoryRef) {
      return;
    }

    for (const roomName in this.memoryRef.rooms) {
      const assessment = this.memoryRef.rooms[roomName];
      const age = currentTick - assessment.assessedAt;

      if (age > maxAge || assessment.threatLevel === "none") {
        delete this.memoryRef.rooms[roomName];
      }
    }
  }

  /**
   * Get all rooms with active threats
   */
  public getThreatenedRooms(): string[] {
    if (!this.memoryRef) {
      return [];
    }

    return Object.keys(this.memoryRef.rooms).filter(roomName => {
      const assessment = this.memoryRef.rooms[roomName];
      return assessment.threatLevel !== "none";
    });
  }
}
