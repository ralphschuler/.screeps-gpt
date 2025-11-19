import { process } from "@ralphschuler/screeps-kernel";
import type { ProcessContext } from "@ralphschuler/screeps-kernel";
import { DecisionTreeBuilder } from "@ralphschuler/screeps-xtree";
import type { DecisionTree } from "@ralphschuler/screeps-xtree";

/**
 * Room strategy decision context
 */
interface RoomStrategyContext {
  room: Room;
  energyAvailable: number;
  energyCapacity: number;
  controllerLevel: number;
  hostiles: number;
  spawnQueue: number;
  harvesterCount: number;
  builderCount: number;
  upgraderCount: number;
}

/**
 * Room strategy actions
 */
type RoomStrategyAction = "spawn_harvester" | "spawn_builder" | "spawn_upgrader" | "defend" | "expand" | "consolidate" | "idle";

/**
 * Room process using screeps-xtree for strategic decision-making
 * 
 * Demonstrates:
 * - @process decorator for automatic registration
 * - screeps-xtree for room-level strategic decisions
 * - Decision tree-based room management
 */
@process({ name: "Room", priority: 70, singleton: true })
export class RoomProcess {
  private decisionTree: DecisionTree<RoomStrategyContext, RoomStrategyAction>;

  constructor() {
    this.decisionTree = this.createDecisionTree();
  }

  public run(ctx: ProcessContext): void {
    const { game } = ctx;

    // Process each owned room
    for (const roomName in game.rooms) {
      const room = game.rooms[roomName];
      if (room.controller && room.controller.my) {
        this.processRoom(room, ctx);
      }
    }
  }

  private createDecisionTree(): DecisionTree<RoomStrategyContext, RoomStrategyAction> {
    const builder = new DecisionTreeBuilder<RoomStrategyContext, RoomStrategyAction>();

    return builder.build(
      builder.if(
        // First: Check for hostiles (emergency)
        (ctx) => ctx.hostiles > 0,
        builder.leaf("defend"),
        // No hostiles: Normal operations
        builder.switch(
          [
            {
              // Emergency: No harvesters
              condition: (ctx) => ctx.harvesterCount === 0,
              node: builder.leaf("spawn_harvester")
            },
            {
              // Need more harvesters (one per source)
              condition: (ctx) => ctx.harvesterCount < 2,
              node: builder.leaf("spawn_harvester")
            },
            {
              // Need builders if construction sites exist
              condition: (ctx) => ctx.builderCount < 2,
              node: builder.leaf("spawn_builder")
            },
            {
              // Always maintain upgraders for controller
              condition: (ctx) => ctx.upgraderCount < 1,
              node: builder.leaf("spawn_upgrader")
            },
            {
              // High level room: Consider expansion
              condition: (ctx) => ctx.controllerLevel >= 6,
              node: builder.leaf("expand")
            },
            {
              // Mid-level room: Consolidate defenses
              condition: (ctx) => ctx.controllerLevel >= 3,
              node: builder.leaf("consolidate")
            }
          ],
          builder.leaf("idle")
        )
      )
    );
  }

  private processRoom(room: Room, ctx: ProcessContext): void {
    // Build strategy context
    const strategyContext: RoomStrategyContext = {
      room,
      energyAvailable: room.energyAvailable,
      energyCapacity: room.energyCapacityAvailable,
      controllerLevel: room.controller?.level || 0,
      hostiles: room.find(FIND_HOSTILE_CREEPS).length,
      spawnQueue: this.getSpawnQueueLength(room),
      harvesterCount: this.getCreepCountByRole(room, "harvester"),
      builderCount: this.getCreepCountByRole(room, "builder"),
      upgraderCount: this.getCreepCountByRole(room, "upgrader")
    };

    // Use decision tree to determine strategy
    const action = this.decisionTree.evaluate(strategyContext);

    if (ctx.logger && ctx.logger.log) {
      ctx.logger.log(`[Room ${room.name}] Strategy: ${action}`);
    }

    // Execute the determined action
    switch (action) {
      case "spawn_harvester":
        this.spawnCreep(room, "harvester", [WORK, CARRY, MOVE], ctx);
        break;
      case "spawn_builder":
        this.spawnCreep(room, "builder", [WORK, CARRY, MOVE], ctx);
        break;
      case "spawn_upgrader":
        this.spawnCreep(room, "upgrader", [WORK, CARRY, MOVE], ctx);
        break;
      case "defend":
        if (ctx.logger && ctx.logger.log) ctx.logger.log(`[Room ${room.name}] Defense mode activated`);
        // Defense handled by TowerProcess
        break;
      case "expand":
        if (ctx.logger && ctx.logger.log) ctx.logger.log(`[Room ${room.name}] Expansion phase`);
        // Expansion logic would go here
        break;
      case "consolidate":
        if (ctx.logger && ctx.logger.log) ctx.logger.log(`[Room ${room.name}] Consolidation phase`);
        // Consolidation logic would go here
        break;
      case "idle":
        // Room is stable, no action needed
        break;
    }
  }

  private getCreepCountByRole(room: Room, role: string): number {
    return Object.values(Game.creeps).filter(
      (creep: Creep) => creep.memory.role === role && creep.room.name === room.name && !creep.spawning
    ).length;
  }

  private getSpawnQueueLength(room: Room): number {
    const spawns = room.find(FIND_MY_SPAWNS);
    return spawns.filter((spawn) => spawn.spawning).length;
  }

  private spawnCreep(room: Room, role: string, body: BodyPartConstant[], ctx: ProcessContext): void {
    const spawns = room.find(FIND_MY_SPAWNS, {
      filter: (spawn: StructureSpawn) => !spawn.spawning
    });

    if (spawns.length === 0) {
      return;
    }

    const spawn = spawns[0];
    if (!spawn) return;
    
    const name = `${role}_${Game.time}`;
    
    const result = spawn.spawnCreep(body, name, {
      memory: { role }
    });

    if (result === OK && ctx.logger && ctx.logger.log) {
      ctx.logger.log(`[Room ${room.name}] Spawning ${role}: ${name}`);
    }
  }
}
