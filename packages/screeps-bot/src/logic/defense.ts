/**
 * Defense & War Logic - Phase 10
 *
 * Threat metrics, war economy escalation, tower control, defense coordination.
 */

import type { SwarmState, SquadMemory, OvermindMemory } from "../memory/schemas";
import { getConfig } from "../config";

/**
 * Get overmind memory
 */
function getOvermind(): OvermindMemory {
  const mem = Memory as unknown as Record<string, OvermindMemory>;
  return mem["overmind"]!;
}

/**
 * Get squads memory
 */
function getSquads(): Record<string, SquadMemory> {
  const mem = Memory as unknown as Record<string, Record<string, SquadMemory>>;
  if (!mem["squads"]) {
    mem["squads"] = {};
  }
  return mem["squads"];
}

// =============================================================================
// 10.1 Threat Metrics
// =============================================================================

/**
 * Compute threat level for a room
 */
export function computeThreatLevel(room: Room): 0 | 1 | 2 | 3 {
  const config = getConfig().war;
  const hostiles = room.find(FIND_HOSTILE_CREEPS);

  if (hostiles.length === 0) {
    return 0;
  }

  // Calculate total hostile damage potential
  let totalDamage = 0;
  for (const hostile of hostiles) {
    for (const part of hostile.body) {
      if (!part.hits) continue;
      if (part.type === ATTACK) {
        totalDamage += 30;
      } else if (part.type === RANGED_ATTACK) {
        totalDamage += 10;
      }
      // Boost multiplier
      if (part.boost) {
        totalDamage *= 2;
      }
    }
  }

  // Check for enemy structures
  const enemyStructures = room.find(FIND_HOSTILE_STRUCTURES, {
    filter: s => s.structureType !== STRUCTURE_CONTROLLER
  });

  // Determine threat level
  if (totalDamage >= config.dangerThresholds.level3DamageThreshold || enemyStructures.length > 0) {
    return 3;
  }

  if (
    totalDamage >= config.dangerThresholds.level2DamageThreshold ||
    hostiles.length >= config.dangerThresholds.level2HostileCount
  ) {
    return 2;
  }

  if (hostiles.length >= config.dangerThresholds.level1HostileCount) {
    return 1;
  }

  return 0;
}

/**
 * Update swarm danger level
 */
export function updateDangerLevel(room: Room, swarm: SwarmState): void {
  const newDanger = computeThreatLevel(room);

  // Only increase danger, let pheromone decay handle reduction
  if (newDanger > swarm.danger) {
    swarm.danger = newDanger;
  } else if (newDanger < swarm.danger && Game.time % 10 === 0) {
    // Gradually reduce danger
    swarm.danger = Math.max(0, swarm.danger - 1) as 0 | 1 | 2 | 3;
  }
}

// =============================================================================
// 10.2 War Economy Escalation
// =============================================================================

/**
 * Check if economy is stable enough for war
 */
export function isEconomyStableForWar(swarm: SwarmState): boolean {
  const config = getConfig().war;
  const ratio = swarm.metrics.energyHarvested / Math.max(1, swarm.metrics.energySpawning);
  return ratio >= config.economyStabilityRatio;
}

/**
 * Get war status for room
 */
export function getWarStatus(swarm: SwarmState): {
  atWar: boolean;
  canEscalate: boolean;
  suggestedPosture: string;
} {
  const config = getConfig().war;

  const atWar = swarm.danger >= 2 || swarm.pheromones.war > config.postureThresholds.warPosture;
  const canEscalate = isEconomyStableForWar(swarm);

  let suggestedPosture = "eco";

  if (swarm.danger >= 3) {
    suggestedPosture = "siege";
  } else if (swarm.danger >= 2 || swarm.pheromones.war > config.postureThresholds.warPosture) {
    suggestedPosture = canEscalate ? "war" : "defensive";
  } else if (swarm.pheromones.defense > config.postureThresholds.defensivePosture) {
    suggestedPosture = "defensive";
  }

  return { atWar, canEscalate, suggestedPosture };
}

/**
 * Update war targets
 */
export function updateWarTargets(swarm: SwarmState, room: Room): void {
  const overmind = getOvermind();
  const hostiles = room.find(FIND_HOSTILE_CREEPS);

  // Add hostile owners to war targets
  for (const hostile of hostiles) {
    const owner = hostile.owner.username;
    if (owner && !overmind.warTargets.includes(owner) && owner !== "Invader") {
      overmind.warTargets.push(owner);
    }
  }

  // Clean up old targets (not seen in 10000 ticks)
  // This would require tracking last seen time per target
}

// =============================================================================
// Tower Control
// =============================================================================

/**
 * Select tower target with priority
 */
export function selectTowerTarget(room: Room, tower: StructureTower): Creep | null {
  const hostiles = room.find(FIND_HOSTILE_CREEPS);
  if (hostiles.length === 0) return null;

  // Score hostiles
  const scored = hostiles.map(hostile => {
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

      if (part.boost) {
        score += 20;
      }
    }

    // Distance penalty (towers are more effective close up)
    const range = tower.pos.getRangeTo(hostile);
    score -= range;

    // Low HP bonus (finish them off)
    if (hostile.hits < hostile.hitsMax * 0.3) {
      score += 50;
    }

    return { hostile, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.hostile ?? null;
}

/**
 * Run tower control for a room
 */
export function runTowerControl(room: Room, swarm: SwarmState): void {
  const towers = room.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_TOWER
  }) as StructureTower[];

  if (towers.length === 0) return;

  const hostiles = room.find(FIND_HOSTILE_CREEPS);
  const inCombat = hostiles.length > 0;

  for (const tower of towers) {
    if (tower.store.getUsedCapacity(RESOURCE_ENERGY) < 10) continue;

    // Priority 1: Attack hostiles
    if (inCombat) {
      const target = selectTowerTarget(room, tower);
      if (target) {
        tower.attack(target);
        continue;
      }
    }

    // Priority 2: Heal damaged creeps (not in siege)
    if (swarm.posture !== "siege") {
      const damaged = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
        filter: c => c.hits < c.hitsMax
      });
      if (damaged) {
        tower.heal(damaged);
        continue;
      }
    }

    // Priority 3: Repair critical structures
    if (!inCombat) {
      const critical = tower.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: s =>
          (s.structureType === STRUCTURE_SPAWN ||
            s.structureType === STRUCTURE_STORAGE ||
            s.structureType === STRUCTURE_TOWER) &&
          s.hits < s.hitsMax * 0.5
      });
      if (critical) {
        tower.repair(critical);
        continue;
      }
    }

    // Priority 4: Repair roads/containers (only in peace)
    if (!inCombat && swarm.posture === "eco") {
      const damaged = tower.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: s =>
          (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_CONTAINER) && s.hits < s.hitsMax * 0.5
      });
      if (damaged) {
        tower.repair(damaged);
      }
    }
  }
}

// =============================================================================
// Squad Management
// =============================================================================

/**
 * Create a new squad
 */
export function createSquad(
  type: "harass" | "raid" | "siege" | "defense",
  rallyRoom: string,
  targetRooms: string[]
): SquadMemory {
  const squads = getSquads();
  const id = `squad_${Game.time}_${Math.floor(Math.random() * 1000)}`;

  const squad: SquadMemory = {
    id,
    type,
    members: [],
    rallyRoom,
    targetRooms,
    state: "gathering",
    timeBudget: 1500,
    createdAt: Game.time,
    retreatThreshold: 0.3
  };

  squads[id] = squad;
  return squad;
}

/**
 * Add member to squad
 */
export function addSquadMember(squadId: string, creepName: string): boolean {
  const squads = getSquads();
  const squad = squads[squadId];
  if (!squad) return false;

  if (!squad.members.includes(creepName)) {
    squad.members.push(creepName);
  }
  return true;
}

/**
 * Remove member from squad
 */
export function removeSquadMember(squadId: string, creepName: string): void {
  const squads = getSquads();
  const squad = squads[squadId];
  if (!squad) return;

  squad.members = squad.members.filter(m => m !== creepName);

  // Dissolve if empty
  if (squad.members.length === 0) {
    delete squads[squadId];
  }
}

/**
 * Get squad by ID
 */
export function getSquad(squadId: string): SquadMemory | undefined {
  return getSquads()[squadId];
}

/**
 * Update squad state
 */
export function updateSquadState(squadId: string): void {
  const squad = getSquad(squadId);
  if (!squad) return;

  // Check for dead members
  squad.members = squad.members.filter(name => Game.creeps[name]);

  // Dissolve if too few members or time budget exceeded
  if (squad.members.length < 2 || Game.time - squad.createdAt > squad.timeBudget) {
    squad.state = "dissolving";
  }
}

/**
 * Run squad manager
 */
export function runSquadManager(): void {
  const squads = getSquads();

  for (const squadId of Object.keys(squads)) {
    updateSquadState(squadId);
  }
}

// =============================================================================
// Defense Coordination
// =============================================================================

/**
 * Request reinforcements from cluster
 */
export function requestReinforcements(roomName: string, swarm: SwarmState): void {
  // This would signal to nearby rooms to send defenders
  // Implemented via pheromone diffusion and cluster logic
  swarm.pheromones.defense = Math.min(100, swarm.pheromones.defense + 30);
  swarm.pheromones.war = Math.min(100, swarm.pheromones.war + 20);
}

/**
 * Run defense manager for a room
 */
export function runDefenseManager(room: Room, swarm: SwarmState): void {
  // Update danger level
  updateDangerLevel(room, swarm);

  // Update war targets
  if (swarm.danger > 0) {
    updateWarTargets(swarm, room);
  }

  // Run tower control
  runTowerControl(room, swarm);

  // Request reinforcements if danger is high
  if (swarm.danger >= 2) {
    requestReinforcements(room.name, swarm);
  }
}

/**
 * Boost management - get required boosts for squad
 */
export function getRequiredBoostsForSquad(squadType: string): MineralBoostConstant[] {
  switch (squadType) {
    case "raid":
      return [
        "UH" as MineralBoostConstant, // Attack boost
        "LO" as MineralBoostConstant, // Heal boost
        "ZO" as MineralBoostConstant // Move boost
      ];
    case "siege":
      return [
        "UH" as MineralBoostConstant,
        "LO" as MineralBoostConstant,
        "GO" as MineralBoostConstant, // Tough boost
        "ZH" as MineralBoostConstant // Work boost (for dismantling)
      ];
    case "defense":
      return ["UH" as MineralBoostConstant, "LO" as MineralBoostConstant];
    default:
      return [];
  }
}

/**
 * Check if boosts are available
 */
export function areBoostsAvailable(room: Room, boosts: MineralBoostConstant[]): boolean {
  const terminal = room.terminal;
  const storage = room.storage;

  if (!terminal && !storage) return false;

  for (const boost of boosts) {
    const terminalAmount = terminal?.store.getUsedCapacity(boost) ?? 0;
    const storageAmount = storage?.store.getUsedCapacity(boost) ?? 0;
    const config = getConfig().boost;

    if (terminalAmount + storageAmount < config.minBoostAmount) {
      return false;
    }
  }

  return true;
}
