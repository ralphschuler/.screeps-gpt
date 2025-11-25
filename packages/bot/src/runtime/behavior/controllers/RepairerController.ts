/**
 * Repairer Role Controller
 *
 * Repairers are responsible for:
 * - Gathering energy from containers or storage
 * - Repairing infrastructure (roads, containers) at 50% health
 * - Repairing other damaged structures
 * - Prioritizing source containers over other repairs
 *
 * Uses state machine from screeps-xstate for declarative behavior management.
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";
import { tryPickupDroppedEnergy, findClosestOrFirst, isValidEnergySource } from "./helpers";
import { StateMachine, serialize, restore } from "@ralphschuler/screeps-xstate";
import {
  repairerStates,
  REPAIRER_INITIAL_STATE,
  type RepairerContext,
  type RepairerEvent
} from "../stateMachines/repairer";

interface RepairerMemory extends CreepMemory {
  role: "repairer";
  task: string;
  version: number;
  stateMachine?: unknown;
}

/**
 * Repairer role controller implementation using state machines
 */
export class RepairerController extends BaseRoleController<RepairerMemory> {
  private machines: Map<string, StateMachine<RepairerContext, RepairerEvent>> = new Map();

  public constructor() {
    const config: RoleConfig<RepairerMemory> = {
      minimum: 0,
      body: [WORK, WORK, CARRY, MOVE, MOVE],
      version: 1,
      createMemory: () => ({
        role: "repairer",
        task: "gather",
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "repairer";
  }

  private lastCleanupTick = 0;

  public execute(creep: CreepLike): string {
    const memory = creep.memory as RepairerMemory;
    const comm = serviceRegistry.getCommunicationManager();
    const energyMgr = serviceRegistry.getEnergyPriorityManager();
    const wallMgr = serviceRegistry.getWallUpgradeManager();

    // Clean up machines for dead creeps every 10 ticks
    if (typeof Game !== "undefined" && Game.time - this.lastCleanupTick >= 10) {
      this.cleanupDeadCreepMachines();
      this.lastCleanupTick = Game.time;
    }

    // Get or create state machine for this creep
    let machine = this.machines.get(creep.name);
    if (!machine) {
      if (memory.stateMachine) {
        machine = restore<RepairerContext, RepairerEvent>(memory.stateMachine, repairerStates);
      } else {
        // Use memory.task as initial state if available (for backwards compatibility)
        const initialState = memory.task === "repair" ? "repair" : REPAIRER_INITIAL_STATE;
        machine = new StateMachine<RepairerContext, RepairerEvent>(initialState, repairerStates, {
          creep: creep as Creep
        });
      }
      this.machines.set(creep.name, machine);
    }

    // Update creep reference in context every tick
    machine.getContext().creep = creep as Creep;

    const currentState = machine.getState();

    if (currentState === "gather") {
      comm?.say(creep, "gather");

      // Use energy priority manager to get available sources (respecting reserves)
      const energySources = energyMgr
        ? energyMgr.getAvailableEnergySources(creep.room, 50, true)
        : creep.room.find(FIND_STRUCTURES, {
            filter: s => isValidEnergySource(s, 50)
          });

      const target = findClosestOrFirst(creep, energySources);
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

      // Priority 2: Pick up dropped energy
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

      // Priority 3: Harvest from sources directly if no other options
      const sources = creep.room.find(FIND_SOURCES_ACTIVE) as Source[];
      const source = findClosestOrFirst(creep, sources);
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
    } else if (currentState === "repair") {
      comm?.say(creep, "repair");

      // Priority 1: Roads and containers (infrastructure)
      const infrastructureTargets = creep.room.find(FIND_STRUCTURES, {
        filter: (structure: AnyStructure) => {
          if (!("hits" in structure) || typeof structure.hits !== "number") {
            return false;
          }

          // Prioritize roads when below 50% health
          if (structure.structureType === STRUCTURE_ROAD) {
            return structure.hits < structure.hitsMax * 0.5;
          }

          // Prioritize containers when below 50% health
          if (structure.structureType === STRUCTURE_CONTAINER) {
            return structure.hits < structure.hitsMax * 0.5;
          }

          return false;
        }
      }) as Structure[];

      // Sort infrastructure targets to prioritize source containers
      const sources = creep.room.find(FIND_SOURCES) as Source[];
      if (infrastructureTargets.length > 1) {
        infrastructureTargets.sort((a, b) => {
          const isAContainer = a.structureType === STRUCTURE_CONTAINER;
          const isBContainer = b.structureType === STRUCTURE_CONTAINER;

          // Both are containers - prioritize by proximity to sources
          if (isAContainer && isBContainer) {
            const aNearSource = sources.some(s => s.pos.inRangeTo(a.pos, 2));
            const bNearSource = sources.some(s => s.pos.inRangeTo(b.pos, 2));

            if (aNearSource && !bNearSource) return -1;
            if (!aNearSource && bNearSource) return 1;

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
            const aDist = creep.pos.getRangeTo(a.pos);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
            const bDist = creep.pos.getRangeTo(b.pos);
            return aDist - bDist;
          }

          // Containers prioritized over roads
          if (isAContainer && !isBContainer) return -1;
          if (!isAContainer && isBContainer) return 1;

          // Both are same type - use distance
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
          const aDist = creep.pos.getRangeTo(a.pos);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
          const bDist = creep.pos.getRangeTo(b.pos);
          return aDist - bDist;
        });
      }

      if (infrastructureTargets.length > 0) {
        const target = creep.pos.findClosestByPath(infrastructureTargets) ?? infrastructureTargets[0];
        if (target) {
          machine.send({ type: "START_REPAIR", targetId: target.id });
          const result = creep.repair(target);
          if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { range: 3, reusePath: 30 });
          }
          // Check if empty after repair
          if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            machine.send({ type: "ENERGY_EMPTY" });
          }
          // Save state to memory and return current state
          memory.stateMachine = serialize(machine);
          memory.task = machine.getState();
          return memory.task;
        }
      }

      // Priority 2: Other structures (excluding walls and ramparts)
      const targetHits = wallMgr?.getTargetHits(creep.room) ?? 0;
      const repairTargets = creep.room.find(FIND_STRUCTURES, {
        filter: (structure: AnyStructure) => {
          if (!("hits" in structure) || typeof structure.hits !== "number") {
            return false;
          }

          // Skip infrastructure (already handled above)
          if (structure.structureType === STRUCTURE_ROAD || structure.structureType === STRUCTURE_CONTAINER) {
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

      const target = findClosestOrFirst(creep, repairTargets);
      if (target) {
        machine.send({ type: "START_REPAIR", targetId: target.id });
        const result = creep.repair(target);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { range: 3, reusePath: 30 });
        }
        // Check if empty after repair
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
          machine.send({ type: "ENERGY_EMPTY" });
        }
        // Save state to memory and return current state
        memory.stateMachine = serialize(machine);
        memory.task = machine.getState();
        return memory.task;
      }

      // No repairs needed, upgrade controller as fallback
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
