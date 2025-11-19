import { process } from "@ralphschuler/screeps-kernel";
import type { ProcessContext } from "@ralphschuler/screeps-kernel";
import { TaskRunner } from "@ralphschuler/screeps-async";

/**
 * Scout process using screeps-async for multi-tick exploration
 * 
 * Demonstrates:
 * - @process decorator for automatic registration
 * - screeps-async for CPU-intensive multi-tick operations
 * - Asynchronous room exploration and pathfinding
 */
@process({ name: "Scout", priority: 20, singleton: true })
export class ScoutProcess {
  private taskRunner: TaskRunner;

  constructor() {
    this.taskRunner = new TaskRunner(Memory);
  }

  public run(ctx: ProcessContext): void {
    const { game } = ctx;

    // Find scout creeps
    const scouts = Object.values(game.creeps).filter(
      (creep: Creep) => creep.memory.role === "scout" && !creep.spawning
    );

    if (scouts.length === 0) {
      // No scouts, clean up any scout tasks
      return;
    }

    if (ctx.logger && ctx.logger.log) {
      ctx.logger.log(`[Scout] Processing ${scouts.length} scouts`);
    }

    // Process each scout with async tasks
    for (const scout of scouts) {
      const taskId = `scout_${scout.name}`;

      // Check if scout already has a task
      const existingTask = this.taskRunner.getTask(taskId);
      
      if (!existingTask || existingTask.isComplete()) {
        // Create new exploration task
        this.createExplorationTask(scout, taskId);
      }
    }

    // Run task runner (processes all tasks, respects CPU limits)
    this.taskRunner.runUntilCpuLimit(10);
    this.taskRunner.endTick();
  }

  private createExplorationTask(scout: Creep, taskId: string): void {
    // Create multi-tick exploration task
    this.taskRunner.createTask(taskId, function* () {
      // Phase 1: Find unexplored room (CPU intensive)
      const targetRoom = yield* findUnexploredRoom(scout);
      
      if (!targetRoom) {
        return; // No unexplored rooms nearby
      }

      scout.say("🔍");

      // Phase 2: Navigate to target room (multi-tick)
      yield* navigateToRoom(scout, targetRoom);

      // Phase 3: Explore room (CPU intensive - pathfinding)
      yield* exploreRoom(scout, targetRoom);

      scout.say("✓");
    });
  }
}

/**
 * Find an unexplored room near the scout
 */
function* findUnexploredRoom(scout: Creep): Generator<void, string | null, void> {
  const currentRoom = scout.room;
  const exits = Game.map.describeExits(currentRoom.name);

  // Check each exit room (yields between checks)
  for (const direction in exits) {
    yield; // Allow other processes to run

    const roomName = exits[direction as keyof typeof exits];
    if (!roomName) continue;

    // Check if room is unexplored or needs re-exploration
    const room = Game.rooms[roomName];
    if (!room || !Memory.rooms[roomName]) {
      return roomName;
    }
  }

  return null;
}

/**
 * Navigate scout to target room (multi-tick)
 */
function* navigateToRoom(scout: Creep, targetRoomName: string): Generator<void, boolean, void> {
  const maxTicks = 50;
  let ticks = 0;

  while (scout.room.name !== targetRoomName && ticks < maxTicks) {
    // Move towards target room
    const exitDir = scout.room.findExitTo(targetRoomName);
    
    if (exitDir === ERR_NO_PATH || exitDir === ERR_INVALID_ARGS) {
      return false;
    }

    const exit = scout.pos.findClosestByPath(exitDir);
    if (exit) {
      scout.moveTo(exit, { visualizePathStyle: { stroke: "#00ffff" } });
    }

    yield; // Continue next tick
    ticks++;
  }

  return scout.room.name === targetRoomName;
}

/**
 * Explore room, visiting key positions (CPU intensive)
 */
function* exploreRoom(scout: Creep, roomName: string): Generator<void, void, void> {
  const room = Game.rooms[roomName];
  if (!room) return;

  // Initialize room memory
  if (!Memory.rooms) {
    Memory.rooms = {};
  }
  if (!Memory.rooms[roomName]) {
    Memory.rooms[roomName] = {};
  }

  // Scan for sources (CPU intensive)
  const sources = room.find(FIND_SOURCES);
  Memory.rooms[roomName].sources = sources.map(s => s.id);
  Memory.rooms[roomName].lastScouted = Game.time;
  yield;

  // Scan for controller
  if (room.controller) {
    Memory.rooms[roomName].controller = room.controller.id;
  }
  yield;

  // Scan for hostiles
  const hostiles = room.find(FIND_HOSTILE_CREEPS);
  Memory.rooms[roomName].hostiles = hostiles.length;
  yield;

  // Visit center of room (for full vision)
  const center = new RoomPosition(25, 25, roomName);
  
  let attempts = 0;
  while (scout.pos.getRangeTo(center) > 10 && attempts < 20) {
    scout.moveTo(center, { visualizePathStyle: { stroke: "#00ffff" } });
    yield;
    attempts++;
  }

  // Update exploration timestamp
  if (Memory.rooms[roomName]) {
    Memory.rooms[roomName].lastScouted = Game.time;
  }
}
