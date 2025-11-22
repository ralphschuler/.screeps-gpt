/**
 * Harvester Role Executor
 *
 * Executes harvester behavior using state machine from screeps-xstate.
 * This is a reference implementation demonstrating state machine integration.
 */

import type { StateMachine } from "@ralphschuler/screeps-xstate";
import type { HarvesterContext, HarvesterEvent } from "../stateMachines/harvester";

/**
 * Execute harvester behavior using state machine.
 * Returns the task name for backward compatibility.
 */
export function executeHarvester(creep: Creep, machine: StateMachine<HarvesterContext, HarvesterEvent>): string {
  const ctx = machine.getContext();
  const currentState = machine.getState();

  // State: idle - Find a source to harvest
  if (currentState === "idle") {
    const sources = creep.room.find(FIND_SOURCES_ACTIVE);
    if (sources.length > 0) {
      const source = creep.pos.findClosestByPath(sources) ?? sources[0];
      machine.send({ type: "START_HARVEST", sourceId: source.id });
    }
    return "harvest";
  }

  // State: harvesting - Harvest energy from source
  if (currentState === "harvesting") {
    if (!ctx.sourceId) {
      machine.send({ type: "SOURCE_DEPLETED" });
      return "harvest";
    }

    const source = Game.getObjectById(ctx.sourceId);
    if (!source || source.energy === 0) {
      machine.send({ type: "SOURCE_DEPLETED" });
      return "harvest";
    }

    const harvestResult = creep.harvest(source);
    if (harvestResult === ERR_NOT_IN_RANGE) {
      creep.moveTo(source, { range: 1, reusePath: 30 });
    }

    // Check if full
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      machine.send({ type: "ENERGY_FULL" });
    }

    return "harvest";
  }

  // State: delivering - Deliver energy to spawns/extensions
  if (currentState === "delivering") {
    // Find spawn/extension that needs energy
    const targets = creep.room.find(FIND_MY_STRUCTURES, {
      filter: structure =>
        (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) &&
        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });

    if (targets.length === 0) {
      machine.send({ type: "TARGET_FULL" });
      return "deliver";
    }

    const target = creep.pos.findClosestByPath(targets) ?? targets[0];
    if (!ctx.targetId || ctx.targetId !== target.id) {
      machine.send({ type: "START_DELIVER", targetId: target.id });
    }

    const transferResult = creep.transfer(target, RESOURCE_ENERGY);
    if (transferResult === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { range: 1, reusePath: 30 });
    }

    // Check if empty
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      machine.send({ type: "ENERGY_EMPTY" });
    }

    return "deliver";
  }

  // State: upgrading - Upgrade controller when no delivery targets
  if (currentState === "upgrading") {
    const controller = creep.room.controller;
    if (controller) {
      const upgradeResult = creep.upgradeController(controller);
      if (upgradeResult === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { range: 3, reusePath: 30 });
      }

      // Check if empty
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        machine.send({ type: "ENERGY_EMPTY" });
      }
    } else {
      machine.send({ type: "ENERGY_EMPTY" });
    }

    return "upgrade";
  }

  return "harvest";
}
