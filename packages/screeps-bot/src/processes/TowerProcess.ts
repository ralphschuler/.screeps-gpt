import { process } from "@ralphschuler/screeps-kernel";
import type { ProcessContext } from "@ralphschuler/screeps-kernel";
import { StateMachine } from "@ralphschuler/screeps-xstate";

/**
 * Tower context for state machine
 */
interface TowerContext {
  tower: StructureTower;
  targetId?: Id<Creep | Structure> | undefined;
}

/**
 * Tower events
 */
type TowerEvent =
  | { type: "FIND_HOSTILE" }
  | { type: "ATTACK" }
  | { type: "FIND_DAMAGED" }
  | { type: "REPAIR" }
  | { type: "IDLE" };

/**
 * Tower process using screeps-xstate for state machine behavior
 * 
 * Demonstrates:
 * - @process decorator for automatic registration
 * - screeps-xstate for tower behavior states
 * - Priority-based defense and repair logic
 */
@process({ name: "Tower", priority: 60, singleton: true })
export class TowerProcess {
  private machines: Map<string, StateMachine<TowerContext, TowerEvent>> = new Map();

  public run(ctx: ProcessContext): void {
    const { game } = ctx;

    // Find all towers
    const towers: StructureTower[] = [];
    for (const roomName in game.rooms) {
      const room = game.rooms[roomName];
      if (room.controller && room.controller.my) {
        const roomTowers = room.find(FIND_MY_STRUCTURES, {
          filter: (s: Structure) => s.structureType === STRUCTURE_TOWER
        }) as StructureTower[];
        towers.push(...roomTowers);
      }
    }

    if (towers.length === 0) {
      return;
    }

    if (ctx.logger && ctx.logger.log) {
      ctx.logger.log(`[Tower] Processing ${towers.length} towers`);
    }

    // Process each tower
    for (const tower of towers) {
      this.processTower(tower);
    }
  }

  private processTower(tower: StructureTower): void {
    // Get or create state machine
    let machine = this.machines.get(tower.id);

    if (!machine) {
      machine = this.createStateMachine(tower);
      this.machines.set(tower.id, machine);
    }

    // Update tower reference
    const context = machine.getContext();
    context.tower = tower;

    // Execute state-based behavior
    const state = machine.getState();

    switch (state) {
      case "idle":
        this.checkForThreats(machine);
        break;

      case "finding_hostile":
        this.findHostile(machine);
        break;

      case "attacking":
        this.attack(machine);
        break;

      case "finding_damaged":
        this.findDamaged(machine);
        break;

      case "repairing":
        this.repair(machine);
        break;
    }
  }

  private createStateMachine(tower: StructureTower): StateMachine<TowerContext, TowerEvent> {
    return new StateMachine<TowerContext, TowerEvent>(
      "idle",
      {
        idle: {
          on: {
            FIND_HOSTILE: { target: "finding_hostile" },
            FIND_DAMAGED: { target: "finding_damaged" }
          }
        },
        finding_hostile: {
          on: {
            ATTACK: { target: "attacking" },
            FIND_DAMAGED: { target: "finding_damaged" },
            IDLE: { target: "idle" }
          }
        },
        attacking: {
          on: {
            FIND_HOSTILE: { target: "finding_hostile" },
            IDLE: { target: "idle" }
          }
        },
        finding_damaged: {
          on: {
            REPAIR: { target: "repairing" },
            FIND_HOSTILE: { target: "finding_hostile" },
            IDLE: { target: "idle" }
          }
        },
        repairing: {
          on: {
            FIND_HOSTILE: { target: "finding_hostile" },
            FIND_DAMAGED: { target: "finding_damaged" },
            IDLE: { target: "idle" }
          }
        }
      },
      { tower }
    );
  }

  private checkForThreats(machine: StateMachine<TowerContext, TowerEvent>): void {
    const context = machine.getContext();
    const { tower } = context;

    // Priority 1: Check for hostiles
    const hostiles = tower.room.find(FIND_HOSTILE_CREEPS);
    if (hostiles.length > 0) {
      machine.send({ type: "FIND_HOSTILE" });
      return;
    }

    // Priority 2: Check for damaged structures
    const damaged = tower.room.find(FIND_STRUCTURES, {
      filter: (s: Structure) => s.hits < s.hitsMax && s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART
    });
    if (damaged.length > 0) {
      machine.send({ type: "FIND_DAMAGED" });
    }
  }

  private findHostile(machine: StateMachine<TowerContext, TowerEvent>): void {
    const context = machine.getContext();
    const { tower } = context;

    const hostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    if (hostile) {
      context.targetId = hostile.id;
      machine.send({ type: "ATTACK" });
    } else {
      machine.send({ type: "IDLE" });
    }
  }

  private attack(machine: StateMachine<TowerContext, TowerEvent>): void {
    const context = machine.getContext();
    const { tower, targetId } = context;

    if (!targetId) {
      machine.send({ type: "FIND_HOSTILE" });
      return;
    }

    const target = Game.getObjectById(targetId as Id<Creep>);
    if (!target) {
      context.targetId = undefined;
      machine.send({ type: "FIND_HOSTILE" });
      return;
    }

    tower.attack(target);

    // Check if there are still hostiles
    if (tower.room.find(FIND_HOSTILE_CREEPS).length === 0) {
      context.targetId = undefined;
      machine.send({ type: "IDLE" });
    }
  }

  private findDamaged(machine: StateMachine<TowerContext, TowerEvent>): void {
    const context = machine.getContext();
    const { tower } = context;

    // Check for hostiles first (higher priority)
    const hostiles = tower.room.find(FIND_HOSTILE_CREEPS);
    if (hostiles.length > 0) {
      machine.send({ type: "FIND_HOSTILE" });
      return;
    }

    const damaged = tower.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: (s: Structure) => s.hits < s.hitsMax && s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART
    });

    if (damaged) {
      context.targetId = damaged.id;
      machine.send({ type: "REPAIR" });
    } else {
      machine.send({ type: "IDLE" });
    }
  }

  private repair(machine: StateMachine<TowerContext, TowerEvent>): void {
    const context = machine.getContext();
    const { tower, targetId } = context;

    // Check for hostiles first (higher priority)
    const hostiles = tower.room.find(FIND_HOSTILE_CREEPS);
    if (hostiles.length > 0) {
      context.targetId = undefined;
      machine.send({ type: "FIND_HOSTILE" });
      return;
    }

    if (!targetId) {
      machine.send({ type: "FIND_DAMAGED" });
      return;
    }

    const target = Game.getObjectById(targetId as Id<Structure>);
    if (!target || target.hits >= target.hitsMax) {
      context.targetId = undefined;
      machine.send({ type: "FIND_DAMAGED" });
      return;
    }

    tower.repair(target);

    // If structure is fully repaired, find next target
    if (target.hits >= target.hitsMax) {
      context.targetId = undefined;
      machine.send({ type: "FIND_DAMAGED" });
    }
  }
}
