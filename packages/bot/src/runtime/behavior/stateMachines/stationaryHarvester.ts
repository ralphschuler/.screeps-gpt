/**
 * Stationary Harvester Creep State Machine
 *
 * Manages stationary harvester behavior using finite state machine from screeps-xstate.
 * Stationary harvesters stay near a source and harvest continuously, depositing to containers.
 *
 * State transitions:
 * - harvesting -> depositing: When creep store is full (ENERGY_FULL)
 * - depositing -> harvesting: When creep store is empty or container is full (ENERGY_EMPTY, CONTAINER_FULL)
 *
 * Note: Stationary harvesters are expected to stay adjacent to both the source and container,
 * so they don't need to move between harvesting and depositing - both actions happen in place.
 */

import type { StateConfig } from "@ralphschuler/screeps-xstate";

export interface StationaryHarvesterContext {
  creep: Creep;
  sourceId?: Id<Source>;
  containerId?: Id<StructureContainer>;
}

export type StationaryHarvesterEvent =
  | { type: "ASSIGN_SOURCE"; sourceId: Id<Source> }
  | { type: "ASSIGN_CONTAINER"; containerId: Id<StructureContainer> }
  | { type: "ENERGY_FULL" }
  | { type: "ENERGY_EMPTY" }
  | { type: "CONTAINER_FULL" };

export const stationaryHarvesterStates: Record<
  string,
  StateConfig<StationaryHarvesterContext, StationaryHarvesterEvent>
> = {
  harvesting: {
    on: {
      ASSIGN_SOURCE: {
        target: "harvesting",
        actions: [
          (ctx, event) => {
            if (event.type === "ASSIGN_SOURCE") {
              ctx.sourceId = event.sourceId;
            }
          }
        ]
      },
      ASSIGN_CONTAINER: {
        target: "harvesting",
        actions: [
          (ctx, event) => {
            if (event.type === "ASSIGN_CONTAINER") {
              ctx.containerId = event.containerId;
            }
          }
        ]
      },
      ENERGY_FULL: {
        target: "depositing",
        guard: ctx => ctx.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
      }
    }
  },

  depositing: {
    on: {
      ASSIGN_CONTAINER: {
        target: "depositing",
        actions: [
          (ctx, event) => {
            if (event.type === "ASSIGN_CONTAINER") {
              ctx.containerId = event.containerId;
            }
          }
        ]
      },
      ENERGY_EMPTY: {
        target: "harvesting",
        guard: ctx => ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0
      },
      CONTAINER_FULL: {
        target: "harvesting"
      }
    }
  }
};

export const STATIONARY_HARVESTER_INITIAL_STATE = "harvesting";
