import { process } from "@ralphschuler/screeps-kernel";
import type { ProcessContext } from "@ralphschuler/screeps-kernel";
import { StateMachine } from "@ralphschuler/screeps-xstate";

/**
 * Harvester context for state machine
 */
interface HarvesterContext {
  creep: Creep;
  sourceId?: Id<Source> | undefined;
}

/**
 * Harvester events
 */
type HarvesterEvent =
  | { type: "FIND_SOURCE" }
  | { type: "HARVEST" }
  | { type: "ENERGY_FULL" }
  | { type: "DELIVER" }
  | { type: "ENERGY_EMPTY" };

/**
 * Harvester process using screeps-xstate for state machine behavior
 * 
 * Demonstrates:
 * - @process decorator for automatic registration
 * - screeps-xstate for state-based creep behavior
 * - Modular process design with kernel integration
 */
@process({ name: "Harvester", priority: 50, singleton: true })
export class HarvesterProcess {
  private machines: Map<string, StateMachine<HarvesterContext, HarvesterEvent>> = new Map();

  public run(ctx: ProcessContext): void {
    const { game } = ctx;

    // Find all harvester creeps
    const harvesters = Object.values(game.creeps).filter(
      (creep: Creep) => creep.memory.role === "harvester" && !creep.spawning
    );

    if (harvesters.length === 0) {
      return;
    }

    if (ctx.logger && ctx.logger.log) {
      ctx.logger.log(`[Harvester] Processing ${harvesters.length} harvesters`);
    }

    // Process each harvester
    for (const creep of harvesters) {
      this.processHarvester(creep);
    }
  }

  private processHarvester(creep: Creep): void {
    // Get or create state machine
    let machine = this.machines.get(creep.name);

    if (!machine) {
      machine = this.createStateMachine(creep);
      this.machines.set(creep.name, machine);
    }

    // Update creep reference
    const context = machine.getContext();
    context.creep = creep;

    // Execute state-based behavior
    const state = machine.getState();

    switch (state) {
      case "idle":
        machine.send({ type: "FIND_SOURCE" });
        break;

      case "finding_source":
        this.findSource(machine);
        break;

      case "harvesting":
        this.harvest(machine);
        break;

      case "returning":
        machine.send({ type: "DELIVER" });
        break;

      case "delivering":
        this.deliver(machine);
        break;
    }
  }

  private createStateMachine(creep: Creep): StateMachine<HarvesterContext, HarvesterEvent> {
    return new StateMachine<HarvesterContext, HarvesterEvent>(
      "idle",
      {
        idle: {
          onEntry: [(ctx: HarvesterContext) => ctx.creep.say("💤")],
          on: {
            FIND_SOURCE: { target: "finding_source" }
          }
        },
        finding_source: {
          onEntry: [(ctx: HarvesterContext) => ctx.creep.say("🔍")],
          on: {
            HARVEST: { target: "harvesting" }
          }
        },
        harvesting: {
          onEntry: [(ctx: HarvesterContext) => ctx.creep.say("⛏️")],
          on: {
            ENERGY_FULL: {
              target: "returning",
              guard: (ctx: HarvesterContext) => ctx.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
            }
          }
        },
        returning: {
          onEntry: [(ctx: HarvesterContext) => ctx.creep.say("🔙")],
          on: {
            DELIVER: { target: "delivering" }
          }
        },
        delivering: {
          onEntry: [(ctx: HarvesterContext) => ctx.creep.say("📦")],
          on: {
            ENERGY_EMPTY: {
              target: "idle",
              guard: (ctx: HarvesterContext) => ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0
            }
          }
        }
      },
      { creep }
    );
  }

  private findSource(machine: StateMachine<HarvesterContext, HarvesterEvent>): void {
    const context = machine.getContext();
    const source = context.creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);

    if (source) {
      context.sourceId = source.id;
      machine.send({ type: "HARVEST" });
    }
  }

  private harvest(machine: StateMachine<HarvesterContext, HarvesterEvent>): void {
    const context = machine.getContext();
    const { creep, sourceId } = context;

    if (!sourceId) {
      machine.send({ type: "FIND_SOURCE" });
      return;
    }

    const source = Game.getObjectById(sourceId);
    if (!source) {
      context.sourceId = undefined;
      machine.send({ type: "FIND_SOURCE" });
      return;
    }

    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
      creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
    }

    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      machine.send({ type: "ENERGY_FULL" });
    }
  }

  private deliver(machine: StateMachine<HarvesterContext, HarvesterEvent>): void {
    const context = machine.getContext();
    const { creep } = context;

    const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure: Structure) => {
        return (
          (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) &&
          (structure as StructureSpawn | StructureExtension).store.getFreeCapacity(RESOURCE_ENERGY) > 0
        );
      }
    });

    if (!target) {
      machine.send({ type: "ENERGY_EMPTY" });
      return;
    }

    const result = creep.transfer(target as StructureSpawn | StructureExtension, RESOURCE_ENERGY);

    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
    } else if (result === OK || creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      machine.send({ type: "ENERGY_EMPTY" });
    }
  }
}
