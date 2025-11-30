/**
 * Upgrader Role Controller
 *
 * Upgraders are responsible for:
 * - Gathering energy from containers, storage, or sources (until full)
 * - Upgrading the room controller
 * - Emergency spawn refilling when needed
 * - Pausing during defensive postures
 *
 * Note: Upgraders do NOT pick up dropped energy during recharge state to avoid
 * premature state transitions. Dropped energy collection is handled by haulers.
 *
 * Uses state machine from screeps-xstate for declarative behavior management.
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { asCreep, findActiveSources, findMySpawns } from "@runtime/types/typeGuards";
import { serviceRegistry } from "./ServiceLocator";
import { StateMachine, serialize, restore } from "@ralphschuler/screeps-xstate";
import {
  upgraderStates,
  UPGRADER_INITIAL_STATE,
  type UpgraderContext,
  type UpgraderEvent
} from "../stateMachines/upgrader";
import { isValidEnergySource } from "./helpers";

interface UpgraderMemory extends CreepMemory {
  role: "upgrader";
  task: string;
  version: number;
  stateMachine?: unknown;
}

/**
 * Upgrader role controller implementation using state machines
 */
export class UpgraderController extends BaseRoleController<UpgraderMemory> {
  private machines: Map<string, StateMachine<UpgraderContext, UpgraderEvent>> = new Map();

  public constructor() {
    const config: RoleConfig<UpgraderMemory> = {
      minimum: 3,
      maximum: 8,
      scalingFactor: 4,
      body: [WORK, CARRY, MOVE],
      version: 1,
      createMemory: () => ({
        role: "upgrader",
        task: "idle",
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "upgrader";
  }

  private lastCleanupTick = 0;

  public execute(creep: CreepLike): string {
    const memory = creep.memory as UpgraderMemory;
    const comm = serviceRegistry.getCommunicationManager();
    const energyMgr = serviceRegistry.getEnergyPriorityManager();

    // Clean up machines for dead creeps every 10 ticks to prevent memory leaks without impacting performance
    if (typeof Game !== "undefined" && Game.time - this.lastCleanupTick >= 10) {
      this.cleanupDeadCreepMachines();
      this.lastCleanupTick = Game.time;
    }

    // Get or create state machine for this creep
    // asCreep validates the CreepLike has full Creep interface required by state machine
    const validatedCreep = asCreep(creep, "UpgraderController");
    let machine = this.machines.get(creep.name);
    if (!machine) {
      if (memory.stateMachine) {
        machine = restore<UpgraderContext, UpgraderEvent>(memory.stateMachine, upgraderStates);
      } else {
        machine = new StateMachine<UpgraderContext, UpgraderEvent>(UPGRADER_INITIAL_STATE, upgraderStates, {
          creep: validatedCreep
        });
      }
      this.machines.set(creep.name, machine);
    }

    // Update creep reference in context every tick to ensure guards evaluate current state
    machine.getContext().creep = validatedCreep;

    const currentState = machine.getState();

    // Check if room is under defensive posture - pause upgrading during combat
    const roomPosture = Memory.defense?.posture[creep.room.name];
    const shouldPauseUpgrading = roomPosture === "defensive" || roomPosture === "emergency";

    if (shouldPauseUpgrading) {
      // During combat, upgraders move to a safe position and pause upgrading
      comm?.say(creep, "🛡️");
      // Move to a safe position near storage/spawn
      let safeSpot: { pos: RoomPosition } | undefined;
      if (creep.room.storage) {
        safeSpot = creep.room.storage;
      } else {
        const spawns = findMySpawns(creep.room);
        safeSpot = spawns[0];
      }
      if (safeSpot && !creep.pos.inRangeTo(safeSpot, 3)) {
        // Use ignoreCreeps for better routing through narrow passages
        creep.moveTo(safeSpot, { range: 3, reusePath: 10, ignoreCreeps: true });
      }
      // Save state to memory and return current state
      memory.stateMachine = serialize(machine);
      memory.task = currentState;
      return currentState;
    }

    // CRITICAL: Check if spawn needs immediate refilling BEFORE any other task
    const hasEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
    if (hasEnergy) {
      const spawnsNeedingEnergy = creep.room.find(FIND_MY_STRUCTURES, {
        filter: (structure: AnyStructure) => {
          if (structure.structureType !== STRUCTURE_SPAWN) return false;
          const capacity = structure.store.getCapacity(RESOURCE_ENERGY);
          const current = structure.store.getUsedCapacity(RESOURCE_ENERGY);
          return current < Math.max(150, capacity * 0.5);
        }
      }) as StructureSpawn[];

      if (spawnsNeedingEnergy.length > 0) {
        comm?.say(creep, "🚨spawn");
        // Use ignoreCreeps for better routing through narrow passages
        const spawn =
          creep.pos.findClosestByPath(spawnsNeedingEnergy, { ignoreCreeps: true }) ?? spawnsNeedingEnergy[0];
        const result = creep.transfer(spawn, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          // Use ignoreCreeps for better routing through narrow passages
          creep.moveTo(spawn, {
            range: 1,
            reusePath: 10,
            visualizePathStyle: { stroke: "#ff0000" },
            ignoreCreeps: true
          });
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
    }

    // Execute behavior based on current state
    if (currentState === "recharge") {
      comm?.say(creep, "⚡gather");

      // Note: We intentionally do NOT pick up dropped energy during recharge state.
      // Picking up energy can interfere with the gather cycle and cause premature
      // state transitions. Dropped energy collection is handled by haulers.
      // Issue #1501/#1504: This fix ensures upgraders fill to capacity before upgrading.

      // Priority 1: Use energy priority manager to get available sources (respecting reserves)
      const energySources = energyMgr
        ? energyMgr.getAvailableEnergySources(creep.room, 0, true)
        : creep.room.find(FIND_STRUCTURES, {
            filter: isValidEnergySource
          });

      // Use ignoreCreeps for better routing through narrow passages
      const target =
        energySources.length > 0
          ? (creep.pos.findClosestByPath(energySources, { ignoreCreeps: true }) ?? energySources[0])
          : null;
      if (target) {
        const result = creep.withdraw(target, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          // Use ignoreCreeps for better routing through narrow passages
          creep.moveTo(target, { range: 1, reusePath: 30, ignoreCreeps: true });
        }
        // Check if full after withdrawal
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
          machine.send({ type: "ENERGY_FULL" });
        }
      } else {
        // Priority 2: Harvest from sources directly if no containers/storage available
        const sources = findActiveSources(creep.room);
        // Use ignoreCreeps for better routing through narrow passages
        const source =
          sources.length > 0 ? (creep.pos.findClosestByPath(sources, { ignoreCreeps: true }) ?? sources[0]) : null;
        if (source) {
          const result = creep.harvest(source);
          if (result === ERR_NOT_IN_RANGE) {
            // Use ignoreCreeps for better routing through narrow passages
            creep.moveTo(source, { range: 1, reusePath: 30, ignoreCreeps: true });
          }
          // Check if full after harvest
          if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            machine.send({ type: "ENERGY_FULL" });
          }
        }
      }
    } else if (currentState === "upgrading") {
      comm?.say(creep, "⚡upgrade");

      const controller = creep.room.controller;
      if (controller) {
        const result = creep.upgradeController(controller);
        if (result === ERR_NOT_IN_RANGE) {
          // Use ignoreCreeps for better routing through narrow passages
          creep.moveTo(controller, { range: 3, reusePath: 30, ignoreCreeps: true });
        }

        // Check if empty after upgrade - this is the KEY FIX
        // Only transition when energy is FULLY depleted
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
   * This is called every 10 ticks to prevent memory leaks while minimizing CPU overhead.
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
