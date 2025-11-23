/**
 * Harvester Role Controller
 *
 * Harvesters are responsible for:
 * - Picking up dropped energy when available (during harvest phase)
 * - Harvesting energy from sources
 * - Delivering energy to spawns and extensions (priority 1)
 * - Filling towers below threshold capacity (priority 2)
 * - Filling containers when spawns/extensions/towers are full (priority 3)
 * - Upgrading controller as fallback when no delivery targets
 *
 * Uses state machine from screeps-xstate for declarative behavior management.
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";
import { StateMachine, serialize, restore } from "@ralphschuler/screeps-xstate";
import {
  harvesterStates,
  HARVESTER_INITIAL_STATE,
  type HarvesterContext,
  type HarvesterEvent
} from "../stateMachines/harvester";
import { tryPickupDroppedEnergy, findLowEnergyTowers } from "./helpers";
import { DEFAULT_ENERGY_CONFIG } from "@runtime/energy";

interface HarvesterMemory extends CreepMemory {
  role: "harvester";
  task: string;
  version: number;
  stateMachine?: unknown;
}

/**
 * Harvester role controller implementation using state machines
 */
export class HarvesterController extends BaseRoleController<HarvesterMemory> {
  private machines: Map<string, StateMachine<HarvesterContext, HarvesterEvent>> = new Map();

  public constructor() {
    const config: RoleConfig<HarvesterMemory> = {
      minimum: 4,
      body: [WORK, CARRY, MOVE],
      version: 1,
      createMemory: () => ({
        role: "harvester",
        task: "idle",
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "harvester";
  }

  public execute(creep: CreepLike): string {
    const memory = creep.memory as HarvesterMemory;
    const comm = serviceRegistry.getCommunicationManager();

    // Clean up machines for dead creeps to prevent memory leaks
    this.cleanupDeadCreepMachines();

    // Get or create state machine for this creep
    let machine = this.machines.get(creep.name);
    if (!machine) {
      if (memory.stateMachine) {
        machine = restore<HarvesterContext, HarvesterEvent>(memory.stateMachine, harvesterStates);
        machine.getContext().creep = creep as Creep;
      } else {
        machine = new StateMachine<HarvesterContext, HarvesterEvent>(HARVESTER_INITIAL_STATE, harvesterStates, {
          creep: creep as Creep
        });
      }
      this.machines.set(creep.name, machine);
    }

    const ctx = machine.getContext();
    const currentState = machine.getState();

    // Execute behavior based on current state
    if (currentState === "idle") {
      comm?.say(creep, "💤");
      // Find nearest source and start harvesting
      const sources = creep.room.find(FIND_SOURCES_ACTIVE) as Source[];
      if (sources.length > 0) {
        const source = creep.pos.findClosestByPath(sources) ?? sources[0];
        machine.send({ type: "START_HARVEST", sourceId: source.id });
      }
    } else if (currentState === "harvesting") {
      comm?.say(creep, "⛏️");

      // Try to pick up dropped energy first before harvesting
      if (tryPickupDroppedEnergy(creep)) {
        // Check if full after pickup
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
          machine.send({ type: "ENERGY_FULL" });
        }
        return currentState;
      }

      if (ctx.sourceId) {
        const source = Game.getObjectById(ctx.sourceId);
        if (source && source.energy > 0) {
          const result = creep.harvest(source);
          if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, { range: 1, reusePath: 30 });
          }

          // Check if full
          if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            machine.send({ type: "ENERGY_FULL" });
          }
        } else {
          machine.send({ type: "SOURCE_DEPLETED" });
        }
      }
    } else if (currentState === "delivering") {
      comm?.say(creep, "📦");

      // Priority 1: Fill spawns and extensions
      const criticalTargets = creep.room.find(FIND_STRUCTURES, {
        filter: (structure: AnyStructure) =>
          (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) &&
          (structure as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0
      }) as AnyStoreStructure[];

      if (criticalTargets.length > 0) {
        const target = creep.pos.findClosestByPath(criticalTargets) ?? criticalTargets[0];
        const result = creep.transfer(target, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { range: 1, reusePath: 30 });
        }

        // Check if empty
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
          machine.send({ type: "ENERGY_EMPTY" });
        }
      } else {
        // Priority 2: Fill towers below threshold capacity (defense)
        const lowTowers = findLowEnergyTowers(creep.room, DEFAULT_ENERGY_CONFIG.towerMinCapacity);

        if (lowTowers.length > 0) {
          const target = creep.pos.findClosestByPath(lowTowers) ?? lowTowers[0];
          const result = creep.transfer(target, RESOURCE_ENERGY);
          if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { range: 1, reusePath: 30 });
          }

          if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            machine.send({ type: "ENERGY_EMPTY" });
          }
        } else {
          // Priority 3: Fill containers
          const containers = creep.room.find(FIND_STRUCTURES, {
            filter: (structure: AnyStructure) =>
              structure.structureType === STRUCTURE_CONTAINER &&
              (structure as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0
          }) as AnyStoreStructure[];

          if (containers.length > 0) {
            const target = creep.pos.findClosestByPath(containers) ?? containers[0];
            const result = creep.transfer(target, RESOURCE_ENERGY);
            if (result === ERR_NOT_IN_RANGE) {
              creep.moveTo(target, { range: 1, reusePath: 30 });
            }

            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
              machine.send({ type: "ENERGY_EMPTY" });
            }
          } else {
            // No delivery targets, upgrade controller
            machine.send({ type: "START_UPGRADE" });
          }
        }
      }
    } else if (currentState === "upgrading") {
      comm?.say(creep, "⚡");

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
    memory.task = currentState;

    return currentState;
  }

  /**
   * Clean up state machines for dead creeps to prevent memory leaks.
   * This is called on every execute to ensure the machines Map doesn't grow indefinitely.
   */
  private cleanupDeadCreepMachines(): void {
    for (const creepName of this.machines.keys()) {
      if (!Game.creeps[creepName]) {
        this.machines.delete(creepName);
      }
    }
  }
}
