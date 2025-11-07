import type { RoomLike } from "@runtime/types/GameContext";
import { profile } from "@profiler";

/**
 * Squad composition
 */
export interface Squad {
  id: string;
  members: string[]; // Creep names
  role: "offense" | "defense" | "raid";
  targetRoom?: string;
  status: "forming" | "active" | "returning" | "disbanded";
  createdAt: number;
}

/**
 * Combat target
 */
export interface CombatTarget {
  id: Id<Creep | Structure>;
  room: string;
  threat: number;
  priority: number;
}

/**
 * Combat manager configuration
 */
export interface CombatManagerConfig {
  /** Logger for debugging */
  logger?: Pick<Console, "log" | "warn">;
}

/**
 * Manages combat operations including squad formation and coordination.
 * Handles offensive and defensive military operations.
 */
@profile
export class CombatManager {
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly squads: Map<string, Squad> = new Map();
  private readonly combatTargets: Map<string, CombatTarget[]> = new Map();

  public constructor(config: CombatManagerConfig = {}) {
    this.logger = config.logger ?? console;
  }

  /**
   * Execute combat logic for a room
   */
  public run(room: RoomLike): {
    squads: number;
    activeSquads: number;
    engagements: number;
  } {
    // Update squad status
    this.updateSquads();

    // Identify threats
    const threats = this.identifyThreats(room);
    if (threats.length > 0) {
      this.setCombatTargets(room.name, threats);
    }

    // Command squads
    const engagements = this.commandSquads(room);

    const activeSquads = Array.from(this.squads.values()).filter(s => s.status === "active").length;

    return {
      squads: this.squads.size,
      activeSquads,
      engagements
    };
  }

  /**
   * Identify threats in a room
   */
  private identifyThreats(room: RoomLike): CombatTarget[] {
    const threats: CombatTarget[] = [];

    // Find hostile creeps
    const hostiles = room.find(FIND_HOSTILE_CREEPS) as Creep[];
    for (const hostile of hostiles) {
      const threat = this.calculateThreat(hostile);
      threats.push({
        id: hostile.id,
        room: room.name,
        threat,
        priority: threat * 10
      });
    }

    // Find hostile structures (towers, spawns)
    const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES, {
      filter: (s: Structure) => s.structureType === STRUCTURE_TOWER || s.structureType === STRUCTURE_SPAWN
    }) as Structure[];

    for (const structure of hostileStructures) {
      threats.push({
        id: structure.id,
        room: room.name,
        threat: 50,
        priority: 100
      });
    }

    return threats;
  }

  /**
   * Calculate threat level of a creep
   */
  private calculateThreat(creep: Creep): number {
    let threat = 0;

    for (const part of creep.body) {
      if (part.type === ATTACK) threat += 10;
      if (part.type === RANGED_ATTACK) threat += 5;
      if (part.type === HEAL) threat += 8;
      if (part.type === TOUGH) threat += 2;
    }

    return threat;
  }

  /**
   * Set combat targets for a room
   */
  private setCombatTargets(roomName: string, targets: CombatTarget[]): void {
    this.combatTargets.set(roomName, targets);
  }

  /**
   * Command squads to engage targets
   */
  private commandSquads(room: RoomLike): number {
    const targets = this.combatTargets.get(room.name) ?? [];
    if (targets.length === 0) return 0;

    // Sort targets by priority
    targets.sort((a, b) => b.priority - a.priority);

    let engagements = 0;

    // Find squads in this room
    const localSquads = Array.from(this.squads.values()).filter(
      s => s.status === "active" && this.getSquadRoom(s) === room.name
    );

    for (const squad of localSquads) {
      const target = targets[0]; // Highest priority target
      if (!target) break;

      // Command squad members to engage
      for (const memberName of squad.members) {
        const creep = Game.creeps[memberName];
        if (!creep) continue;

        const targetObj = Game.getObjectById(target.id);
        if (!targetObj) continue;

        // Simple engagement logic
        if (creep.pos.getRangeTo(targetObj) > 3) {
          creep.moveTo(targetObj);
        } else {
          // Attack if in range
          if ("attack" in creep) {
            if (creep.pos.getRangeTo(targetObj) === 1) {
              if ("hits" in targetObj) {
                creep.attack(targetObj);
                engagements++;
              }
            }
          }
          if ("rangedAttack" in creep) {
            if (creep.pos.getRangeTo(targetObj) <= 3) {
              if ("hits" in targetObj) {
                creep.rangedAttack(targetObj);
                engagements++;
              }
            }
          }
        }
      }
    }

    return engagements;
  }

  /**
   * Get the room a squad is currently in
   */
  private getSquadRoom(squad: Squad): string | null {
    if (squad.members.length === 0) return null;

    const memberName = squad.members[0];
    if (!memberName) return null;

    const firstMember = Game.creeps[memberName];
    if (!firstMember) return null;
    return firstMember.room.name;
  }

  /**
   * Update squad status and remove dead squads
   */
  private updateSquads(): void {
    for (const [squadId, squad] of this.squads.entries()) {
      // Remove dead members
      squad.members = squad.members.filter(name => Game.creeps[name]);

      // Disband empty squads
      if (squad.members.length === 0) {
        squad.status = "disbanded";
        this.squads.delete(squadId);
      }
    }
  }

  /**
   * Create a new squad
   */
  public createSquad(members: string[], role: "offense" | "defense" | "raid", targetRoom?: string): string {
    const squadId = `squad_${Game.time}_${members[0] ?? "default"}`;
    this.squads.set(squadId, {
      id: squadId,
      members,
      role,
      targetRoom,
      status: "forming",
      createdAt: Game.time
    });

    return squadId;
  }

  /**
   * Activate a squad
   */
  public activateSquad(squadId: string): void {
    const squad = this.squads.get(squadId);
    if (squad) {
      squad.status = "active";
    }
  }

  /**
   * Disband a squad
   */
  public disbandSquad(squadId: string): void {
    const squad = this.squads.get(squadId);
    if (squad) {
      squad.status = "disbanded";
      this.squads.delete(squadId);
    }
  }
}
