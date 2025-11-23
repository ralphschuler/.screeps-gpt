/**
 * Stationary Harvester Role Controller
 *
 * Stationary harvesters are responsible for:
 * - Staying at an assigned source
 * - Continuously harvesting energy
 * - Dropping energy or filling adjacent containers
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";

const STATIONARY_HARVEST_TASK = "stationaryHarvest" as const;

type StationaryHarvesterTask = typeof STATIONARY_HARVEST_TASK;

interface StationaryHarvesterMemory extends CreepMemory {
  role: "stationaryHarvester";
  task: StationaryHarvesterTask;
  version: number;
  sourceId?: Id<Source>;
  containerId?: Id<StructureContainer>;
}

export class StationaryHarvesterController extends BaseRoleController<StationaryHarvesterMemory> {
  public constructor() {
    const config: RoleConfig<StationaryHarvesterMemory> = {
      minimum: 0,
      body: [WORK, WORK, WORK, WORK, WORK, MOVE],
      version: 1,
      createMemory: () => ({
        role: "stationaryHarvester",
        task: STATIONARY_HARVEST_TASK,
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "stationaryHarvester";
  }

  public execute(creep: CreepLike): string {
    const memory = creep.memory as StationaryHarvesterMemory;
    const comm = serviceRegistry.getCommunicationManager();

    comm?.say(creep, "⛏️");

    // Find or remember assigned source
    let source: Source | null = null;
    if (memory.sourceId) {
      source = Game.getObjectById(memory.sourceId);
    }

    if (!source) {
      const sources = creep.room.find(FIND_SOURCES) as Source[];
      source = creep.pos.findClosestByPath(sources) ?? sources[0] ?? null;
      if (source) {
        memory.sourceId = source.id;
      }
    }

    if (!source) {
      return STATIONARY_HARVEST_TASK;
    }

    // Harvest from source
    const harvestResult = creep.harvest(source);
    if (harvestResult === ERR_NOT_IN_RANGE) {
      creep.moveTo(source, { range: 1, reusePath: 50 });
      return STATIONARY_HARVEST_TASK;
    }

    // If adjacent to source and have energy, try to fill adjacent container
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      let container: StructureContainer | null = null;

      // Find or remember adjacent container
      if (memory.containerId) {
        container = Game.getObjectById(memory.containerId);
      }

      if (!container) {
        const nearbyContainers = creep.pos.findInRange(FIND_STRUCTURES, 1, {
          filter: s => s.structureType === STRUCTURE_CONTAINER
        });

        if (nearbyContainers.length > 0) {
          container = nearbyContainers[0];
          memory.containerId = container.id;
        }
      }

      if (container && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        creep.transfer(container, RESOURCE_ENERGY);
      }
    }

    return STATIONARY_HARVEST_TASK;
  }
}
