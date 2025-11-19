import { process } from "@ralphschuler/screeps-kernel";
import type { ProcessContext } from "@ralphschuler/screeps-kernel";
import { DecisionTreeBuilder } from "@ralphschuler/screeps-xtree";
import type { DecisionTree } from "@ralphschuler/screeps-xtree";

/**
 * Builder decision context
 */
interface BuilderDecisionContext {
  creep: Creep;
  hasEnergy: boolean;
  constructionSites: number;
  damagedStructures: number;
  controllerNeedsUpgrade: boolean;
}

/**
 * Builder actions
 */
type BuilderAction = "harvest" | "build" | "repair" | "upgrade" | "idle";

/**
 * Builder process using screeps-xtree for decision-making
 * 
 * Demonstrates:
 * - @process decorator for automatic registration
 * - screeps-xtree for decision tree-based strategy
 * - Priority-based construction management
 */
@process({ name: "Builder", priority: 40, singleton: true })
export class BuilderProcess {
  private decisionTree: DecisionTree<BuilderDecisionContext, BuilderAction>;

  constructor() {
    this.decisionTree = this.createDecisionTree();
  }

  public run(ctx: ProcessContext): void {
    const { game } = ctx;

    // Find all builder creeps
    const builders = Object.values(game.creeps).filter(
      (creep: Creep) => creep.memory.role === "builder" && !creep.spawning
    );

    if (builders.length === 0) {
      return;
    }

    if (ctx.logger && ctx.logger.log) {
      ctx.logger.log(`[Builder] Processing ${builders.length} builders`);
    }

    // Process each builder
    for (const creep of builders) {
      this.processBuilder(creep);
    }
  }

  private createDecisionTree(): DecisionTree<BuilderDecisionContext, BuilderAction> {
    const builder = new DecisionTreeBuilder<BuilderDecisionContext, BuilderAction>();

    return builder.build(
      builder.if(
        // First check: does the creep have energy?
        (ctx) => ctx.hasEnergy,
        // TRUE: Has energy - decide what to do
        builder.switch(
          [
            {
              condition: (ctx) => ctx.constructionSites > 0,
              node: builder.leaf("build")
            },
            {
              condition: (ctx) => ctx.damagedStructures > 0,
              node: builder.leaf("repair")
            },
            {
              condition: (ctx) => ctx.controllerNeedsUpgrade,
              node: builder.leaf("upgrade")
            }
          ],
          builder.leaf("idle")
        ),
        // FALSE: No energy - harvest
        builder.leaf("harvest")
      )
    );
  }

  private processBuilder(creep: Creep): void {
    // Build decision context
    const room = creep.room;
    const context: BuilderDecisionContext = {
      creep,
      hasEnergy: creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0,
      constructionSites: room.find(FIND_MY_CONSTRUCTION_SITES).length,
      damagedStructures: room.find(FIND_STRUCTURES, {
        filter: (s: Structure) => s.hits < s.hitsMax && s.structureType !== STRUCTURE_WALL
      }).length,
      controllerNeedsUpgrade: room.controller ? room.controller.level < 8 : false
    };

    // Use decision tree to determine action
    const action = this.decisionTree.evaluate(context);

    // Execute the determined action
    switch (action) {
      case "harvest":
        this.harvest(creep);
        break;
      case "build":
        this.build(creep);
        break;
      case "repair":
        this.repair(creep);
        break;
      case "upgrade":
        this.upgrade(creep);
        break;
      case "idle":
        creep.say("💤");
        break;
    }
  }

  private harvest(creep: Creep): void {
    const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
    if (!source) {
      return;
    }

    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
      creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
    }
    creep.say("⛏️");
  }

  private build(creep: Creep): void {
    const target = creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES);
    if (!target) {
      return;
    }

    if (creep.build(target) === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { visualizePathStyle: { stroke: "#00ff00" } });
    }
    creep.say("🔨");
  }

  private repair(creep: Creep): void {
    const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (s: Structure) => s.hits < s.hitsMax && s.structureType !== STRUCTURE_WALL
    });

    if (!target) {
      return;
    }

    if (creep.repair(target) === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { visualizePathStyle: { stroke: "#0000ff" } });
    }
    creep.say("🔧");
  }

  private upgrade(creep: Creep): void {
    const controller = creep.room.controller;
    if (!controller) {
      return;
    }

    if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, { visualizePathStyle: { stroke: "#ff00ff" } });
    }
    creep.say("⚡");
  }
}
