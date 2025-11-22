/**
 * Stationary Harvester Creep State Machine
 *
 * Manages stationary harvester behavior using finite state machine from screeps-xstate.
 * Stationary harvesters stay near a source and harvest continuously, depositing to containers.
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
  | { type: "START_HARVEST" };

export const stationaryHarvesterStates: Record<string, StateConfig<StationaryHarvesterContext, StationaryHarvesterEvent>> = {
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
      }
    }
  }
};

export const STATIONARY_HARVESTER_INITIAL_STATE = "harvesting";
