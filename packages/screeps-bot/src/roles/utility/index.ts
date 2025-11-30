/**
 * Utility Roles - Phase 7.2 & 7.5
 *
 * Utility and support roles:
 * - ScoutAnt (exploration)
 * - ClaimAnt (claiming/reserving)
 * - Engineer (repairs, ramparts)
 * - RemoteWorker (remote mining)
 * - LinkManager
 * - TerminalManager
 */

import type { SwarmCreepMemory, RoomIntel } from "../../memory/schemas";

/**
 * Get creep memory with type safety
 */
function getMemory(creep: Creep): SwarmCreepMemory {
  return creep.memory as unknown as SwarmCreepMemory;
}

/**
 * Get overmind memory
 */
function getOvermind(): Record<string, unknown> {
  const mem = Memory as unknown as Record<string, unknown>;
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
  return mem["overmind"] as Record<string, unknown>;
}

// =============================================================================
// ScoutAnt - Room exploration
// =============================================================================

/**
 * Run ScoutAnt behavior
 */
export function runScoutAnt(creep: Creep): void {
  const memory = getMemory(creep);
  const overmind = getOvermind();

  // Record current room
  recordRoomIntel(creep.room, overmind);

  // Get target room or find next unexplored
  let targetRoom: string | undefined = memory.targetRoom;

  if (!targetRoom || creep.room.name === targetRoom) {
    // Find next room to explore
    targetRoom = findNextExploreTarget(creep.room.name, overmind);
    if (targetRoom) {
      memory.targetRoom = targetRoom;
    } else {
      delete memory.targetRoom;
    }
  }

  if (targetRoom && creep.room.name !== targetRoom) {
    // Move to target room
    const exit = creep.room.findExitTo(targetRoom);
    if (exit !== ERR_NO_PATH && exit !== ERR_INVALID_ARGS) {
      const exitPos = creep.pos.findClosestByRange(exit);
      if (exitPos) {
        creep.moveTo(exitPos, { visualizePathStyle: { stroke: "#00ffff" } });
      }
    }
  } else if (targetRoom && creep.room.name === targetRoom) {
    // Explore the room - move around to reveal terrain
    const unexplored = findUnexploredPosition(creep.room);
    if (unexplored) {
      creep.moveTo(unexplored, { visualizePathStyle: { stroke: "#00ffff" } });
    } else {
      // Room fully explored, find next target
      delete memory.targetRoom;
    }
  }
}

/**
 * Record room intel
 */
function recordRoomIntel(room: Room, overmind: Record<string, unknown>): void {
  const roomsSeen = overmind["roomsSeen"] as Record<string, number>;
  const roomIntel = overmind["roomIntel"] as Record<string, RoomIntel>;

  roomsSeen[room.name] = Game.time;

  // Gather intel
  const sources = room.find(FIND_SOURCES);
  const mineral = room.find(FIND_MINERALS)[0];
  const controller = room.controller;
  const hostiles = room.find(FIND_HOSTILE_CREEPS);

  // Determine terrain type
  const terrain = room.getTerrain();
  let swampCount = 0;
  let plainCount = 0;
  for (let x = 0; x < 50; x += 5) {
    for (let y = 0; y < 50; y += 5) {
      const t = terrain.get(x, y);
      if (t === TERRAIN_MASK_SWAMP) swampCount++;
      else if (t === 0) plainCount++;
    }
  }
  const terrainType = swampCount > plainCount * 2 ? "swamp" : plainCount > swampCount * 2 ? "plains" : "mixed";

  // Check for highway/SK
  // Highway rooms have coordinates divisible by 10 (e.g., W10N5, W5N10, E20N30)
  const coordMatch = room.name.match(/^[WE](\d+)[NS](\d+)$/);
  const isHighway = coordMatch ? (parseInt(coordMatch[1]!, 10) % 10 === 0 || parseInt(coordMatch[2]!, 10) % 10 === 0) : false;
  const isSK = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_KEEPER_LAIR }).length > 0;

  const intel: RoomIntel = {
    name: room.name,
    lastSeen: Game.time,
    sources: sources.length,
    controllerLevel: controller?.level ?? 0,
    threatLevel: hostiles.length > 5 ? 3 : hostiles.length > 2 ? 2 : hostiles.length > 0 ? 1 : 0,
    scouted: true,
    terrain: terrainType,
    isHighway,
    isSK
  };

  // Add optional fields only if they have values
  if (controller?.owner?.username) {
    intel.owner = controller.owner.username;
  }
  if (controller?.reservation?.username) {
    intel.reserver = controller.reservation.username;
  }
  if (mineral?.mineralType) {
    intel.mineralType = mineral.mineralType;
  }

  roomIntel[room.name] = intel;
}

/**
 * Find next room to explore
 */
function findNextExploreTarget(currentRoom: string, overmind: Record<string, unknown>): string | undefined {
  const roomsSeen = overmind["roomsSeen"] as Record<string, number>;

  // Get adjacent rooms
  const exits = Game.map.describeExits(currentRoom);
  if (!exits) return undefined;

  // Find room not recently seen
  const candidates: Array<{ room: string; lastSeen: number }> = [];

  for (const [, roomName] of Object.entries(exits)) {
    const lastSeen = roomsSeen[roomName] ?? 0;
    // Skip if seen in last 1000 ticks
    if (Game.time - lastSeen > 1000) {
      candidates.push({ room: roomName, lastSeen });
    }
  }

  // Sort by oldest first
  candidates.sort((a, b) => a.lastSeen - b.lastSeen);

  return candidates[0]?.room;
}

/**
 * Find unexplored position in room
 */
function findUnexploredPosition(room: Room): RoomPosition | null {
  // Check corners and edges
  const positions = [
    new RoomPosition(5, 5, room.name),
    new RoomPosition(44, 5, room.name),
    new RoomPosition(5, 44, room.name),
    new RoomPosition(44, 44, room.name),
    new RoomPosition(25, 25, room.name)
  ];

  for (const pos of positions) {
    const terrain = room.getTerrain().get(pos.x, pos.y);
    if (terrain !== TERRAIN_MASK_WALL) {
      return pos;
    }
  }

  return null;
}

// =============================================================================
// ClaimAnt - Claiming/reserving rooms
// =============================================================================

/**
 * Run ClaimAnt behavior
 */
export function runClaimAnt(creep: Creep): void {
  const memory = getMemory(creep);
  const targetRoom = memory.targetRoom;

  if (!targetRoom) {
    // Wait near spawn
    const spawn = creep.pos.findClosestByRange(FIND_MY_SPAWNS);
    if (spawn) {
      creep.moveTo(spawn);
    }
    return;
  }

  // Move to target room
  if (creep.room.name !== targetRoom) {
    const exit = creep.room.findExitTo(targetRoom);
    if (exit !== ERR_NO_PATH && exit !== ERR_INVALID_ARGS) {
      const exitPos = creep.pos.findClosestByRange(exit);
      if (exitPos) {
        creep.moveTo(exitPos, { visualizePathStyle: { stroke: "#00ff00" } });
      }
    }
    return;
  }

  // In target room - claim or reserve controller
  const controller = creep.room.controller;
  if (!controller) return;

  // Check task type
  const task = memory.task;

  if (task === "claim") {
    // Claim controller
    if (creep.claimController(controller) === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, { visualizePathStyle: { stroke: "#00ff00" } });
    }
  } else if (task === "reserve") {
    // Reserve controller
    if (creep.reserveController(controller) === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, { visualizePathStyle: { stroke: "#00ff00" } });
    }
  } else if (task === "attack") {
    // Attack controller (downgrade enemy)
    if (creep.attackController(controller) === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, { visualizePathStyle: { stroke: "#ff0000" } });
    }
  } else {
    // Default to reserve
    if (creep.reserveController(controller) === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, { visualizePathStyle: { stroke: "#00ff00" } });
    }
  }
}

// =============================================================================
// Engineer - Repairs and ramparts
// =============================================================================

/**
 * Run Engineer behavior
 */
export function runEngineer(creep: Creep): void {
  const memory = getMemory(creep);

  // Check if we have energy
  if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    memory.working = false;
  }
  if (creep.store.getFreeCapacity() === 0) {
    memory.working = true;
  }

  if (memory.working) {
    // Priority 1: Critical structures (low HP)
    const critical = creep.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: s =>
        (s.structureType === STRUCTURE_SPAWN ||
          s.structureType === STRUCTURE_TOWER ||
          s.structureType === STRUCTURE_STORAGE) &&
        s.hits < s.hitsMax * 0.5
    });

    if (critical) {
      if (creep.repair(critical) === ERR_NOT_IN_RANGE) {
        creep.moveTo(critical, { visualizePathStyle: { stroke: "#ffff00" } });
      }
      return;
    }

    // Priority 2: Roads and containers
    const infrastructure = creep.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: s =>
        (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_CONTAINER) &&
        s.hits < s.hitsMax * 0.75
    });

    if (infrastructure) {
      if (creep.repair(infrastructure) === ERR_NOT_IN_RANGE) {
        creep.moveTo(infrastructure, { visualizePathStyle: { stroke: "#ffff00" } });
      }
      return;
    }

    // Priority 3: Ramparts (maintain up to 100k hits)
    const rampart = creep.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: s =>
        s.structureType === STRUCTURE_RAMPART &&
        (s as StructureRampart).hits < 100000
    }) as StructureRampart | null;

    if (rampart) {
      if (creep.repair(rampart) === ERR_NOT_IN_RANGE) {
        creep.moveTo(rampart, { visualizePathStyle: { stroke: "#ffff00" } });
      }
      return;
    }

    // Priority 4: Walls (maintain up to 100k hits)
    const wall = creep.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: s =>
        s.structureType === STRUCTURE_WALL &&
        s.hits < 100000
    });

    if (wall) {
      if (creep.repair(wall) === ERR_NOT_IN_RANGE) {
        creep.moveTo(wall, { visualizePathStyle: { stroke: "#ffff00" } });
      }
      return;
    }

    // Nothing to repair, help build
    const site = creep.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES);
    if (site) {
      if (creep.build(site) === ERR_NOT_IN_RANGE) {
        creep.moveTo(site, { visualizePathStyle: { stroke: "#ffffff" } });
      }
    }
  } else {
    // Get energy
    if (creep.room.storage && creep.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      if (creep.withdraw(creep.room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.storage, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
    } else {
      const container = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: s =>
          s.structureType === STRUCTURE_CONTAINER &&
          (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > 50
      }) as StructureContainer | null;

      if (container) {
        if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(container, { visualizePathStyle: { stroke: "#ffaa00" } });
        }
      }
    }
  }
}

// =============================================================================
// RemoteWorker - Remote mining
// =============================================================================

/**
 * Run RemoteWorker behavior
 */
export function runRemoteWorker(creep: Creep): void {
  const memory = getMemory(creep);
  const targetRoom = memory.targetRoom ?? memory.homeRoom;

  // Check working state
  if (creep.store.getUsedCapacity() === 0) {
    memory.working = false;
  }
  if (creep.store.getFreeCapacity() === 0) {
    memory.working = true;
  }

  if (memory.working) {
    // Return home to deliver
    const homeRoom = Game.rooms[memory.homeRoom];
    if (!homeRoom) {
      // Move to home room
      const exit = creep.room.findExitTo(memory.homeRoom);
      if (exit !== ERR_NO_PATH && exit !== ERR_INVALID_ARGS) {
        const exitPos = creep.pos.findClosestByRange(exit);
        if (exitPos) {
          creep.moveTo(exitPos);
        }
      }
      return;
    }

    if (creep.room.name !== memory.homeRoom) {
      const exit = creep.room.findExitTo(memory.homeRoom);
      if (exit !== ERR_NO_PATH && exit !== ERR_INVALID_ARGS) {
        const exitPos = creep.pos.findClosestByRange(exit);
        if (exitPos) {
          creep.moveTo(exitPos);
        }
      }
      return;
    }

    // Deliver to storage or spawn
    const target = homeRoom.storage ?? homeRoom.find(FIND_MY_SPAWNS)[0];
    if (target) {
      if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
      }
    }
  } else {
    // Go to remote room and harvest
    if (creep.room.name !== targetRoom) {
      const exit = creep.room.findExitTo(targetRoom);
      if (exit !== ERR_NO_PATH && exit !== ERR_INVALID_ARGS) {
        const exitPos = creep.pos.findClosestByRange(exit);
        if (exitPos) {
          creep.moveTo(exitPos);
        }
      }
      return;
    }

    // In remote room - harvest
    const source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
    if (source) {
      if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
    }
  }
}

// =============================================================================
// LinkManager
// =============================================================================

/**
 * Run LinkManager behavior
 */
export function runLinkManager(creep: Creep): void {
  // Link management is usually done by towers or static managers
  // This creep helps with manual transfers if needed

  const links = creep.room.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_LINK
  }) as StructureLink[];

  if (links.length < 2) return;

  // Find storage link (near storage)
  const storage = creep.room.storage;
  if (!storage) return;

  const storageLink = links.find(l => l.pos.getRangeTo(storage) <= 2);
  if (!storageLink) return;

  // Check if storageLink needs emptying
  if (storageLink.store.getUsedCapacity(RESOURCE_ENERGY) > 400) {
    // Withdraw from link and transfer to storage
    if (creep.store.getFreeCapacity() > 0) {
      if (creep.withdraw(storageLink, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(storageLink);
      }
    } else {
      if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(storage);
      }
    }
  } else {
    // Wait near storage
    if (creep.pos.getRangeTo(storage) > 2) {
      creep.moveTo(storage);
    }
  }
}

// =============================================================================
// TerminalManager
// =============================================================================

/**
 * Run TerminalManager behavior
 */
export function runTerminalManager(creep: Creep): void {
  const terminal = creep.room.terminal;
  const storage = creep.room.storage;

  if (!terminal || !storage) return;

  // Balance energy between terminal and storage
  const terminalEnergy = terminal.store.getUsedCapacity(RESOURCE_ENERGY);
  const storageEnergy = storage.store.getUsedCapacity(RESOURCE_ENERGY);

  // Target: terminal should have ~50k energy for trading
  const targetTerminalEnergy = 50000;

  if (creep.store.getUsedCapacity() > 0) {
    // Deliver what we're carrying
    const resourceType = Object.keys(creep.store)[0] as ResourceConstant;

    if (resourceType === RESOURCE_ENERGY) {
      // Deliver to whoever needs it more
      if (terminalEnergy < targetTerminalEnergy) {
        if (creep.transfer(terminal, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(terminal);
        }
      } else {
        if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(storage);
        }
      }
    } else {
      // Non-energy resources go to terminal for trading
      if (creep.transfer(terminal, resourceType) === ERR_NOT_IN_RANGE) {
        creep.moveTo(terminal);
      }
    }
  } else {
    // Pick up resources to balance
    if (terminalEnergy < targetTerminalEnergy - 10000 && storageEnergy > 20000) {
      // Terminal needs energy
      if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(storage);
      }
    } else if (terminalEnergy > targetTerminalEnergy + 10000) {
      // Terminal has excess energy
      if (creep.withdraw(terminal, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(terminal);
      }
    } else {
      // Move excess minerals from storage to terminal
      for (const resourceType of Object.keys(storage.store) as ResourceConstant[]) {
        if (resourceType !== RESOURCE_ENERGY && storage.store.getUsedCapacity(resourceType) > 5000) {
          if (creep.withdraw(storage, resourceType) === ERR_NOT_IN_RANGE) {
            creep.moveTo(storage);
          }
          return;
        }
      }

      // Wait near storage
      if (creep.pos.getRangeTo(storage) > 2) {
        creep.moveTo(storage);
      }
    }
  }
}

// =============================================================================
// Role dispatcher
// =============================================================================

/**
 * Run utility role
 */
export function runUtilityRole(creep: Creep): void {
  const memory = getMemory(creep);

  switch (memory.role) {
    case "scout":
      runScoutAnt(creep);
      break;
    case "claimer":
      runClaimAnt(creep);
      break;
    case "engineer":
      runEngineer(creep);
      break;
    case "remoteWorker":
      runRemoteWorker(creep);
      break;
    case "linkManager":
      runLinkManager(creep);
      break;
    case "terminalManager":
      runTerminalManager(creep);
      break;
    default:
      runScoutAnt(creep);
  }
}
