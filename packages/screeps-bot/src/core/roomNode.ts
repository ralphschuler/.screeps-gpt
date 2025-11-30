/**
 * Room Node - Per-room main loop
 *
 * Handles all per-room operations:
 * - Initialize/read RoomMemory.swarm
 * - Update metrics and pheromones
 * - Determine evolution stage and posture
 * - Run spawn logic
 * - Run creep role logic
 * - Run towers & structure control
 * - Run base construction
 */

import { type SwarmState } from "../memory/schemas";
import { memoryManager } from "../memory/manager";
import { pheromoneManager } from "../logic/pheromone";
import { evolutionManager, postureManager, calculateDangerLevel } from "../logic/evolution";
import { profiler } from "./profiler";

/**
 * Room node configuration
 */
export interface RoomNodeConfig {
  /** Enable pheromone updates */
  enablePheromones: boolean;
  /** Enable evolution updates */
  enableEvolution: boolean;
  /** Enable spawn logic */
  enableSpawning: boolean;
  /** Enable construction */
  enableConstruction: boolean;
  /** Enable tower control */
  enableTowers: boolean;
}

const DEFAULT_CONFIG: RoomNodeConfig = {
  enablePheromones: true,
  enableEvolution: true,
  enableSpawning: true,
  enableConstruction: true,
  enableTowers: true
};

/**
 * Room Node class - manages a single room
 */
export class RoomNode {
  public readonly roomName: string;
  private config: RoomNodeConfig;

  public constructor(roomName: string, config: Partial<RoomNodeConfig> = {}) {
    this.roomName = roomName;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main room tick
   */
  public run(totalOwnedRooms: number): void {
    const cpuStart = profiler.startRoom(this.roomName);

    const room = Game.rooms[this.roomName];
    if (!room || !room.controller?.my) {
      profiler.endRoom(this.roomName, cpuStart);
      return;
    }

    // Get or initialize swarm state
    const swarm = memoryManager.getOrInitSwarmState(this.roomName);

    // Update metrics
    if (this.config.enablePheromones) {
      pheromoneManager.updateMetrics(room, swarm);
    }

    // Update threat assessment
    this.updateThreatAssessment(room, swarm);

    // Update evolution stage
    if (this.config.enableEvolution) {
      evolutionManager.updateEvolutionStage(swarm, room, totalOwnedRooms);
      evolutionManager.updateMissingStructures(swarm, room);
    }

    // Update posture
    postureManager.updatePosture(swarm);

    // Update pheromones
    if (this.config.enablePheromones) {
      pheromoneManager.updatePheromones(swarm, room);
    }

    // Run spawn logic
    if (this.config.enableSpawning) {
      this.runSpawnLogic(room, swarm);
    }

    // Run tower control
    if (this.config.enableTowers) {
      this.runTowerControl(room, swarm);
    }

    // Run construction
    if (this.config.enableConstruction && postureManager.allowsBuilding(swarm.posture)) {
      this.runConstruction(room, swarm);
    }

    profiler.endRoom(this.roomName, cpuStart);
  }

  /**
   * Update threat assessment
   */
  private updateThreatAssessment(room: Room, swarm: SwarmState): void {
    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    const enemyStructures = room.find(FIND_HOSTILE_STRUCTURES, {
      filter: s => s.structureType !== STRUCTURE_CONTROLLER
    });

    // Calculate potential damage
    let potentialDamage = 0;
    for (const hostile of hostiles) {
      const attackParts = hostile.body.filter(p => p.type === ATTACK && p.hits > 0).length;
      const rangedParts = hostile.body.filter(p => p.type === RANGED_ATTACK && p.hits > 0).length;
      potentialDamage += attackParts * 30 + rangedParts * 10;
    }

    const newDanger = calculateDangerLevel(hostiles.length, potentialDamage, enemyStructures.length > 0);

    // Update danger and emit pheromone event if increased
    if (newDanger > swarm.danger) {
      pheromoneManager.onHostileDetected(swarm, hostiles.length, newDanger);
      memoryManager.addRoomEvent(this.roomName, "hostileDetected", `${hostiles.length} hostiles, danger=${newDanger}`);
    }

    swarm.danger = newDanger;
  }

  /**
   * Run spawn logic
   */
  private runSpawnLogic(_room: Room, _swarm: SwarmState): void {
    // Spawn logic will be implemented in roles module
    // For now, just a placeholder
  }

  /**
   * Run tower control
   */
  private runTowerControl(room: Room, swarm: SwarmState): void {
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_TOWER }
    }) as StructureTower[];

    if (towers.length === 0) return;

    // Find targets
    const hostiles = room.find(FIND_HOSTILE_CREEPS);

    for (const tower of towers) {
      if (tower.store.getUsedCapacity(RESOURCE_ENERGY) < 10) continue;

      // Priority 1: Attack hostiles
      if (hostiles.length > 0) {
        // Target priority: healers > ranged > melee > others
        const target = this.selectTowerTarget(hostiles);
        if (target) {
          tower.attack(target);
          continue;
        }
      }

      // Priority 2: Heal damaged creeps (only in non-siege)
      if (swarm.posture !== "siege") {
        const damaged = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
          filter: c => c.hits < c.hitsMax
        });
        if (damaged) {
          tower.heal(damaged);
          continue;
        }
      }

      // Priority 3: Repair structures (only in non-war postures)
      if (!postureManager.isCombatPosture(swarm.posture)) {
        const damaged = tower.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: s =>
            s.hits < s.hitsMax * 0.8 &&
            s.structureType !== STRUCTURE_WALL &&
            s.structureType !== STRUCTURE_RAMPART
        });
        if (damaged) {
          tower.repair(damaged);
        }
      }
    }
  }

  /**
   * Select tower attack target
   */
  private selectTowerTarget(hostiles: Creep[]): Creep | null {
    // Sort by priority: healers > boosted > ranged > melee > others
    const sorted = hostiles.sort((a, b) => {
      const scoreA = this.getHostilePriority(a);
      const scoreB = this.getHostilePriority(b);
      return scoreB - scoreA;
    });

    return sorted[0] ?? null;
  }

  /**
   * Get priority score for hostile targeting
   */
  private getHostilePriority(hostile: Creep): number {
    let score = 0;

    for (const part of hostile.body) {
      if (!part.hits) continue;

      switch (part.type) {
        case HEAL:
          score += 100;
          break;
        case RANGED_ATTACK:
          score += 50;
          break;
        case ATTACK:
          score += 40;
          break;
        case CLAIM:
          score += 60;
          break;
        case WORK:
          score += 30;
          break;
      }

      // Boosted parts are higher priority
      if (part.boost) {
        score += 20;
      }
    }

    return score;
  }

  /**
   * Run construction logic
   */
  private runConstruction(_room: Room, _swarm: SwarmState): void {
    // Construction logic will be implemented with blueprints
    // For now, just a placeholder
  }
}

/**
 * Room manager - orchestrates all room nodes
 */
export class RoomManager {
  private nodes: Map<string, RoomNode> = new Map();

  /**
   * Run all owned rooms
   */
  public run(): void {
    const ownedRooms = Object.values(Game.rooms).filter(r => r.controller?.my);
    const totalOwned = ownedRooms.length;

    // Ensure nodes exist for all owned rooms
    for (const room of ownedRooms) {
      if (!this.nodes.has(room.name)) {
        this.nodes.set(room.name, new RoomNode(room.name));
      }
    }

    // Clean up nodes for rooms we no longer own
    for (const [name] of this.nodes) {
      const room = Game.rooms[name];
      if (!room || !room.controller?.my) {
        this.nodes.delete(name);
      }
    }

    // Run each node
    for (const node of this.nodes.values()) {
      node.run(totalOwned);
    }
  }

  /**
   * Get node for a room
   */
  public getNode(roomName: string): RoomNode | undefined {
    return this.nodes.get(roomName);
  }

  /**
   * Get all nodes
   */
  public getAllNodes(): RoomNode[] {
    return Array.from(this.nodes.values());
  }
}

/**
 * Global room manager instance
 */
export const roomManager = new RoomManager();
