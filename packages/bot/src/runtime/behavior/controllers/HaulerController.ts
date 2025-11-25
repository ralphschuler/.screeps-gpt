/**
 * Hauler Role Controller
 *
 * Haulers are responsible for:
 * - Picking up energy from containers and dropped resources
 * - Delivering energy to spawns, extensions, and towers (priority-based)
 * - Filling spawn-adjacent containers
 * - Storing surplus energy in storage
 *
 * Uses state machine from screeps-xstate for declarative behavior management.
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";
import { tryPickupDroppedEnergy, findSpawnAdjacentContainers, findLowEnergyTowers } from "./helpers";
import { DEFAULT_ENERGY_CONFIG } from "@runtime/energy";
import { StateMachine, serialize, restore } from "@ralphschuler/screeps-xstate";
import {
  haulerStates,
  HAULER_INITIAL_STATE,
  type HaulerContext,
  type HaulerEvent
} from "../stateMachines/hauler";

interface HaulerMemory extends CreepMemory {
  role: "hauler";
  task: string;
  version: number;
  stateMachine?: unknown;
}

/**
 * Hauler role controller implementation using state machines
 */
export class HaulerController extends BaseRoleController<HaulerMemory> {
  private machines: Map<string, StateMachine<HaulerContext, HaulerEvent>> = new Map();

  public constructor() {
    const config: RoleConfig<HaulerMemory> = {
      minimum: 0,
      body: [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE],
      version: 1,
      createMemory: () => ({
        role: "hauler",
        task: "pickup",
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "hauler";
  }

  private lastCleanupTick = 0;

  public execute(creep: CreepLike): string {
    const memory = creep.memory as HaulerMemory;
    const comm = serviceRegistry.getCommunicationManager();

    // Clean up machines for dead creeps every 10 ticks
    if (typeof Game !== "undefined" && Game.time - this.lastCleanupTick >= 10) {
      this.cleanupDeadCreepMachines();
      this.lastCleanupTick = Game.time;
    }

    // Get or create state machine for this creep
    let machine = this.machines.get(creep.name);
    if (!machine) {
      if (memory.stateMachine) {
        machine = restore<HaulerContext, HaulerEvent>(memory.stateMachine, haulerStates);
      } else {
        machine = new StateMachine<HaulerContext, HaulerEvent>(HAULER_INITIAL_STATE, haulerStates, {
          creep: creep as Creep
        });
      }
      this.machines.set(creep.name, machine);
    }

    // Update creep reference in context every tick
    machine.getContext().creep = creep as Creep;

    const currentState = machine.getState();

    if (currentState === "pickup") {
      comm?.say(creep, "pickup");

      // Priority 1: Pick up dropped energy
      if (tryPickupDroppedEnergy(creep)) {
        // Check if full after pickup
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
          machine.send({ type: "ENERGY_FULL" });
        }
        // Save state to memory and return current state
        memory.stateMachine = serialize(machine);
        memory.task = machine.getState();
        return memory.task;
      }

      // Priority 2: Pick up from containers near sources
      const containers = creep.room.find(FIND_STRUCTURES, {
        filter: s =>
          s.structureType === STRUCTURE_CONTAINER &&
          (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > 0
      }) as StructureContainer[];

      if (containers.length > 0) {
        const closest = creep.pos.findClosestByPath(containers);
        const target = closest ?? containers[0];
        machine.send({ type: "START_PICKUP", targetId: target.id });
        const result = creep.withdraw(target, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { range: 1, reusePath: 30 });
        }
        // Check if full after withdrawal
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
          machine.send({ type: "ENERGY_FULL" });
        }
      }
    } else if (currentState === "deliver") {
      // Threshold-based delivery for balanced energy distribution
      comm?.say(creep, "deliver");

      const energyMgr = serviceRegistry.getEnergyPriorityManager();

      // Priority 1: Critical spawns/extensions (below threshold capacity)
      const criticalSpawns = creep.room.find(FIND_STRUCTURES, {
        filter: (structure: AnyStructure) => {
          if (structure.structureType !== STRUCTURE_SPAWN && structure.structureType !== STRUCTURE_EXTENSION) {
            return false;
          }
          const store = (structure as AnyStoreStructure).store;
          const capacity = store.getCapacity(RESOURCE_ENERGY);
          const used = store.getUsedCapacity(RESOURCE_ENERGY);
          // Use 30% threshold for spawn/extension critical level
          return capacity > 0 && used < capacity * 0.3;
        }
      });

      if (criticalSpawns.length > 0) {
        const closest = creep.pos.findClosestByPath(criticalSpawns);
        const target = closest !== null ? closest : criticalSpawns[0];
        machine.send({ type: "START_DELIVER", targetId: target.id as Id<AnyStoreStructure> });
        const result = creep.transfer(target, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { range: 1, reusePath: 30 });
        }
        // Check if empty after transfer
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
          machine.send({ type: "ENERGY_EMPTY" });
        }
        // Save state to memory and return current state
        memory.stateMachine = serialize(machine);
        memory.task = machine.getState();
        return memory.task;
      }

      // Priority 2: Towers below threshold capacity (defense)
      const lowTowers = findLowEnergyTowers(creep.room, DEFAULT_ENERGY_CONFIG.towerMinCapacity);

      if (lowTowers.length > 0) {
        const closest = creep.pos.findClosestByPath(lowTowers);
        const target = closest ?? lowTowers[0];
        machine.send({ type: "START_DELIVER", targetId: target.id });
        const result = creep.transfer(target, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { range: 1, reusePath: 30 });
        }
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
          machine.send({ type: "ENERGY_EMPTY" });
        }
        memory.stateMachine = serialize(machine);
        memory.task = machine.getState();
        return memory.task;
      }

      // Priority 3: Spawn-adjacent containers below reserve threshold
      if (energyMgr) {
        const lowSpawnContainers = findSpawnAdjacentContainers(creep.room, DEFAULT_ENERGY_CONFIG.spawnContainerReserve);

        if (lowSpawnContainers.length > 0) {
          const closest = creep.pos.findClosestByPath(lowSpawnContainers);
          const target = closest ?? lowSpawnContainers[0];
          machine.send({ type: "START_DELIVER", targetId: target.id });
          const result = creep.transfer(target, RESOURCE_ENERGY);
          if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { range: 1, reusePath: 30 });
          }
          if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            machine.send({ type: "ENERGY_EMPTY" });
          }
          memory.stateMachine = serialize(machine);
          memory.task = machine.getState();
          return memory.task;
        }
      }

      // Priority 4-7: Other delivery targets
      const targets = [
        // Priority 4: Top off spawns and extensions to full capacity
        creep.room.find(FIND_STRUCTURES, {
          filter: (structure: AnyStructure) =>
            (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) &&
            (structure as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0
        }),
        // Priority 5: Top off towers to full capacity
        creep.room.find(FIND_STRUCTURES, {
          filter: (structure: AnyStructure) =>
            structure.structureType === STRUCTURE_TOWER &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        }) as StructureTower[],
        // Priority 6: Fill spawn-adjacent containers to full capacity
        energyMgr ? findSpawnAdjacentContainers(creep.room) : [],
        // Priority 7: Storage (surplus)
        creep.room.storage && creep.room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0
          ? [creep.room.storage]
          : []
      ];

      for (const targetList of targets) {
        if (targetList.length > 0) {
          const closest = creep.pos.findClosestByPath(targetList);
          const target = closest !== null ? closest : targetList[0];
          machine.send({ type: "START_DELIVER", targetId: target.id as Id<AnyStoreStructure> });
          const result = creep.transfer(target, RESOURCE_ENERGY);
          if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { range: 1, reusePath: 30 });
          }
          if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            machine.send({ type: "ENERGY_EMPTY" });
          }
          memory.stateMachine = serialize(machine);
          memory.task = machine.getState();
          return memory.task;
        }
      }

      // Fallback: Upgrade controller
      const controller = creep.room.controller;
      if (controller) {
        const result = creep.upgradeController(controller);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(controller, { range: 3, reusePath: 30 });
        }
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
          machine.send({ type: "ENERGY_EMPTY" });
        }
      }
    }

    // Save state to memory
    memory.stateMachine = serialize(machine);
    memory.task = machine.getState();

    return memory.task;
  }

  /**
   * Clean up state machines for dead creeps to prevent memory leaks.
   */
  private cleanupDeadCreepMachines(): void {
    // Skip cleanup if Game is not available (e.g., in tests)
    if (typeof Game === "undefined" || !Game.creeps) {
      return;
    }

    for (const creepName of this.machines.keys()) {
      if (!Game.creeps[creepName]) {
        this.machines.delete(creepName);
      }
    }
  }
}
