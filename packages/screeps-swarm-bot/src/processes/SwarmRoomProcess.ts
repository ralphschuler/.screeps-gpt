import { process } from "@ralphschuler/screeps-kernel";
import { Logger } from "@ralphschuler/screeps-logger";
import { DANGER_THRESHOLDS, MIN_EXPAND_SIGNAL, PHEROMONE_DIFFUSION, SPAWN_PROFILE_TTL } from "../constants.js";
import { SwarmMemoryManager } from "../memory/SwarmMemoryManager.js";
import { updateRoomMetrics } from "../memory/metrics.js";
import type { SwarmMemory, SwarmProcessContext, SwarmRoomMemory, SwarmRole } from "../types.js";
import { weightedSelect } from "../utils/weightedSelection.js";
import { decaySignals, diffuseSignals, updateSignals } from "../pheromones.js";
import { deriveColonyLevel, derivePosture, roleWeightsFromPosture } from "../logic/evolution.js";
import { updateDanger } from "../logic/defenseLogic.js";
import { detectNukes } from "../logic/nukes.js";
import { profileRoom } from "../core/profiler.js";

/**
 * Maintains room-level pheromone memory and derives spawn roulette profiles.
 */
@process({ name: "SwarmRoomProcess", priority: 80, singleton: true })
export class SwarmRoomProcess {
  private readonly memoryManager = new SwarmMemoryManager(new Logger({ minLevel: "info" }));

  public run(ctx: SwarmProcessContext): void {
    const swarmMemory = this.memoryManager.getOrInit(ctx.memory);

    for (const [roomName, room] of Object.entries(ctx.game.rooms)) {
      profileRoom(ctx.memory, roomName, () => {
        const roomMemory = this.memoryManager.getOrInitRoom(swarmMemory, roomName);
        if (!this.memoryManager.needsRefresh(roomMemory, ctx.game.time)) {
          return;
        }

        this.refreshRoomState(roomMemory, room as Room, swarmMemory, ctx);
        this.memoryManager.stamp(roomMemory, ctx.game.time);
      });
    }

    this.diffuseNeighborSignals(swarmMemory, ctx);
  }

  private refreshRoomState(
    roomMemory: SwarmRoomMemory,
    room: Room,
    swarmMemory: SwarmMemory,
    ctx: SwarmProcessContext
  ): void {
    roomMemory.pheromones = decaySignals(roomMemory.pheromones);

    const controllerLevel = room.controller?.level ?? 0;
    roomMemory.colonyLevel = deriveColonyLevel(controllerLevel, roomMemory.metrics);
    const previousDanger = roomMemory.danger;
    updateDanger(roomMemory, room);
    detectNukes(roomMemory, room);
    if (roomMemory.danger > previousDanger) {
      this.memoryManager.pushEvent(roomMemory, `danger:${roomMemory.danger}`, ctx.game.time);
    }
    roomMemory.intent = derivePosture(roomMemory);

    this.updatePheromones(roomMemory, room);
    roomMemory.metrics = updateRoomMetrics(roomMemory.metrics, {
      harvestedEma: room.memory.energyIncome,
      spendEma: room.memory.energySpend,
      hostilesEma: room.find(FIND_HOSTILE_CREEPS).length,
      controllerProgressEma: room.controller?.progress ?? 0,
    });
    this.captureIntel(swarmMemory, room, roomMemory, ctx);
    this.runIndustry(room, roomMemory);
    this.refreshSpawnProfile(roomMemory, ctx);
  }

  private updatePheromones(roomMemory: SwarmRoomMemory, room: Room): void {
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
    const hostiles = room.find(FIND_HOSTILE_CREEPS).length;
    const sources = room.find(FIND_SOURCES);
    const downgradeTicks = room.controller?.ticksToDowngrade ?? 5000;
    const energyStored = room.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0;
    const remoteHarvestPressure = sources.length > 1 ? 1.5 : 1;
    const incomingNukes = room.find(FIND_NUKES).length;
    const hasObserver = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_OBSERVER } }).length > 0;

    updateSignals(roomMemory.pheromones, {
      constructionSites,
      hostiles,
      controllerLevel: roomMemory.colonyLevel,
      downgradeTicks,
      energyStored,
      remoteHarvestPressure,
      hasObserver,
      incomingNukes
    });
  }

  private captureIntel(
    swarmMemory: SwarmMemory,
    room: Room,
    roomMemory: SwarmRoomMemory,
    ctx: SwarmProcessContext
  ): void {
    const mineral = room.find(FIND_MINERALS)[0];
    const deposits = room.find(FIND_DEPOSITS);
    swarmMemory.global.intel[room.name] = {
      sources: room.find(FIND_SOURCES).length,
      mineral: mineral ? { type: mineral.mineralType, amount: mineral.mineralAmount } : undefined,
      deposits: deposits.map(dep => ({ type: dep.depositType, cooldown: dep.lastCooldown, decay: dep.ticksToDecay })),
      controller: room.controller
        ? { level: room.controller.level, owner: room.controller.owner?.username, reserver: room.controller.reservation?.username }
        : undefined,
      threat: roomMemory.danger,
      lastSeen: ctx.game.time
    };

    const labs = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } });
    roomMemory.missingStructures = {
      spawn: room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } }).length === 0,
      storage: !room.storage,
      terminal: !room.terminal,
      labs: labs.length < 3,
      nuker: room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_NUKER } }).length === 0,
      factory: room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_FACTORY } }).length === 0,
      extractor: room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTRACTOR } }).length === 0,
      powerSpawn: room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_POWER_SPAWN } }).length === 0,
      observer: room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_OBSERVER } }).length === 0,
    };
  }

  private runIndustry(room: Room, roomMemory: SwarmRoomMemory): void {
    const powerSpawn = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_POWER_SPAWN } })[0] as
      | StructurePowerSpawn
      | undefined;
    if (powerSpawn && powerSpawn.store[RESOURCE_POWER] > 0 && powerSpawn.store[RESOURCE_ENERGY] > 50) {
      powerSpawn.processPower();
    }

    const factory = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_FACTORY } })[0] as
      | StructureFactory
      | undefined;
    if (factory && factory.cooldown === 0) {
      const storageEnergy = room.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0;
      if (storageEnergy > 30000 && factory.store.getFreeCapacity() > 0) {
        factory.produce(RESOURCE_BATTERY);
      }
    }

    const labs = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } }) as StructureLab[];
    if (labs.length >= 3) {
      const [labA, labB, ...outputs] = labs;
      for (const product of outputs) {
        if (labA.mineralType && labB.mineralType) {
          product.runReaction(labA, labB);
        }
      }
    }

    const terminal = room.terminal;
    const storage = room.storage;
    if (terminal && storage) {
      const terminalEnergy = terminal.store.getUsedCapacity(RESOURCE_ENERGY);
      if (terminalEnergy < 10000) {
        roomMemory.logisticsNeed = Math.max(roomMemory.logisticsNeed ?? 0, 1);
      }
      if (terminalEnergy > 45000) {
        roomMemory.logisticsNeed = Math.max(roomMemory.logisticsNeed ?? 0, 1.5);
      }
    }
  }

  private refreshSpawnProfile(roomMemory: SwarmRoomMemory, ctx: SwarmProcessContext): void {
    if (roomMemory.spawnProfile._ttl && roomMemory.spawnProfile._ttl > ctx.game.time) {
      return;
    }

    const postureWeights = roleWeightsFromPosture(roomMemory.intent, roomMemory.pheromones);
    const weights = {
      ...postureWeights,
      claimAnt:
        roomMemory.pheromones.expand >= MIN_EXPAND_SIGNAL ? postureWeights.claimAnt ?? roomMemory.pheromones.expand : 0,
    } as Record<SwarmRole, number>;

    const entries = Object.entries(weights)
      .map(([role, weight]) => ({ value: role, weight }))
      .filter(entry => entry.weight > 0);
    const recommendation = weightedSelect(entries, Math.random);

    roomMemory.spawnProfile.weights = weights;
    roomMemory.spawnProfile.recommended = recommendation ?? null;
    this.memoryManager.stampSpawnProfile(roomMemory, ctx.game.time);
  }

  private diffuseNeighborSignals(swarmMemory: ReturnType<SwarmMemoryManager["getOrInit"]>, ctx: SwarmProcessContext): void {
    for (const roomName of Object.keys(ctx.game.rooms)) {
      const exits = ctx.game.map.describeExits(roomName);
      if (!exits) continue;
      const neighbors: SwarmRoomMemory[] = [];
      for (const neighborName of Object.values(exits)) {
        if (!neighborName) continue;
        const neighborMemory = swarmMemory.rooms[neighborName];
        if (neighborMemory) {
          neighbors.push(neighborMemory);
        }
      }
      if (neighbors.length === 0) continue;
      diffuseSignals(swarmMemory.rooms[roomName], neighbors);
      for (const neighbor of neighbors) {
        neighbor.pheromones.expand *= 1 + PHEROMONE_DIFFUSION;
      }
    }
  }
}
