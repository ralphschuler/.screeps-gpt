/**
 * Example: Composable State Machine Patterns
 *
 * This example demonstrates how to use composition utilities to create
 * reusable and maintainable state machine configurations.
 */

import { StateMachine, mergeStates, createStateFactory, prefixStates, createBridge, assign } from "../src/index.js";
import type { StateConfig } from "../src/types.js";

// ===== Example 1: State Factories =====

interface CreepContext {
  creep: Creep;
  targetId?: Id<Source | Structure>;
  energy: number;
}

type CreepEvent =
  | { type: "START_WORK" }
  | { type: "START_COMBAT" }
  | { type: "ENERGY_FULL" }
  | { type: "ENERGY_EMPTY" }
  | { type: "ENEMY_DETECTED" }
  | { type: "SAFE" };

// Create a reusable state factory for energy-based behavior
const createEnergyStates = createStateFactory<CreepContext, CreepEvent, { mode: string }>(({ mode }) => ({
  idle: {
    onEntry: [ctx => ctx.creep.say(`💤 ${mode} idle`)],
    on: {
      START_WORK: { target: "gathering" }
    }
  },
  gathering: {
    onEntry: [ctx => ctx.creep.say(`⛏️ ${mode} gathering`)],
    on: {
      ENERGY_FULL: {
        target: "working",
        guard: ctx => ctx.energy >= 50
      }
    }
  },
  working: {
    onEntry: [ctx => ctx.creep.say(`🔨 ${mode} working`)],
    on: {
      ENERGY_EMPTY: {
        target: "idle",
        guard: ctx => ctx.energy === 0
      }
    }
  }
}));

// ===== Example 2: Prefixed States for Multi-Mode Creeps =====

// Create work mode states
const workStates = prefixStates<CreepContext, CreepEvent>("work_", createEnergyStates({ mode: "work" }));

// Create combat mode states
const combatStates = prefixStates<CreepContext, CreepEvent>("combat_", createEnergyStates({ mode: "combat" }));

// ===== Example 3: Bridging Between Modes =====

// Create bridges to switch between work and combat modes
const workToCombat = createBridge<CreepContext, CreepEvent>("work_idle", "ENEMY_DETECTED", "combat_gathering", ctx => {
  const enemies = ctx.creep.room.find(FIND_HOSTILE_CREEPS);
  return enemies.length > 0;
});

const combatToWork = createBridge<CreepContext, CreepEvent>("combat_idle", "SAFE", "work_gathering", ctx => {
  const enemies = ctx.creep.room.find(FIND_HOSTILE_CREEPS);
  return enemies.length === 0;
});

// ===== Example 4: Merging Everything Together =====

const multiModeStates = mergeStates<CreepContext, CreepEvent>(workStates, combatStates, workToCombat, combatToWork);

// ===== Example 5: Using the Composed State Machine =====

export function runMultiModeCreep(creep: Creep): void {
  // Initialize or restore state machine
  let machine: StateMachine<CreepContext, CreepEvent>;

  if (creep.memory.stateMachine) {
    // Restore from memory (implementation depends on your serialization)
    machine = new StateMachine("work_idle", multiModeStates, {
      creep,
      energy: creep.store.getUsedCapacity(RESOURCE_ENERGY)
    });
  } else {
    machine = new StateMachine("work_idle", multiModeStates, {
      creep,
      energy: creep.store.getUsedCapacity(RESOURCE_ENERGY)
    });
  }

  // Update context
  machine.getContext().energy = creep.store.getUsedCapacity(RESOURCE_ENERGY);

  // Check for mode transitions
  const enemies = creep.room.find(FIND_HOSTILE_CREEPS);
  if (enemies.length > 0 && machine.getState().startsWith("work_")) {
    machine.send({ type: "ENEMY_DETECTED" });
  } else if (enemies.length === 0 && machine.getState().startsWith("combat_")) {
    machine.send({ type: "SAFE" });
  }

  // Execute state-specific behavior
  if (machine.matches("work_idle") || machine.matches("combat_idle")) {
    machine.send({ type: "START_WORK" });
  } else if (machine.matches("work_gathering") || machine.matches("combat_gathering")) {
    const sources = creep.room.find(FIND_SOURCES);
    if (sources.length > 0) {
      const source = creep.pos.findClosestByPath(sources);
      if (source) {
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
          creep.moveTo(source);
        }
        if (creep.store.getFreeCapacity() === 0) {
          machine.send({ type: "ENERGY_FULL" });
        }
      }
    }
  } else if (machine.matches("work_working")) {
    // Work mode: build or upgrade
    const sites = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
    if (sites.length > 0) {
      const site = creep.pos.findClosestByPath(sites);
      if (site) {
        if (creep.build(site) === ERR_NOT_IN_RANGE) {
          creep.moveTo(site);
        }
      }
    } else if (creep.room.controller) {
      if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller);
      }
    }

    if (creep.store.getUsedCapacity() === 0) {
      machine.send({ type: "ENERGY_EMPTY" });
    }
  } else if (machine.matches("combat_working")) {
    // Combat mode: attack enemies
    if (enemies.length > 0) {
      const target = creep.pos.findClosestByPath(enemies);
      if (target) {
        if (creep.attack(target) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target);
        }
      }
    }
  }
}

// ===== Example 6: Role-Based State Factories =====

const createRoleStates = createStateFactory<CreepContext, CreepEvent, { role: string; primaryTask: string }>(
  ({ role, primaryTask }) => ({
    [`${role}_idle`]: {
      onEntry: [assign("energy", 0)],
      on: {
        START_WORK: { target: `${role}_active` }
      }
    },
    [`${role}_active`]: {
      onEntry: [ctx => ctx.creep.say(`${primaryTask}`)],
      on: {
        ENERGY_EMPTY: { target: `${role}_idle` }
      }
    }
  })
);

const harvesterStates = createRoleStates({ role: "harvester", primaryTask: "Harvesting" });
const builderStates = createRoleStates({ role: "builder", primaryTask: "Building" });
const upgraderStates = createRoleStates({ role: "upgrader", primaryTask: "Upgrading" });

// Merge all role states for a flexible creep management system
export const allRoleStates = mergeStates<CreepContext, CreepEvent>(harvesterStates, builderStates, upgraderStates);

// Now you can create creeps with different roles but using the same state configuration
export function createRoleBasedMachine(creep: Creep, role: string): StateMachine<CreepContext, CreepEvent> {
  return new StateMachine(`${role}_idle`, allRoleStates, {
    creep,
    energy: creep.store.getUsedCapacity(RESOURCE_ENERGY)
  });
}
