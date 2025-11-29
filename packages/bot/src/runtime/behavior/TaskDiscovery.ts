/**
 * Task discovery functions for populating role-specific task queues.
 *
 * These functions identify available work targets in a room and convert them
 * into task queue entries. They are called during the task discovery phase
 * before creep execution.
 */

import { TaskPriority, type TaskQueueEntry } from "./RoleTaskQueue";

/**
 * Task expiration time (in ticks) for different task types
 */
const TASK_EXPIRATION = {
  HARVEST: 100, // Energy sources are stable
  BUILD: 200, // Construction sites persist
  REPAIR: 150, // Structures need repair
  UPGRADE: 50, // Controller upgrade is always available
  PICKUP: 50, // Dropped energy may be picked up by others
  DELIVER: 100 // Delivery targets persist
};

/**
 * Discover harvest tasks for harvester role
 */
export function discoverHarvestTasks(room: Room, currentTick: number): TaskQueueEntry[] {
  const tasks: TaskQueueEntry[] = [];
  const roomName = room.name;

  // Find active energy sources
  const sources = room.find(FIND_SOURCES_ACTIVE);

  for (const source of sources) {
    tasks.push({
      taskId: `${roomName}-harvest-source-${source.id}`,
      targetId: source.id,
      roomName,
      priority: TaskPriority.HIGH,
      expiresAt: currentTick + TASK_EXPIRATION.HARVEST
    });
  }

  return tasks;
}

/**
 * Discover build tasks for builder role
 */
export function discoverBuildTasks(room: Room, currentTick: number): TaskQueueEntry[] {
  const tasks: TaskQueueEntry[] = [];
  const roomName = room.name;

  // Find construction sites with priority ordering
  const constructionPriorities = [
    { type: STRUCTURE_SPAWN, priority: TaskPriority.CRITICAL },
    { type: STRUCTURE_EXTENSION, priority: TaskPriority.CRITICAL },
    { type: STRUCTURE_TOWER, priority: TaskPriority.HIGH },
    { type: STRUCTURE_CONTAINER, priority: TaskPriority.HIGH },
    { type: STRUCTURE_STORAGE, priority: TaskPriority.HIGH },
    { type: STRUCTURE_ROAD, priority: TaskPriority.NORMAL },
    { type: STRUCTURE_RAMPART, priority: TaskPriority.NORMAL },
    { type: STRUCTURE_WALL, priority: TaskPriority.LOW }
  ];

  const sites = room.find(FIND_CONSTRUCTION_SITES);

  for (const site of sites) {
    const priorityConfig = constructionPriorities.find(p => p.type === site.structureType);
    const priority = priorityConfig?.priority ?? TaskPriority.NORMAL;

    tasks.push({
      taskId: `${roomName}-build-${site.id}`,
      targetId: site.id,
      roomName,
      priority,
      expiresAt: currentTick + TASK_EXPIRATION.BUILD
    });
  }

  return tasks;
}

/**
 * Discover repair tasks for builder and repairer roles
 */
export function discoverRepairTasks(room: Room, currentTick: number, targetHits: number = 0): TaskQueueEntry[] {
  const tasks: TaskQueueEntry[] = [];
  const roomName = room.name;

  // Find structures needing repair (excluding walls/ramparts which have separate logic)
  const structures = room.find(FIND_STRUCTURES, {
    filter: (structure: AnyStructure) => {
      if (!("hits" in structure) || typeof structure.hits !== "number") {
        return false;
      }

      // Skip walls and ramparts - they have separate wall upgrade manager logic
      if (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) {
        // Only repair walls/ramparts if below target HP
        return targetHits > 0 && structure.hits < targetHits;
      }

      // Repair other structures when below max HP
      return structure.hits < structure.hitsMax;
    }
  });

  for (const structure of structures) {
    // Priority based on structure type
    let priority = TaskPriority.NORMAL;

    if (structure.structureType === STRUCTURE_CONTAINER || structure.structureType === STRUCTURE_ROAD) {
      priority = TaskPriority.HIGH; // Infrastructure is important
    } else if (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_TOWER) {
      priority = TaskPriority.CRITICAL; // Critical structures
    }

    tasks.push({
      taskId: `${roomName}-repair-${structure.id}`,
      targetId: structure.id,
      roomName,
      priority,
      expiresAt: currentTick + TASK_EXPIRATION.REPAIR
    });
  }

  return tasks;
}

/**
 * Discover pickup tasks for hauler role
 */
export function discoverPickupTasks(room: Room, currentTick: number, minAmount: number = 20): TaskQueueEntry[] {
  const tasks: TaskQueueEntry[] = [];
  const roomName = room.name;

  // Find dropped energy
  const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
    filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= minAmount
  });

  for (const resource of droppedEnergy) {
    tasks.push({
      taskId: `${roomName}-pickup-energy-${resource.id}`,
      targetId: resource.id,
      roomName,
      priority: TaskPriority.HIGH,
      expiresAt: currentTick + TASK_EXPIRATION.PICKUP
    });
  }

  // Find containers with energy
  const containers = room.find(FIND_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
  });

  for (const container of containers) {
    tasks.push({
      taskId: `${roomName}-pickup-container-${container.id}`,
      targetId: container.id,
      roomName,
      priority: TaskPriority.NORMAL,
      expiresAt: currentTick + TASK_EXPIRATION.PICKUP
    });
  }

  return tasks;
}

/**
 * Discover delivery tasks for hauler role
 */
export function discoverDeliveryTasks(room: Room, currentTick: number): TaskQueueEntry[] {
  const tasks: TaskQueueEntry[] = [];
  const roomName = room.name;

  // Critical: spawns and extensions needing energy
  const spawnsExtensions = room.find(FIND_STRUCTURES, {
    filter: (structure: AnyStructure) =>
      (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) &&
      (structure as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0
  });

  for (const structure of spawnsExtensions) {
    tasks.push({
      taskId: `${roomName}-deliver-${structure.id}`,
      targetId: structure.id,
      roomName,
      priority: TaskPriority.CRITICAL,
      expiresAt: currentTick + TASK_EXPIRATION.DELIVER
    });
  }

  // High: towers needing energy
  const towers = room.find(FIND_STRUCTURES, {
    filter: (structure: AnyStructure) =>
      structure.structureType === STRUCTURE_TOWER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
  });

  for (const tower of towers) {
    tasks.push({
      taskId: `${roomName}-deliver-${tower.id}`,
      targetId: tower.id,
      roomName,
      priority: TaskPriority.HIGH,
      expiresAt: currentTick + TASK_EXPIRATION.DELIVER
    });
  }

  // Normal: storage
  // Safety check: storage.store may not have getFreeCapacity in test mocks
  if (
    room.storage &&
    room.storage.store &&
    typeof room.storage.store.getFreeCapacity === "function" &&
    room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0
  ) {
    tasks.push({
      taskId: `${roomName}-deliver-${room.storage.id}`,
      targetId: room.storage.id,
      roomName,
      priority: TaskPriority.NORMAL,
      expiresAt: currentTick + TASK_EXPIRATION.DELIVER
    });
  }

  return tasks;
}

/**
 * Discover upgrade tasks for upgrader role
 */
export function discoverUpgradeTasks(room: Room, currentTick: number): TaskQueueEntry[] {
  const tasks: TaskQueueEntry[] = [];
  const roomName = room.name;

  if (room.controller?.my) {
    // Create a single upgrade task per controller
    // Multiple upgraders can work on the same controller, but we track it to prevent
    // all upgraders from idling if one is assigned
    tasks.push({
      taskId: `${roomName}-upgrade-${room.controller.id}`,
      targetId: room.controller.id,
      roomName,
      priority: TaskPriority.NORMAL,
      expiresAt: currentTick + TASK_EXPIRATION.UPGRADE
    });
  }

  return tasks;
}

/**
 * Discover stationary harvest tasks for stationaryHarvester role
 */
export function discoverStationaryHarvestTasks(room: Room, currentTick: number): TaskQueueEntry[] {
  const tasks: TaskQueueEntry[] = [];
  const roomName = room.name;

  // Find all energy sources
  const sources = room.find(FIND_SOURCES);

  for (const source of sources) {
    // Check if there's a container near this source
    // Safety check: source.pos may be undefined in edge cases (e.g., RoomPosition deserialization issues)
    if (!source.pos || typeof source.pos.findInRange !== "function") {
      continue;
    }

    const nearbyStructures = source.pos.findInRange(FIND_STRUCTURES, 2, {
      filter: (s: Structure) => s.structureType === STRUCTURE_CONTAINER
    });

    // Only create task if container exists (stationary harvesters need containers)
    if (nearbyStructures.length > 0) {
      tasks.push({
        taskId: `${roomName}-stationary-harvest-${source.id}`,
        targetId: source.id,
        roomName,
        priority: TaskPriority.HIGH,
        expiresAt: currentTick + TASK_EXPIRATION.HARVEST
      });
    }
  }

  return tasks;
}
