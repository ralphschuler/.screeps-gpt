/**
 * Nuke System - Phase 11
 *
 * Detection, scoring, and execution of nuclear strikes.
 */

import type { SwarmState, OvermindMemory } from "../memory/schemas";
import { getConfig } from "../config";

/**
 * Get overmind memory
 */
function getOvermind(): OvermindMemory {
  const mem = Memory as unknown as Record<string, OvermindMemory>;
  return mem["overmind"]!;
}

// =============================================================================
// 11.1 Nuke Detection & Defense
// =============================================================================

/**
 * Detect incoming nukes in a room
 */
export function detectIncomingNukes(room: Room): Nuke[] {
  return room.find(FIND_NUKES);
}

/**
 * Handle incoming nuke detection
 */
export function handleNukeDetected(room: Room, swarm: SwarmState, nuke: Nuke): void {
  // Raise danger and siege
  swarm.danger = 3;
  swarm.posture = "siege";
  swarm.pheromones.siege = 100;
  swarm.pheromones.defense = 100;

  // Log event
  swarm.eventLog.push({
    type: "nukeDetected",
    time: Game.time,
    details: `Impact in ${nuke.timeToLand} ticks at ${nuke.pos.x},${nuke.pos.y}`
  });

  // Keep event log limited
  while (swarm.eventLog.length > 20) {
    swarm.eventLog.shift();
  }
}

/**
 * Get nuke impact zones
 */
export function getNukeImpactZones(nukes: Nuke[]): Array<{ pos: RoomPosition; radius: number; timeToImpact: number }> {
  return nukes.map(nuke => ({
    pos: nuke.pos,
    radius: 2, // Nuke affects 5x5 area
    timeToImpact: nuke.timeToLand
  }));
}

/**
 * Get structures in nuke blast zone
 */
export function getStructuresInBlastZone(room: Room, nukePos: RoomPosition, radius: number = 2): Structure[] {
  return room.find(FIND_STRUCTURES, {
    filter: s => s.pos.getRangeTo(nukePos) <= radius
  });
}

/**
 * Calculate rampart strengthening needed
 */
export function calculateRampartStrengthening(room: Room, nukes: Nuke[]): Array<{ rampart: StructureRampart; needed: number }> {
  const results: Array<{ rampart: StructureRampart; needed: number }> = [];

  // Nuke deals 10M damage to center, 5M to adjacent
  const centerDamage = 10000000;
  const adjacentDamage = 5000000;

  for (const nuke of nukes) {
    const ramparts = room.find(FIND_MY_STRUCTURES, {
      filter: s =>
        s.structureType === STRUCTURE_RAMPART && s.pos.getRangeTo(nuke.pos) <= 2
    }) as StructureRampart[];

    for (const rampart of ramparts) {
      const range = rampart.pos.getRangeTo(nuke.pos);
      const damage = range === 0 ? centerDamage : adjacentDamage;
      const needed = Math.max(0, damage - rampart.hits);

      if (needed > 0) {
        results.push({ rampart, needed });
      }
    }
  }

  return results;
}

/**
 * Prioritize nuke defense actions
 */
export function prioritizeNukeDefenseActions(room: Room, nukes: Nuke[]): Array<{ action: string; target: Structure | RoomPosition; priority: number }> {
  const actions: Array<{ action: string; target: Structure | RoomPosition; priority: number }> = [];

  for (const nuke of nukes) {
    // Priority 1: Strengthen ramparts protecting spawns
    const spawns = room.find(FIND_MY_SPAWNS);
    for (const spawn of spawns) {
      if (spawn.pos.getRangeTo(nuke.pos) <= 3) {
        const rampart = spawn.pos.lookFor(LOOK_STRUCTURES).find(s => s.structureType === STRUCTURE_RAMPART);
        if (rampart) {
          actions.push({
            action: "strengthenRampart",
            target: rampart,
            priority: 100
          });
        } else {
          actions.push({
            action: "buildRampart",
            target: spawn.pos,
            priority: 95
          });
        }
      }
    }

    // Priority 2: Protect storage
    if (room.storage && room.storage.pos.getRangeTo(nuke.pos) <= 3) {
      const rampart = room.storage.pos.lookFor(LOOK_STRUCTURES).find(s => s.structureType === STRUCTURE_RAMPART);
      if (rampart) {
        actions.push({
          action: "strengthenRampart",
          target: rampart,
          priority: 90
        });
      }
    }

    // Priority 3: Evacuate resources from blast zone
    const structuresInZone = getStructuresInBlastZone(room, nuke.pos);
    for (const s of structuresInZone) {
      if ("store" in s) {
        const storeStructure = s as AnyStoreStructure;
        if (storeStructure.store) {
          const usedCapacity = storeStructure.store.getUsedCapacity();
          if (usedCapacity !== null && usedCapacity > 0) {
            actions.push({
              action: "evacuateResources",
              target: s,
              priority: 80
            });
          }
        }
      }
    }
  }

  // Sort by priority
  actions.sort((a, b) => b.priority - a.priority);

  return actions;
}

// =============================================================================
// 11.2 Nuke Scoring & Target Selection
// =============================================================================

/**
 * Score enemy room for nuke targeting
 */
export function scoreNukeTarget(roomName: string, fromRoom: string): number {
  const config = getConfig().nuke;
  const overmind = getOvermind();
  const intel = overmind.roomIntel[roomName];

  if (!intel) return 0;

  let score = 0;

  // Enemy RCL contribution
  score += intel.controllerLevel * config.scoring.enemyRCLWeight;

  // War pheromone contribution
  const memRooms = (Memory as unknown as { rooms?: Record<string, { swarm?: SwarmState }> }).rooms;
  const swarm = memRooms?.[fromRoom]?.swarm;
  if (swarm) {
    score += swarm.pheromones.war * config.scoring.warPheromoneWeight;
  }

  // Distance penalty
  const distance = Game.map.getRoomLinearDistance(fromRoom, roomName);
  score -= distance * config.scoring.distancePenalty;

  // Hostile structures bonus
  // This would require more intel gathering
  if (intel.owner && intel.owner !== Game.spawns[Object.keys(Game.spawns)[0]!]?.owner.username) {
    score += config.scoring.hostileStructuresWeight * intel.controllerLevel;
  }

  return score;
}

/**
 * Update nuke candidates
 */
export function updateNukeCandidates(ownedRooms: string[]): void {
  const overmind = getOvermind();
  const config = getConfig().nuke;

  // Only run periodically
  if (Game.time % config.evaluationInterval !== 0) return;

  const candidates: Array<{ roomName: string; score: number; lastEvaluated: number }> = [];

  // Score war targets
  for (const targetName of overmind.warTargets) {
    // Find rooms owned by this player
    for (const [roomName, intel] of Object.entries(overmind.roomIntel)) {
      if (intel.owner !== targetName) continue;
      if (intel.controllerLevel < config.minEnemyRCL) continue;

      // Score from each owned room and take max
      let maxScore = 0;
      for (const ownedRoom of ownedRooms) {
        const score = scoreNukeTarget(roomName, ownedRoom);
        if (score > maxScore) {
          maxScore = score;
        }
      }

      if (maxScore > 0) {
        candidates.push({
          roomName,
          score: maxScore,
          lastEvaluated: Game.time
        });
      }
    }
  }

  // Sort by score and keep top 5
  candidates.sort((a, b) => b.score - a.score);
  overmind.nukeCandidates = candidates.slice(0, 5);
}

/**
 * Get best nuke target
 */
export function getBestNukeTarget(): { roomName: string; score: number } | null {
  const overmind = getOvermind();
  const config = getConfig().nuke;

  if (overmind.nukeCandidates.length === 0) return null;

  const best = overmind.nukeCandidates[0]!;

  // Check if score is high enough
  if (best.score < config.minNukeScore) return null;

  return best;
}

// =============================================================================
// 11.3 Nuke Execution
// =============================================================================

/**
 * Check if room has ready nuker
 */
export function hasReadyNuker(room: Room): boolean {
  const nuker = room.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_NUKER
  })[0] as StructureNuker | undefined;

  if (!nuker) return false;

  // Check if nuker is loaded
  if (nuker.store.getFreeCapacity(RESOURCE_ENERGY) > 0) return false;
  if (nuker.store.getFreeCapacity(RESOURCE_GHODIUM) > 0) return false;

  // Check cooldown
  if (nuker.cooldown > 0) return false;

  return true;
}

/**
 * Get nuker status
 */
export function getNukerStatus(room: Room): {
  hasNuker: boolean;
  energyFilled: number;
  ghodiumFilled: number;
  cooldown: number;
  ready: boolean;
} {
  const nuker = room.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_NUKER
  })[0] as StructureNuker | undefined;

  if (!nuker) {
    return {
      hasNuker: false,
      energyFilled: 0,
      ghodiumFilled: 0,
      cooldown: 0,
      ready: false
    };
  }

  const energyFilled = nuker.store.getUsedCapacity(RESOURCE_ENERGY) / nuker.store.getCapacity(RESOURCE_ENERGY);
  const ghodiumFilled = nuker.store.getUsedCapacity(RESOURCE_GHODIUM) / nuker.store.getCapacity(RESOURCE_GHODIUM);

  return {
    hasNuker: true,
    energyFilled,
    ghodiumFilled,
    cooldown: nuker.cooldown,
    ready: hasReadyNuker(room)
  };
}

/**
 * Check nuke launch preconditions
 */
export function canLaunchNuke(room: Room, targetRoom: string): { canLaunch: boolean; reason: string } {
  const config = getConfig().nuke;
  const overmind = getOvermind();

  // Check nuker ready
  if (!hasReadyNuker(room)) {
    return { canLaunch: false, reason: "Nuker not ready" };
  }

  // Check target intel
  const intel = overmind.roomIntel[targetRoom];
  if (!intel) {
    return { canLaunch: false, reason: "No intel on target room" };
  }

  // Check enemy RCL
  if (intel.controllerLevel < config.minEnemyRCL) {
    return { canLaunch: false, reason: `Target RCL too low (${intel.controllerLevel} < ${config.minEnemyRCL})` };
  }

  // Check distance (nuker range is 10 rooms)
  const distance = Game.map.getRoomLinearDistance(room.name, targetRoom);
  if (distance > 10) {
    return { canLaunch: false, reason: `Target too far (${distance} > 10)` };
  }

  // Check score threshold
  const score = scoreNukeTarget(targetRoom, room.name);
  if (score < config.minNukeScore) {
    return { canLaunch: false, reason: `Score too low (${score} < ${config.minNukeScore})` };
  }

  return { canLaunch: true, reason: "Ready to launch" };
}

/**
 * Select optimal nuke landing position
 */
export function selectNukeLandingPosition(targetRoom: string): RoomPosition | null {
  const overmind = getOvermind();
  const intel = overmind.roomIntel[targetRoom];

  if (!intel) return null;

  // We don't have detailed structure info, so target center
  // In a real implementation, we'd have scout data about spawn positions
  return new RoomPosition(25, 25, targetRoom);
}

/**
 * Launch nuke
 */
export function launchNuke(room: Room, targetPos: RoomPosition): number {
  const nuker = room.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_NUKER
  })[0] as StructureNuker | undefined;

  if (!nuker) return ERR_NOT_FOUND;

  return nuker.launchNuke(targetPos);
}

/**
 * Coordinate nuke with siege operations
 */
export function coordindateNukeWithSiege(targetRoom: string, impactTick: number): void {
  // Calculate when siege squad should arrive (just after impact)
  // arrivalTick = impactTick + 10 - used to time squad creation
  // This would trigger squad creation timed for arrival via strategic layer
  void targetRoom;
  void impactTick;
}

/**
 * Run nuke manager
 */
export function runNukeManager(ownedRooms: string[], swarms: Map<string, SwarmState>): void {
  // Update nuke candidates
  updateNukeCandidates(ownedRooms);

  // Check for incoming nukes
  for (const roomName of ownedRooms) {
    const room = Game.rooms[roomName];
    const swarm = swarms.get(roomName);
    if (!room || !swarm) continue;

    const nukes = detectIncomingNukes(room);
    for (const nuke of nukes) {
      handleNukeDetected(room, swarm, nuke);
    }
  }

  // Check if we should launch nukes
  const target = getBestNukeTarget();
  if (target) {
    for (const roomName of ownedRooms) {
      const room = Game.rooms[roomName];
      if (!room) continue;

      const { canLaunch } = canLaunchNuke(room, target.roomName);
      if (canLaunch) {
        const landingPos = selectNukeLandingPosition(target.roomName);
        if (landingPos) {
          const result = launchNuke(room, landingPos);
          if (result === OK) {
            // Calculate impact time (50000 ticks flight time)
            const impactTick = Game.time + 50000;
            coordindateNukeWithSiege(target.roomName, impactTick);
            break; // Only launch one nuke at a time
          }
        }
      }
    }
  }
}
