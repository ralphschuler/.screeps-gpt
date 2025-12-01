import { Logger } from "@ralphschuler/screeps-logger";
import { MAX_EVENT_LOG, PHEROMONE_DECAY, ROOM_MEMORY_TTL, SPAWN_PROFILE_TTL } from "../constants.js";
import type { PheromoneSignals, SwarmMemory, SwarmMemoryRoot, SwarmRoomMemory, SwarmRole } from "../types.js";

/**
 * Ensures Memory has the compact pheromone-based swarm schema and provides
 * helpers for room-level updates.
 */
export class SwarmMemoryManager {
  private readonly logger: Logger;

  public constructor(logger = new Logger({ minLevel: "info" })) {
    this.logger = logger.child({ system: "swarm-memory" });
  }

  /**
   * Returns a safe swarm memory object, initializing defaults if necessary.
   * @param memory - Global Memory object
   */
  public getOrInit(memory: SwarmMemoryRoot): SwarmMemory {
    if (!memory.swarm) {
      memory.swarm = {
        overmind: {
          roomsSeen: {},
          claimQueue: [],
          warTargets: [],
          nukeCandidates: [],
          lastRun: 0,
          market: {
            lastScan: 0,
            buyOrders: [],
            sellOrders: [],
            cooldowns: {},
            bestBuy: {},
            bestSell: {}
          }
        },
        global: {
          ownedRooms: [],
          intel: {},
          objectives: []
        },
        clusters: {},
        rooms: {},
        logisticsRoutes: [],
        rallies: {},
        squads: {},
        metrics: { roomCpu: {}, globalCpu: 0 }
      };
      this.logger.info("Initialized swarm memory root");
    }

    return memory.swarm as SwarmMemory;
  }

  /**
   * Retrieve or initialize a room-level swarm record.
   * @param memory - Root swarm memory
   * @param roomName - Screeps room name
   */
  public getOrInitRoom(memory: SwarmMemory, roomName: string): SwarmRoomMemory {
    if (!memory.rooms[roomName]) {
      memory.rooms[roomName] = {
        colonyLevel: 1,
        intent: "eco",
        danger: 0,
        pheromones: this.createEmptySignals(),
        ttl: 0,
        lastUpdated: 0,
        spawnProfile: { weights: {} as Record<SwarmRole, number> },
        eventLog: [],
        missingStructures: {},
        remoteAssignments: []
      };
      this.logger.debug?.("Initialized room swarm memory", { roomName });
    }

    return memory.rooms[roomName]!;
  }

  /**
   * Apply decay to all pheromone signals.
   */
  public decay(signals: PheromoneSignals): PheromoneSignals {
    const entries = Object.entries(signals) as Array<[keyof PheromoneSignals, number]>;
    const result: PheromoneSignals = { ...signals };
    for (const [key, value] of entries) {
      result[key] = Math.max(0, value * PHEROMONE_DECAY);
    }
    return result;
  }

  /**
   * Push an event into the bounded event log for a room.
   */
  public pushEvent(roomMemory: SwarmRoomMemory, type: string, time: number): void {
    roomMemory.eventLog.push([type, time]);
    if (roomMemory.eventLog.length > MAX_EVENT_LOG) {
      roomMemory.eventLog.shift();
    }
  }

  /**
   * Determine whether the room memory needs refresh based on TTL.
   */
  public needsRefresh(roomMemory: SwarmRoomMemory, currentTime: number): boolean {
    return roomMemory.ttl <= currentTime;
  }

  /**
   * Update bookkeeping timestamps after a refresh cycle.
   */
  public stamp(roomMemory: SwarmRoomMemory, currentTime: number): void {
    roomMemory.lastUpdated = currentTime;
    roomMemory.ttl = currentTime + ROOM_MEMORY_TTL;
  }

  /**
   * Update the spawn profile TTL to spread recomputation work.
   */
  public stampSpawnProfile(roomMemory: SwarmRoomMemory, currentTime: number): void {
    roomMemory.spawnProfile._ttl = currentTime + SPAWN_PROFILE_TTL;
  }

  private createEmptySignals(): PheromoneSignals {
    return {
      expand: 0,
      harvest: 0,
      build: 0,
      upgrade: 0,
      defense: 0,
      war: 0,
      logistics: 0,
      nukeTarget: 0,
      siege: 0
    };
  }
}
