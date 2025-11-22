/**
 * Upgrader Creep State Machine
 *
 * Manages upgrader behavior using finite state machine from screeps-xstate.
 * Upgraders collect energy and upgrade the room controller.
 */

import type { StateConfig } from "@ralphschuler/screeps-xstate";

export interface UpgraderContext {
  creep: Creep;
  sourceId?: Id<Source>;
}

export type UpgraderEvent =
  | { type: "START_RECHARGE"; sourceId?: Id<Source> }
  | { type: "ENERGY_FULL" }
  | { type: "START_UPGRADE" }
  | { type: "ENERGY_EMPTY" };

export const upgraderStates: Record<string, StateConfig<UpgraderContext, UpgraderEvent>> = {
  recharge: {
    on: {
      START_RECHARGE: {
        target: "recharge",
        actions: [
          (ctx, event) => {
            if (event.sourceId) {
              ctx.sourceId = event.sourceId;
            }
          }
        ]
      },
      ENERGY_FULL: {
        target: "upgrading",
        guard: ctx => ctx.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
      }
    }
  },

  upgrading: {
    on: {
      ENERGY_EMPTY: {
        target: "recharge",
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

export const UPGRADER_INITIAL_STATE = "recharge";
