/**
 * Expansion Logic - Phase 9
 *
 * Room scoring, claim queue, remote mining, mineral harvesting, deposit operations.
 */

import type { SwarmState, ExpansionCandidate, RoomIntel, OvermindMemory } from "../memory/schemas";
import { getConfig } from "../config";

/**
 * Get overmind memory
 */
function getOvermind(): OvermindMemory {
  const mem = Memory as unknown as Record<string, OvermindMemory>;
  return mem["overmind"]!;
}

// =============================================================================
// 9.1 Room Scoring & Claim Queue
// =============================================================================

/**
 * Score a room for expansion potential
 */
export function scoreRoomForExpansion(intel: RoomIntel, fromRoom: string): number {
  const config = getConfig().expansion;
  let score = 0;

  // Source count
  score += intel.sources * config.scoring.sourcesWeight;

  // Mineral type bonus (valuable minerals)
  if (intel.mineralType) {
    const valuableMinerals = ["X", "O", "H", "K", "Z", "U", "L"];
    if (valuableMinerals.includes(intel.mineralType as string)) {
      score += config.scoring.mineralWeight;
    }
  }

  // Highway bonus (access to deposits/power banks)
  if (intel.isHighway) {
    score += config.scoring.highwayBonus;
  }

  // Distance penalty
  const distance = Game.map.getRoomLinearDistance(fromRoom, intel.name);
  score -= distance * config.scoring.distancePenalty;

  // Hostile penalty
  if (intel.threatLevel > 0) {
    score -= intel.threatLevel * config.scoring.hostilePenalty;
  }

  // Owner penalty (already owned)
  if (intel.owner) {
    score -= 100;
  }

  // SK room penalty
  if (intel.isSK) {
    score -= 20;
  }

  // Terrain penalty
  if (intel.terrain === "swamp") {
    score -= config.scoring.terrainPenalty * 2;
  }

  return Math.max(0, score);
}

/**
 * Update claim queue with expansion candidates
 */
export function updateClaimQueue(ownedRooms: string[]): void {
  const overmind = getOvermind();
  const config = getConfig().expansion;

  // Find best room to score from
  const coreRoom = ownedRooms[0] ?? "W0N0";

  // Score all known rooms
  const candidates: ExpansionCandidate[] = [];

  for (const [roomName, intel] of Object.entries(overmind.roomIntel)) {
    // Skip owned rooms
    if (intel.owner === Game.spawns[Object.keys(Game.spawns)[0]!]?.owner.username) {
      continue;
    }

    // Skip if too far
    const distance = Game.map.getRoomLinearDistance(coreRoom, roomName);
    if (distance > config.maxClaimDistance) {
      continue;
    }

    // Score room
    const score = scoreRoomForExpansion(intel, coreRoom);
    if (score > 0) {
      candidates.push({
        roomName,
        score,
        distance,
        claimed: false,
        lastEvaluated: Game.time
      });
    }
  }

  // Sort by score
  candidates.sort((a, b) => b.score - a.score);

  // Keep top 10
  overmind.claimQueue = candidates.slice(0, 10);
}

/**
 * Get next expansion target
 */
export function getNextExpansionTarget(): ExpansionCandidate | null {
  const overmind = getOvermind();
  const unclaimed = overmind.claimQueue.filter(c => !c.claimed);
  return unclaimed[0] ?? null;
}

/**
 * Mark room as claimed
 */
export function markRoomClaimed(roomName: string): void {
  const overmind = getOvermind();
  const candidate = overmind.claimQueue.find(c => c.roomName === roomName);
  if (candidate) {
    candidate.claimed = true;
  }
}

// =============================================================================
// 9.2 Claim / Reserve Flow
// =============================================================================

/**
 * Check if economy is stable enough for expansion
 */
export function isEconomyStableForExpansion(swarm: SwarmState): boolean {
  const config = getConfig();

  // Check energy surplus
  if (swarm.metrics.energyHarvested < config.expansion.minEnergySurplus) {
    return false;
  }

  // Check danger
  if (swarm.danger > 0) {
    return false;
  }

  // Check CPU bucket
  if (Game.cpu.bucket < config.expansion.minBucketForClaim) {
    return false;
  }

  return true;
}

/**
 * Decide whether to reserve or fully claim a room
 */
export function shouldFullyClaim(roomName: string, ownedRoomCount: number): boolean {
  // Full claim if we have few rooms
  if (ownedRoomCount < 3) {
    return true;
  }

  // Check GCL capacity
  if (ownedRoomCount >= Game.gcl.level) {
    return false; // Can't claim more rooms
  }

  // Check room potential
  const overmind = getOvermind();
  const intel = overmind.roomIntel[roomName];
  if (intel && intel.sources >= 2) {
    return true; // Good room, claim it
  }

  return false; // Otherwise just reserve
}

/**
 * Initialize claimed room
 */
export function initializeClaimedRoom(roomName: string, _clusterId: string): void {
  // Room memory will be initialized by RoomNode
  // Just update overmind tracking
  const overmind = getOvermind();
  markRoomClaimed(roomName);

  // Update room intel
  const intel = overmind.roomIntel[roomName];
  if (intel) {
    const firstSpawn = Game.spawns[Object.keys(Game.spawns)[0] ?? ""];
    if (firstSpawn) {
      intel.owner = firstSpawn.owner.username;
    }
  }
}

// =============================================================================
// 9.3 Remote Mining System
// =============================================================================

/**
 * Identify remote mining candidates
 */
export function identifyRemoteMiningCandidates(coreRoom: string): string[] {
  const config = getConfig().expansion;
  const overmind = getOvermind();
  const candidates: string[] = [];

  // Check adjacent rooms
  const exits = Game.map.describeExits(coreRoom);
  if (!exits) return candidates;

  for (const [, roomName] of Object.entries(exits)) {
    const distance = Game.map.getRoomLinearDistance(coreRoom, roomName);
    if (distance > config.maxRemoteDistance) continue;

    const intel = overmind.roomIntel[roomName];
    if (!intel) continue;

    // Skip owned/reserved by others
    if (intel.owner && intel.owner !== Game.spawns[Object.keys(Game.spawns)[0]!]?.owner.username) {
      continue;
    }

    // Skip SK rooms
    if (intel.isSK) continue;

    // Skip dangerous rooms
    if (intel.threatLevel >= 2) continue;

    // Good candidate
    if (intel.sources > 0) {
      candidates.push(roomName);
    }
  }

  return candidates;
}

/**
 * Calculate remote mining profitability
 */
export function calculateRemoteProfitability(
  remoteRoom: string,
  coreRoom: string,
  currentPerformance: { energyGained: number; energyLost: number }
): number {
  const netEnergy = currentPerformance.energyGained - currentPerformance.energyLost;
  const distance = Game.map.getRoomLinearDistance(coreRoom, remoteRoom);

  // Account for hauling cost
  const haulingCost = distance * 50; // Rough estimate

  return netEnergy - haulingCost;
}

/**
 * Get remote sources for a room
 */
export function getRemoteSources(remoteRoom: Room): Source[] {
  return remoteRoom.find(FIND_SOURCES);
}

// =============================================================================
// 9.4 Mineral Harvesting & Lab Integration
// =============================================================================

/**
 * Check if room can harvest minerals
 */
export function canHarvestMinerals(room: Room): boolean {
  // Need RCL 6+ for extractor
  if (!room.controller || room.controller.level < 6) {
    return false;
  }

  // Check for mineral
  const mineral = room.find(FIND_MINERALS)[0];
  if (!mineral) return false;

  // Check for extractor
  const extractor = mineral.pos.lookFor(LOOK_STRUCTURES).find(s => s.structureType === STRUCTURE_EXTRACTOR);
  if (!extractor) return false;

  // Check if mineral has resources
  return mineral.mineralAmount > 0;
}

/**
 * Get mineral info for room
 */
export function getMineralInfo(room: Room): { mineral: Mineral | null; extractor: StructureExtractor | null; amount: number; type: MineralConstant | null } {
  const mineral = room.find(FIND_MINERALS)[0] ?? null;

  if (!mineral) {
    return { mineral: null, extractor: null, amount: 0, type: null };
  }

  const extractor = mineral.pos.lookFor(LOOK_STRUCTURES).find(s => s.structureType === STRUCTURE_EXTRACTOR) as StructureExtractor | undefined;

  return {
    mineral,
    extractor: extractor ?? null,
    amount: mineral.mineralAmount,
    type: mineral.mineralType
  };
}

/**
 * Reaction recipes (base reactions)
 */
export const BASE_REACTIONS: Partial<Record<string, [MineralConstant | MineralCompoundConstant, MineralConstant | MineralCompoundConstant]>> = {
  [RESOURCE_HYDROXIDE]: [RESOURCE_HYDROGEN, RESOURCE_OXYGEN],
  [RESOURCE_ZYNTHIUM_KEANITE]: [RESOURCE_ZYNTHIUM, RESOURCE_KEANIUM],
  [RESOURCE_UTRIUM_LEMERGITE]: [RESOURCE_UTRIUM, RESOURCE_LEMERGIUM],
  // GHODIUM requires compound inputs, not base minerals
  [RESOURCE_GHODIUM]: [RESOURCE_ZYNTHIUM_KEANITE as MineralCompoundConstant, RESOURCE_UTRIUM_LEMERGITE as MineralCompoundConstant]
};

/**
 * Get lab network state
 */
export function getLabNetworkState(room: Room): {
  inputLabs: StructureLab[];
  outputLabs: StructureLab[];
  reactions: Array<{ input1: MineralConstant; input2: MineralConstant; output: MineralCompoundConstant }>;
} {
  const labs = room.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_LAB
  }) as StructureLab[];

  if (labs.length < 3) {
    return { inputLabs: [], outputLabs: [], reactions: [] };
  }

  // First 2 labs are input, rest are output
  const inputLabs = labs.slice(0, 2);
  const outputLabs = labs.slice(2);

  // Determine active reactions based on input lab contents
  const reactions: Array<{ input1: MineralConstant; input2: MineralConstant; output: MineralCompoundConstant }> = [];

  const input1Type = inputLabs[0]?.mineralType;
  const input2Type = inputLabs[1]?.mineralType;

  if (input1Type && input2Type) {
    // Find matching reaction
    for (const [output, reagents] of Object.entries(BASE_REACTIONS)) {
      if (!reagents) continue;
      const [r1, r2] = reagents;
      if ((input1Type === r1 && input2Type === r2) || (input1Type === r2 && input2Type === r1)) {
        reactions.push({
          input1: r1 as MineralConstant,
          input2: r2 as MineralConstant,
          output: output as MineralCompoundConstant
        });
        break;
      }
    }
  }

  return { inputLabs, outputLabs, reactions };
}

/**
 * Run lab reactions
 */
export function runLabReactions(room: Room): void {
  const { inputLabs, outputLabs, reactions } = getLabNetworkState(room);

  if (inputLabs.length < 2 || outputLabs.length === 0 || reactions.length === 0) {
    return;
  }

  const lab1 = inputLabs[0]!;
  const lab2 = inputLabs[1]!;

  // Run reaction in each output lab
  for (const outputLab of outputLabs) {
    if (outputLab.cooldown === 0) {
      outputLab.runReaction(lab1, lab2);
    }
  }
}

// =============================================================================
// 9.5 Deposit Harvesting & Factory Input
// =============================================================================

/**
 * Scan for deposits in highway rooms
 */
export function scanForDeposits(room: Room): Deposit[] {
  return room.find(FIND_DEPOSITS);
}

/**
 * Evaluate deposit profitability
 */
export function evaluateDepositProfitability(
  deposit: Deposit,
  homeRoom: string
): { profitable: boolean; score: number; reason: string } {
  // Calculate travel time
  const distance = Game.map.getRoomLinearDistance(homeRoom, deposit.room?.name ?? "");
  const travelTime = distance * 50; // Rough estimate

  // Check cooldown
  if (deposit.cooldown > 50) {
    return { profitable: false, score: 0, reason: "Cooldown too high" };
  }

  // Check remaining ticks
  if (deposit.ticksToDecay && deposit.ticksToDecay < travelTime * 2) {
    return { profitable: false, score: 0, reason: "Not enough time remaining" };
  }

  // Calculate expected yield
  const expectedYield = deposit.depositType ? 100 : 0; // Simplified

  // Score calculation
  const score = expectedYield - travelTime - deposit.cooldown;

  return {
    profitable: score > 0,
    score,
    reason: score > 0 ? "Profitable" : "Not profitable"
  };
}

/**
 * Get deposit harvesting targets
 */
export function getDepositTargets(homeRoom: string): Array<{ deposit: Deposit; score: number }> {
  const overmind = getOvermind();
  const targets: Array<{ deposit: Deposit; score: number }> = [];

  // Check known highway rooms
  for (const [roomName, intel] of Object.entries(overmind.roomIntel)) {
    if (!intel.isHighway) continue;

    const room = Game.rooms[roomName];
    if (!room) continue;

    const deposits = scanForDeposits(room);
    for (const deposit of deposits) {
      const { profitable, score } = evaluateDepositProfitability(deposit, homeRoom);
      if (profitable) {
        targets.push({ deposit, score });
      }
    }
  }

  // Sort by score
  targets.sort((a, b) => b.score - a.score);

  return targets;
}

/**
 * Deposit type to commodity mapping
 */
export const DEPOSIT_COMMODITIES: Record<string, ResourceConstant> = {
  [RESOURCE_METAL]: RESOURCE_ALLOY,
  [RESOURCE_SILICON]: RESOURCE_WIRE,
  [RESOURCE_BIOMASS]: RESOURCE_CELL,
  [RESOURCE_MIST]: RESOURCE_CONDENSATE
};

/**
 * Run expansion manager
 */
export function runExpansionManager(ownedRooms: string[], swarms: Map<string, SwarmState>): void {
  // Update claim queue periodically
  if (Game.time % 100 === 0) {
    updateClaimQueue(ownedRooms);
  }

  // Check if we should expand
  if (ownedRooms.length < Game.gcl.level) {
    const target = getNextExpansionTarget();
    if (target) {
      // Check if any room can support expansion
      for (const roomName of ownedRooms) {
        const swarm = swarms.get(roomName);
        if (swarm && isEconomyStableForExpansion(swarm)) {
          // Spawn claimer if not already spawned
          // This is handled by spawn logic checking strategic needs
          break;
        }
      }
    }
  }

  // Update remote mining for each room
  for (const roomName of ownedRooms) {
    const room = Game.rooms[roomName];
    const swarm = swarms.get(roomName);
    if (!room || !swarm) continue;

    // Run lab reactions
    if (room.controller && room.controller.level >= 6) {
      runLabReactions(room);
    }
  }
}
