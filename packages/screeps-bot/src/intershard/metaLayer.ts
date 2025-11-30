/**
 * Multi-Shard Meta Layer - Phase 15
 *
 * Inter-shard coordination, portal handling, and cross-shard colonization.
 */

import type { SwarmState } from "../memory/schemas";
import {
  type InterShardMemorySchema,
  type ShardState,
  type ShardRole,
  type InterShardTask,
  type PortalInfo,
  createDefaultInterShardMemory,
  createDefaultShardState,
  serializeInterShardMemory,
  deserializeInterShardMemory,
  INTERSHARD_MEMORY_LIMIT
} from "./schema";

// =============================================================================
// InterShardMemory Access
// =============================================================================

let cachedInterShardMemory: InterShardMemorySchema | null = null;
let lastInterShardLoad = -1;

/**
 * Load InterShardMemory
 */
export function loadInterShardMemory(): InterShardMemorySchema {
  // Cache for 10 ticks
  if (cachedInterShardMemory && Game.time - lastInterShardLoad < 10) {
    return cachedInterShardMemory;
  }

  try {
    const raw = InterShardMemory.getLocal();
    if (raw) {
      const parsed = deserializeInterShardMemory(raw);
      if (parsed) {
        cachedInterShardMemory = parsed;
        lastInterShardLoad = Game.time;
        return parsed;
      }
    }
  } catch {
    console.log("Failed to load InterShardMemory");
  }

  cachedInterShardMemory = createDefaultInterShardMemory();
  lastInterShardLoad = Game.time;
  return cachedInterShardMemory;
}

/**
 * Save InterShardMemory
 */
export function saveInterShardMemory(memory: InterShardMemorySchema): boolean {
  try {
    const serialized = serializeInterShardMemory(memory);
    if (serialized.length > INTERSHARD_MEMORY_LIMIT) {
      console.log(`InterShardMemory too large: ${serialized.length}`);
      return false;
    }

    InterShardMemory.setLocal(serialized);
    cachedInterShardMemory = memory;
    memory.lastSync = Game.time;
    return true;
  } catch {
    console.log("Failed to save InterShardMemory");
    return false;
  }
}

/**
 * Get remote shard memory
 */
export function getRemoteShardMemory(shardName: string): InterShardMemorySchema | null {
  try {
    const raw = InterShardMemory.getRemote(shardName);
    if (raw) {
      return deserializeInterShardMemory(raw);
    }
  } catch {
    console.log(`Failed to load remote shard memory: ${shardName}`);
  }
  return null;
}

// =============================================================================
// 15.2 Meta-Layer Logic
// =============================================================================

/**
 * Calculate shard health from local state
 */
export function calculateShardHealth(ownedRooms: string[], swarms: Map<string, SwarmState>): ShardState["health"] {
  let totalEconomy = 0;
  let totalWar = 0;
  let totalRCL = 0;
  let totalCreeps = Object.keys(Game.creeps).length;

  for (const roomName of ownedRooms) {
    const swarm = swarms.get(roomName);
    const room = Game.rooms[roomName];

    if (swarm) {
      const economyRatio = swarm.metrics.energyHarvested / Math.max(1, swarm.metrics.energySpawning);
      totalEconomy += Math.min(100, economyRatio * 50);
      totalWar += swarm.pheromones.war;
    }

    if (room?.controller?.my) {
      totalRCL += room.controller.level;
    }
  }

  const avgEconomy = ownedRooms.length > 0 ? totalEconomy / ownedRooms.length : 0;
  const avgWar = ownedRooms.length > 0 ? totalWar / ownedRooms.length : 0;
  const avgRCL = ownedRooms.length > 0 ? totalRCL / ownedRooms.length : 0;

  // CPU category
  const cpuUsed = Game.cpu.getUsed();
  const cpuLimit = Game.cpu.limit;
  let cpuCategory: "low" | "medium" | "high" | "critical" = "low";
  if (cpuUsed > cpuLimit * 0.9) {
    cpuCategory = "critical";
  } else if (cpuUsed > cpuLimit * 0.7) {
    cpuCategory = "high";
  } else if (cpuUsed > cpuLimit * 0.5) {
    cpuCategory = "medium";
  }

  return {
    cpuCategory,
    economyIndex: avgEconomy,
    warIndex: avgWar,
    commodityIndex: 0, // Would need factory tracking
    roomCount: ownedRooms.length,
    avgRCL,
    creepCount: totalCreeps,
    lastUpdate: Game.time
  };
}

/**
 * Determine shard role based on state
 */
export function determineShardRole(health: ShardState["health"]): ShardRole {
  // War shard if high war index
  if (health.warIndex > 50) {
    return "war";
  }

  // Core shard if high RCL and economy
  if (health.avgRCL >= 7 && health.economyIndex > 60) {
    return "core";
  }

  // Resource shard if good economy but lower RCL
  if (health.economyIndex > 50 && health.avgRCL < 6) {
    return "resource";
  }

  // Frontier if few rooms
  if (health.roomCount < 3) {
    return "frontier";
  }

  // Backup otherwise
  return "backup";
}

/**
 * Update local shard state
 */
export function updateLocalShardState(ownedRooms: string[], swarms: Map<string, SwarmState>): ShardState {
  const memory = loadInterShardMemory();
  const shardName = Game.shard?.name ?? "shard0";

  // Get or create shard state
  if (!memory.shards[shardName]) {
    memory.shards[shardName] = createDefaultShardState(shardName);
  }

  const state = memory.shards[shardName]!;

  // Update health
  state.health = calculateShardHealth(ownedRooms, swarms);

  // Update role
  state.role = determineShardRole(state.health);

  // Save
  saveInterShardMemory(memory);

  return state;
}

/**
 * Rank shards by health
 */
export function rankShardsByHealth(): Array<{ shard: string; health: number }> {
  const memory = loadInterShardMemory();
  const rankings: Array<{ shard: string; health: number }> = [];

  for (const [shardName, state] of Object.entries(memory.shards)) {
    // Combined health score
    const health = state.health.economyIndex * 0.5 + (100 - state.health.warIndex) * 0.2 + state.health.avgRCL * 5;

    rankings.push({ shard: shardName, health });
  }

  rankings.sort((a, b) => b.health - a.health);
  return rankings;
}

/**
 * Assign high-level objectives per shard
 */
export function assignShardObjectives(): void {
  const memory = loadInterShardMemory();
  const rankings = rankShardsByHealth();

  if (rankings.length === 0) return;

  // Best shard is primary eco
  memory.globalTargets.primaryEcoShard = rankings[0]!.shard;

  // Find shard with highest war index for war role
  let maxWar = 0;
  let warShard: string | undefined;

  for (const [shardName, state] of Object.entries(memory.shards)) {
    if (state.health.warIndex > maxWar) {
      maxWar = state.health.warIndex;
      warShard = shardName;
    }
  }

  if (warShard && maxWar > 30) {
    memory.globalTargets.mainWarShard = warShard;
  }

  // Find shard for colonization (frontier with room)
  for (const [shardName, state] of Object.entries(memory.shards)) {
    if (state.role === "frontier" && state.health.roomCount < 5) {
      memory.globalTargets.colonizationTarget = shardName;
      break;
    }
  }

  saveInterShardMemory(memory);
}

// =============================================================================
// 15.3 Portal Handling & Colonization
// =============================================================================

/**
 * Detect inter-shard portals in a room
 */
export function detectPortals(room: Room): PortalInfo[] {
  const portals: PortalInfo[] = [];

  const portalStructures = room.find(FIND_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_PORTAL
  }) as StructurePortal[];

  for (const portal of portalStructures) {
    const dest = portal.destination;

    // Check if inter-shard portal
    if ("shard" in dest) {
      const portalInfo: PortalInfo = {
        sourceRoom: room.name,
        sourcePos: { x: portal.pos.x, y: portal.pos.y },
        targetShard: dest.shard,
        targetRoom: dest.room,
        threatRating: 0, // Would need scouting
        lastScouted: Game.time
      };

      // Only add decayTick if defined
      if (portal.ticksToDecay !== undefined) {
        portalInfo.decayTick = portal.ticksToDecay;
      }

      portals.push(portalInfo);
    }
  }

  return portals;
}

/**
 * Update portal graph
 */
export function updatePortalGraph(ownedRooms: string[]): void {
  const memory = loadInterShardMemory();
  const shardName = Game.shard?.name ?? "shard0";

  if (!memory.shards[shardName]) {
    memory.shards[shardName] = createDefaultShardState(shardName);
  }

  const state = memory.shards[shardName]!;
  const newPortals: PortalInfo[] = [];

  // Scan owned rooms and adjacent rooms for portals
  for (const roomName of ownedRooms) {
    const room = Game.rooms[roomName];
    if (room) {
      newPortals.push(...detectPortals(room));
    }
  }

  // Update portal list
  state.portals = newPortals;
  saveInterShardMemory(memory);
}

/**
 * Get best colonization target on remote shard
 */
export function getBestColonizationTarget(targetShard: string): string | null {
  const remoteMemory = getRemoteShardMemory(targetShard);
  if (!remoteMemory) return null;

  // Look for rooms with good potential (would need remote intel)
  // For now, return first portal target room
  const localMemory = loadInterShardMemory();
  const localShard = Game.shard?.name ?? "shard0";
  const state = localMemory.shards[localShard];

  if (state) {
    const portal = state.portals.find(p => p.targetShard === targetShard);
    if (portal) {
      return portal.targetRoom;
    }
  }

  return null;
}

/**
 * Create colonization task
 */
export function createColonizationTask(targetShard: string, targetRoom: string): InterShardTask {
  const memory = loadInterShardMemory();
  const sourceShard = Game.shard?.name ?? "shard0";

  const task: InterShardTask = {
    id: `colonize_${targetShard}_${targetRoom}_${Game.time}`,
    type: "colonize",
    sourceShard,
    targetShard,
    targetRoom,
    priority: 50,
    status: "pending",
    createdAt: Game.time
  };

  memory.tasks.push(task);
  saveInterShardMemory(memory);

  return task;
}

/**
 * Colonization flow phases
 */
export type ColonizationPhase = "reconnaissance" | "siteSelection" | "pioneer" | "stabilization";

/**
 * Get colonization phase
 */
export function getColonizationPhase(task: InterShardTask): ColonizationPhase {
  // Determine phase based on task age and status
  const age = Game.time - task.createdAt;

  if (age < 1000) {
    return "reconnaissance";
  } else if (age < 2000) {
    return "siteSelection";
  } else if (age < 5000) {
    return "pioneer";
  } else {
    return "stabilization";
  }
}

// =============================================================================
// 15.4 Multi-Shard Risk & CPU Management
// =============================================================================

/**
 * Distribute CPU effort based on shard roles
 */
export function getCPUDistribution(): Record<string, number> {
  const memory = loadInterShardMemory();
  const distribution: Record<string, number> = {
    rooms: 0.4,
    creeps: 0.3,
    strategic: 0.1,
    market: 0.1,
    intershard: 0.1
  };

  const localShard = Game.shard?.name ?? "shard0";
  const state = memory.shards[localShard];

  if (state) {
    switch (state.role) {
      case "war":
        // More CPU for military
        distribution["rooms"] = 0.35;
        distribution["creeps"] = 0.35;
        distribution["strategic"] = 0.15;
        distribution["market"] = 0.05;
        distribution["intershard"] = 0.1;
        break;

      case "resource":
        // More CPU for economy
        distribution["rooms"] = 0.45;
        distribution["creeps"] = 0.25;
        distribution["strategic"] = 0.1;
        distribution["market"] = 0.15;
        distribution["intershard"] = 0.05;
        break;

      case "frontier":
        // More CPU for expansion
        distribution["rooms"] = 0.35;
        distribution["creeps"] = 0.3;
        distribution["strategic"] = 0.2;
        distribution["market"] = 0.05;
        distribution["intershard"] = 0.1;
        break;
    }
  }

  return distribution;
}

/**
 * Check for single points of failure
 */
export function checkRedundancy(): { safe: boolean; issues: string[] } {
  const memory = loadInterShardMemory();
  const issues: string[] = [];

  // Check for RCL 8 rooms across shards
  let rcl8Count = 0;
  for (const state of Object.values(memory.shards)) {
    if (state.health.avgRCL >= 8) {
      rcl8Count++;
    }
  }

  if (rcl8Count < 2 && Object.keys(memory.shards).length > 1) {
    issues.push("Only one shard has RCL 8 rooms");
  }

  // Check for backup shards
  const backupShards = Object.values(memory.shards).filter(s => s.role === "backup");
  if (backupShards.length === 0 && Object.keys(memory.shards).length > 2) {
    issues.push("No backup shard designated");
  }

  return {
    safe: issues.length === 0,
    issues
  };
}

/**
 * Handle shard wipe scenario
 */
export function handleShardWipe(shardName: string): void {
  const memory = loadInterShardMemory();

  // Update shard status
  if (memory.shards[shardName]) {
    memory.shards[shardName]!.health.roomCount = 0;
    memory.shards[shardName]!.health.economyIndex = 0;
  }

  // Create evacuation tasks from nearby shards
  for (const [name, state] of Object.entries(memory.shards)) {
    if (name === shardName) continue;

    // Check if this shard has portal to wiped shard
    const portal = state.portals.find(p => p.targetShard === shardName);
    if (portal) {
      // Create reinforcement task
      const task: InterShardTask = {
        id: `reinforce_${shardName}_${Game.time}`,
        type: "reinforce",
        sourceShard: name,
        targetShard: shardName,
        priority: 100,
        status: "pending",
        createdAt: Game.time
      };
      memory.tasks.push(task);
    }
  }

  saveInterShardMemory(memory);
}

// =============================================================================
// Meta Layer Main Loop
// =============================================================================

/**
 * Run multi-shard meta layer
 */
export function runMetaLayer(ownedRooms: string[], swarms: Map<string, SwarmState>): void {
  // Only run periodically
  if (Game.time % 50 !== 0) return;

  // Update local shard state
  updateLocalShardState(ownedRooms, swarms);

  // Update portal graph
  if (Game.time % 200 === 0) {
    updatePortalGraph(ownedRooms);
  }

  // Assign shard objectives
  if (Game.time % 500 === 0) {
    assignShardObjectives();
  }

  // Check redundancy
  const redundancy = checkRedundancy();
  if (!redundancy.safe) {
    // Log issues
    for (const issue of redundancy.issues) {
      console.log(`Multi-shard redundancy issue: ${issue}`);
    }
  }
}

/**
 * Get multi-shard status summary
 */
export function getMultiShardStatus(): {
  localShard: ShardState | null;
  shardCount: number;
  globalTargets: InterShardMemorySchema["globalTargets"];
  activeTasks: number;
  portals: number;
} {
  const memory = loadInterShardMemory();
  const localShardName = Game.shard?.name ?? "shard0";

  return {
    localShard: memory.shards[localShardName] ?? null,
    shardCount: Object.keys(memory.shards).length,
    globalTargets: memory.globalTargets,
    activeTasks: memory.tasks.filter(t => t.status === "active").length,
    portals: Object.values(memory.shards).reduce((sum, s) => sum + s.portals.length, 0)
  };
}
