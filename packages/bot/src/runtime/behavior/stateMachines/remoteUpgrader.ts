/**
 * Remote Upgrader Creep State Machine
 *
 * Manages remote upgrader behavior using finite state machine from screeps-xstate.
 * Remote upgraders travel to remote rooms, harvest energy, and upgrade the controller without returning home.
 */

import type { StateConfig } from "@ralphschuler/screeps-xstate";

export interface RemoteUpgraderContext {
  creep: Creep;
  homeRoom: string;
  targetRoom: string;
  sourceId?: Id<Source>;
}

export type RemoteUpgraderEvent =
  | { type: "ARRIVED_AT_TARGET" }
  | { type: "START_GATHERING"; sourceId?: Id<Source> }
  | { type: "ENERGY_FULL" }
  | { type: "START_UPGRADE" }
  | { type: "ENERGY_EMPTY" };

export const remoteUpgraderStates: Record<string, StateConfig<RemoteUpgraderContext, RemoteUpgraderEvent>> = {
  travel: {
    on: {
      ARRIVED_AT_TARGET: {
        target: "gather",
        guard: ctx => ctx.creep.room.name === ctx.targetRoom
      }
    }
  },

  gather: {
    on: {
      START_GATHERING: {
        target: "gather",
        actions: [
          (ctx, event) => {
            if (event.type === "START_GATHERING" && event.sourceId) {
              ctx.sourceId = event.sourceId;
            }
          }
        ]
      },
      ENERGY_FULL: {
        target: "upgrade",
        guard: ctx => ctx.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
      }
    }
  },

  upgrade: {
    on: {
      ENERGY_EMPTY: {
        target: "gather",
        guard: ctx => ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0,
        actions: [
          ctx => {
            ctx.sourceId = undefined;
          }
        ]
      }
    }
  }
};

export const REMOTE_UPGRADER_INITIAL_STATE = "travel";
