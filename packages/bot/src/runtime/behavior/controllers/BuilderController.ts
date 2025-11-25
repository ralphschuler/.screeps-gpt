/**
 * Builder Role Controller
 *
 * Builders are responsible for:
 * - Gathering energy from containers, storage, or sources
 * - Building construction sites (prioritized by structure type)
 * - Repairing damaged structures
 * - Upgrading controller as fallback
 * - Emergency spawn refilling when needed
 *
 * Uses state machine from screeps-xstate for declarative behavior management.
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";
import { tryPickupDroppedEnergy, isValidEnergySource } from "./helpers";
import { StateMachine, serialize, restore } from "@ralphschuler/screeps-xstate";
import {
  builderStates,
  BUILDER_INITIAL_STATE,
  type BuilderContext,
  type BuilderEvent
} from "../stateMachines/builder";

interface BuilderMemory extends CreepMemory {
  role: "builder";
  task: string;
  version: number;
  stateMachine?: unknown;
}

/**
 * Builder role controller implementation using state machines
 */
export class BuilderController extends BaseRoleController<BuilderMemory> {
  private machines: Map<string, StateMachine<BuilderContext, BuilderEvent>> = new Map();

  public constructor() {
    const config: RoleConfig<BuilderMemory> = {
      minimum: 2,
      body: [WORK, CARRY, MOVE, MOVE],
      version: 1,
      createMemory: () => ({
        role: "builder",
        task: "gather",
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "builder";
  }

  private lastCleanupTick = 0;

  public execute(creep: CreepLike): string {
    const memory = creep.memory as BuilderMemory;
    const comm = serviceRegistry.getCommunicationManager();
    const energyMgr = serviceRegistry.getEnergyPriorityManager();
    const wallMgr = serviceRegistry.getWallUpgradeManager();

    // Clean up machines for dead creeps every 10 ticks to prevent memory leaks
    if (typeof Game !== "undefined" && Game.time - this.lastCleanupTick >= 10) {
      this.cleanupDeadCreepMachines();
      this.lastCleanupTick = Game.time;
    }

    // Get or create state machine for this creep
    let machine = this.machines.get(creep.name);
    if (!machine) {
      if (memory.stateMachine) {
        machine = restore<BuilderContext, BuilderEvent>(memory.stateMachine, builderStates);
      } else {
        machine = new StateMachine<BuilderContext, BuilderEvent>(BUILDER_INITIAL_STATE, builderStates, {
          creep: creep as Creep
        });
      }
      this.machines.set(creep.name, machine);
    }

    // Update creep reference in context every tick
    machine.getContext().creep = creep as Creep;

    const ctx = machine.getContext();
    const currentState = machine.getState();

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
        const spawn = creep.pos.findClosestByPath(spawnsNeedingEnergy) ?? spawnsNeedingEnergy[0];
        const result = creep.transfer(spawn, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(spawn, { range: 1, reusePath: 10, visualizePathStyle: { stroke: "#ff0000" } });
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
    if (currentState === "gather") {
      comm?.say(creep, "gather");

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

      // Priority 2: Use energy priority manager to get available sources (respecting reserves)
      const energySources = energyMgr
        ? energyMgr.getAvailableEnergySources(creep.room, 0, true)
        : creep.room.find(FIND_STRUCTURES, {
            filter: isValidEnergySource
          });

      const target = energySources.length > 0 ? (creep.pos.findClosestByPath(energySources) ?? energySources[0]) : null;
      if (target) {
        const result = creep.withdraw(target, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { range: 1, reusePath: 30 });
        }
        // Check if full after withdrawal
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
          machine.send({ type: "ENERGY_FULL" });
        }
        // Save state to memory and return current state
        memory.stateMachine = serialize(machine);
        memory.task = machine.getState();
        return memory.task;
      }

      // Priority 3: Harvest from sources directly if no other options
      const sources = creep.room.find(FIND_SOURCES_ACTIVE) as Source[];
      const source = sources.length > 0 ? (creep.pos.findClosestByPath(sources) ?? sources[0]) : null;
      if (source) {
        const harvestResult = creep.harvest(source);
        if (harvestResult === ERR_NOT_IN_RANGE) {
          creep.moveTo(source, { range: 1, reusePath: 30 });
        }
        // Check if full after harvest
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
          machine.send({ type: "ENERGY_FULL" });
        }
      }
    } else if (currentState === "build") {
      comm?.say(creep, "build");

      // Prioritize construction sites by structure type
      const constructionPriorities = [
        STRUCTURE_SPAWN,
        STRUCTURE_EXTENSION,
        STRUCTURE_TOWER,
        STRUCTURE_CONTAINER,
        STRUCTURE_STORAGE,
        STRUCTURE_ROAD, // Roads lower priority but still automated
        STRUCTURE_RAMPART,
        STRUCTURE_WALL
      ];

      const sites = creep.room.find(FIND_CONSTRUCTION_SITES) as ConstructionSite[];

      // Find highest priority site
      let site: ConstructionSite | null = null;
      for (const structureType of constructionPriorities) {
        const prioritySites = sites.filter(s => s.structureType === structureType);
        if (prioritySites.length > 0) {
          site = creep.pos.findClosestByPath(prioritySites) ?? prioritySites[0];
          break;
        }
      }

      if (site) {
        machine.send({ type: "START_BUILD", targetId: site.id });
        const result = creep.build(site);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(site, { range: 3, reusePath: 30 });
        }
        // Check if empty after building
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
          machine.send({ type: "ENERGY_EMPTY" });
        }
      } else {
        // No construction sites available, switch to maintain
        machine.send({ type: "NO_CONSTRUCTION" });
      }
    } else if (currentState === "maintain") {
      // Maintain (repair/upgrade) fallback
      comm?.say(creep, "repair");

      const targetHits = wallMgr?.getTargetHits(creep.room) ?? 0;
      const repairTargets = creep.room.find(FIND_STRUCTURES, {
        filter: (structure: AnyStructure) => {
          if (!("hits" in structure) || typeof structure.hits !== "number") {
            return false;
          }

          if (structure.structureType === STRUCTURE_WALL) {
            return structure.hits < targetHits;
          }

          if (structure.structureType === STRUCTURE_RAMPART) {
            return structure.hits < targetHits;
          }

          return structure.hits < structure.hitsMax;
        }
      }) as Structure[];

      const target = repairTargets.length > 0 ? (creep.pos.findClosestByPath(repairTargets) ?? repairTargets[0]) : null;
      if (target) {
        machine.send({ type: "START_MAINTAIN", targetId: target.id });
        const result = creep.repair(target);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { range: 3, reusePath: 30 });
        }
        // Check if empty after repair
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
          machine.send({ type: "ENERGY_EMPTY" });
        }
      } else {
        // No repair targets, upgrade controller as fallback
        const controller = creep.room.controller;
        if (controller) {
          const upgrade = creep.upgradeController(controller);
          if (upgrade === ERR_NOT_IN_RANGE) {
            creep.moveTo(controller, { range: 3, reusePath: 30 });
          }
          // Check if empty after upgrade
          if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            machine.send({ type: "ENERGY_EMPTY" });
          }
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
