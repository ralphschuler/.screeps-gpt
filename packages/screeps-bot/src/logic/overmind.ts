/**
 * Strategic Layer (Overmind) - Phase 14
 *
 * Empire-wide strategic decisions for expansion, war, and nukes.
 */

import type { SwarmState, OvermindMemory, ExpansionCandidate } from "../memory/schemas";
import { getConfig } from "../config";
import { updateClaimQueue, isEconomyStableForExpansion, getNextExpansionTarget } from "./expansion";
import { updateNukeCandidates, getBestNukeTarget } from "./nuke";

/**
 * Get overmind memory
 */
function getOvermind(): OvermindMemory {
  const mem = Memory as unknown as Record<string, OvermindMemory>;
  if (!mem["overmind"]) {
    mem["overmind"] = {
      roomsSeen: {},
      roomIntel: {},
      claimQueue: [],
      warTargets: [],
      nukeCandidates: [],
      powerBanks: [],
      objectives: {
        targetPowerLevel: 0,
        targetRoomCount: 1,
        warMode: false,
        expansionPaused: false
      },
      lastRun: 0
    };
  }
  return mem["overmind"];
}

// =============================================================================
// 14.1 Expansion Strategy
// =============================================================================

/**
 * Strategic expansion decision
 */
export interface ExpansionDecision {
  shouldExpand: boolean;
  target: ExpansionCandidate | null;
  action: "claim" | "reserve" | "hold";
  reason: string;
}

/**
 * Make expansion decision
 */
export function makeExpansionDecision(
  ownedRooms: string[],
  swarms: Map<string, SwarmState>
): ExpansionDecision {
  const overmind = getOvermind();
  const config = getConfig().expansion;

  // Check if expansion is paused
  if (overmind.objectives.expansionPaused) {
    return { shouldExpand: false, target: null, action: "hold", reason: "Expansion paused" };
  }

  // Check GCL capacity
  if (ownedRooms.length >= Game.gcl.level) {
    return { shouldExpand: false, target: null, action: "hold", reason: "At GCL capacity" };
  }

  // Check if target room count reached
  if (ownedRooms.length >= overmind.objectives.targetRoomCount) {
    return { shouldExpand: false, target: null, action: "hold", reason: "Target room count reached" };
  }

  // Check CPU bucket
  if (Game.cpu.bucket < config.minBucketForClaim) {
    return { shouldExpand: false, target: null, action: "hold", reason: "CPU bucket too low" };
  }

  // Check if any room has stable economy
  let hasStableEconomy = false;
  for (const roomName of ownedRooms) {
    const swarm = swarms.get(roomName);
    if (swarm && isEconomyStableForExpansion(swarm)) {
      hasStableEconomy = true;
      break;
    }
  }

  if (!hasStableEconomy) {
    return { shouldExpand: false, target: null, action: "hold", reason: "Economy not stable" };
  }

  // Check war mode
  if (overmind.objectives.warMode) {
    return { shouldExpand: false, target: null, action: "hold", reason: "War mode active" };
  }

  // Get expansion target
  const target = getNextExpansionTarget();
  if (!target) {
    return { shouldExpand: false, target: null, action: "hold", reason: "No suitable targets" };
  }

  // Determine claim vs reserve
  const shouldClaim = ownedRooms.length < 3 || target.score > 50;

  return {
    shouldExpand: true,
    target,
    action: shouldClaim ? "claim" : "reserve",
    reason: "Conditions met"
  };
}

/**
 * Update expansion targets
 */
export function updateExpansionTargets(ownedRooms: string[]): void {
  updateClaimQueue(ownedRooms);
}

/**
 * Set expansion objective
 */
export function setExpansionObjective(targetRoomCount: number): void {
  const overmind = getOvermind();
  overmind.objectives.targetRoomCount = targetRoomCount;
}

/**
 * Pause/resume expansion
 */
export function setExpansionPaused(paused: boolean): void {
  const overmind = getOvermind();
  overmind.objectives.expansionPaused = paused;
}

// =============================================================================
// 14.2 War Strategy
// =============================================================================

/**
 * Player relationship
 */
export interface PlayerRelationship {
  username: string;
  status: "neutral" | "ally" | "enemy" | "nap";
  lastEncounter: number;
  threatLevel: number;
  rooms: string[];
}

/**
 * Get player relationships
 */
function getPlayerRelationships(): Record<string, PlayerRelationship> {
  const mem = Memory as unknown as Record<string, Record<string, PlayerRelationship>>;
  if (!mem["relationships"]) {
    mem["relationships"] = {};
  }
  return mem["relationships"];
}

/**
 * Update player relationship
 */
export function updatePlayerRelationship(username: string, update: Partial<PlayerRelationship>): void {
  const relationships = getPlayerRelationships();

  if (!relationships[username]) {
    relationships[username] = {
      username,
      status: "neutral",
      lastEncounter: Game.time,
      threatLevel: 0,
      rooms: []
    };
  }

  Object.assign(relationships[username], update);
}

/**
 * Mark player as enemy
 */
export function markPlayerAsEnemy(username: string): void {
  const overmind = getOvermind();

  if (!overmind.warTargets.includes(username)) {
    overmind.warTargets.push(username);
  }

  updatePlayerRelationship(username, {
    status: "enemy",
    lastEncounter: Game.time
  });
}

/**
 * Remove player from enemies
 */
export function removePlayerFromEnemies(username: string): void {
  const overmind = getOvermind();
  overmind.warTargets = overmind.warTargets.filter(t => t !== username);

  updatePlayerRelationship(username, { status: "neutral" });
}

/**
 * Set war mode
 */
export function setWarMode(enabled: boolean): void {
  const overmind = getOvermind();
  overmind.objectives.warMode = enabled;
}

/**
 * Get war status
 */
export function getWarStatus(): {
  atWar: boolean;
  enemies: string[];
  warRooms: string[];
} {
  const overmind = getOvermind();

  // Find rooms belonging to enemies
  const warRooms: string[] = [];
  for (const [roomName, intel] of Object.entries(overmind.roomIntel)) {
    if (intel.owner && overmind.warTargets.includes(intel.owner)) {
      warRooms.push(roomName);
    }
  }

  return {
    atWar: overmind.objectives.warMode || overmind.warTargets.length > 0,
    enemies: overmind.warTargets,
    warRooms
  };
}

/**
 * Strategic war decision
 */
export interface WarDecision {
  shouldAttack: boolean;
  target: string | null;
  type: "harass" | "raid" | "siege" | "nuke";
  priority: number;
  reason: string;
}

/**
 * Make war decision
 */
export function makeWarDecision(
  ownedRooms: string[],
  swarms: Map<string, SwarmState>
): WarDecision {
  const overmind = getOvermind();

  // Check if we have enemies
  if (overmind.warTargets.length === 0) {
    return { shouldAttack: false, target: null, type: "harass", priority: 0, reason: "No enemies" };
  }

  // Check economy stability
  let totalEconomyHealth = 0;
  for (const roomName of ownedRooms) {
    const swarm = swarms.get(roomName);
    if (swarm) {
      const ratio = swarm.metrics.energyHarvested / Math.max(1, swarm.metrics.energySpawning);
      totalEconomyHealth += ratio;
    }
  }
  const avgEconomyHealth = totalEconomyHealth / ownedRooms.length;

  if (avgEconomyHealth < 1.2) {
    return { shouldAttack: false, target: null, type: "harass", priority: 0, reason: "Economy not stable" };
  }

  // Check nuke availability
  const nukeTarget = getBestNukeTarget();
  if (nukeTarget && nukeTarget.score > 50) {
    // Check if we have ready nuker
    for (const roomName of ownedRooms) {
      const room = Game.rooms[roomName];
      if (!room) continue;

      const nuker = room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_NUKER
      })[0] as StructureNuker | undefined;

      if (
        nuker &&
        nuker.store.getFreeCapacity(RESOURCE_ENERGY) === 0 &&
        nuker.store.getFreeCapacity(RESOURCE_GHODIUM) === 0 &&
        nuker.cooldown === 0
      ) {
        return {
          shouldAttack: true,
          target: nukeTarget.roomName,
          type: "nuke",
          priority: 100,
          reason: "Nuke target available"
        };
      }
    }
  }

  // Find best war target
  let bestTarget: string | null = null;
  let bestScore = 0;

  for (const [roomName, intel] of Object.entries(overmind.roomIntel)) {
    if (!intel.owner || !overmind.warTargets.includes(intel.owner)) continue;

    // Score based on RCL and distance
    let score = intel.controllerLevel * 10;

    // Distance penalty
    let minDistance = Infinity;
    for (const ownedRoom of ownedRooms) {
      const distance = Game.map.getRoomLinearDistance(ownedRoom, roomName);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }
    score -= minDistance * 5;

    if (score > bestScore) {
      bestScore = score;
      bestTarget = roomName;
    }
  }

  if (bestTarget && bestScore > 20) {
    // Determine attack type based on target RCL
    const intel = overmind.roomIntel[bestTarget];
    const type =
      intel && intel.controllerLevel >= 7 ? "siege" : intel && intel.controllerLevel >= 4 ? "raid" : "harass";

    return {
      shouldAttack: true,
      target: bestTarget,
      type,
      priority: bestScore,
      reason: "Strategic target identified"
    };
  }

  return { shouldAttack: false, target: null, type: "harass", priority: 0, reason: "No suitable targets" };
}

// =============================================================================
// 14.3 Nuke Strategy (Shard Level)
// =============================================================================

/**
 * Nuke coordination state
 */
export interface NukeCoordination {
  targetRoom: string;
  launchRoom: string;
  impactTick: number;
  siegeSquadNeeded: boolean;
  status: "fueling" | "ready" | "launched" | "impact";
}

/**
 * Get active nuke coordinations
 */
function getNukeCoordinations(): NukeCoordination[] {
  const mem = Memory as unknown as Record<string, NukeCoordination[]>;
  if (!mem["nukeCoordinations"]) {
    mem["nukeCoordinations"] = [];
  }
  return mem["nukeCoordinations"];
}

/**
 * Plan nuke strike
 */
export function planNukeStrike(targetRoom: string, launchRoom: string): NukeCoordination {
  const coordinations = getNukeCoordinations();

  const coordination: NukeCoordination = {
    targetRoom,
    launchRoom,
    impactTick: 0,
    siegeSquadNeeded: true,
    status: "fueling"
  };

  coordinations.push(coordination);
  return coordination;
}

/**
 * Update nuke coordination
 */
export function updateNukeCoordinations(): void {
  const coordinations = getNukeCoordinations();

  for (const coord of coordinations) {
    if (coord.status === "launched" && Game.time >= coord.impactTick) {
      coord.status = "impact";
    }
  }

  // Clean up completed coordinations
  const mem = Memory as unknown as Record<string, NukeCoordination[]>;
  mem["nukeCoordinations"] = coordinations.filter(c => c.status !== "impact");
}

// =============================================================================
// Strategic Layer Main Loop
// =============================================================================

/**
 * Run strategic layer
 */
export function runStrategicLayer(ownedRooms: string[], swarms: Map<string, SwarmState>): void {
  const overmind = getOvermind();

  // Only run periodically
  const config = getConfig().cpu;
  if (Game.time % config.taskFrequencies.strategicDecisions !== 0) {
    return;
  }

  // Update expansion targets
  if (Game.time % 100 === 0) {
    updateExpansionTargets(ownedRooms);
  }

  // Update nuke candidates
  updateNukeCandidates(ownedRooms);
  updateNukeCoordinations();

  // Make expansion decision
  const expansionDecision = makeExpansionDecision(ownedRooms, swarms);
  if (expansionDecision.shouldExpand && expansionDecision.target) {
    // Signal to spawn claimers
    // This is handled by checking overmind state in spawn logic
  }

  // Make war decision
  const warDecision = makeWarDecision(ownedRooms, swarms);
  if (warDecision.shouldAttack && warDecision.target) {
    // Signal to create squads or launch nukes
    if (warDecision.type === "nuke") {
      // Find room with ready nuker
      for (const roomName of ownedRooms) {
        const room = Game.rooms[roomName];
        if (!room) continue;

        const nuker = room.find(FIND_MY_STRUCTURES, {
          filter: s => s.structureType === STRUCTURE_NUKER
        })[0] as StructureNuker | undefined;

        if (
          nuker &&
          nuker.store.getFreeCapacity(RESOURCE_ENERGY) === 0 &&
          nuker.store.getFreeCapacity(RESOURCE_GHODIUM) === 0 &&
          nuker.cooldown === 0
        ) {
          planNukeStrike(warDecision.target, roomName);
          break;
        }
      }
    }
  }

  // Update overmind timestamp
  overmind.lastRun = Game.time;
}

/**
 * Get strategic status summary
 */
export function getStrategicStatus(): {
  expansion: { target: string | null; action: string };
  war: { atWar: boolean; enemies: string[]; targets: string[] };
  nukes: { candidates: number; activeStrikes: number };
  objectives: typeof getOvermind extends () => { objectives: infer T } ? T : never;
} {
  const overmind = getOvermind();
  const nukeCoords = getNukeCoordinations();

  return {
    expansion: {
      target: overmind.claimQueue[0]?.roomName ?? null,
      action: overmind.objectives.expansionPaused ? "paused" : "active"
    },
    war: {
      atWar: overmind.objectives.warMode,
      enemies: overmind.warTargets,
      targets: overmind.nukeCandidates.map(c => c.roomName)
    },
    nukes: {
      candidates: overmind.nukeCandidates.length,
      activeStrikes: nukeCoords.length
    },
    objectives: overmind.objectives
  };
}
