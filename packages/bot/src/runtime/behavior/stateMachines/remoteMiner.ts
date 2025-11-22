/**
 * Remote Miner Creep State Machine
 *
 * Manages remote miner behavior using finite state machine from screeps-xstate.
 * Remote miners travel to remote rooms, harvest energy, and return home to deliver.
 */

import type { StateConfig } from "@ralphschuler/screeps-xstate";

export interface RemoteMinerContext {
  creep: Creep;
  homeRoom: string;
  targetRoom: string;
  sourceId?: Id<Source>;
}

export type RemoteMinerEvent =
  | { type: "ARRIVED_AT_TARGET" }
  | { type: "START_MINING"; sourceId: Id<Source> }
  | { type: "ENERGY_FULL" }
  | { type: "ARRIVED_AT_HOME" }
  | { type: "ENERGY_EMPTY" };

export const remoteMinerStates: Record<string, StateConfig<RemoteMinerContext, RemoteMinerEvent>> = {
  travel: {
    on: {
      ARRIVED_AT_TARGET: {
        target: "mine",
        guard: ctx => ctx.creep.room.name === ctx.targetRoom
      }
    }
  },

  mine: {
    on: {
      START_MINING: {
        target: "mine",
        actions: [
          (ctx, event) => {
            if (event.type === "START_MINING") {
              ctx.sourceId = event.sourceId;
            }
          }
        ]
      },
      ENERGY_FULL: {
        target: "return",
        guard: ctx => ctx.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
      }
    }
  },

  return: {
    on: {
      ARRIVED_AT_HOME: {
        target: "travel",
        guard: ctx => ctx.creep.room.name === ctx.homeRoom && ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0,
        actions: [
          ctx => {
            ctx.sourceId = undefined;
          }
        ]
      },
      ENERGY_EMPTY: {
        target: "travel",
        guard: ctx => ctx.creep.room.name === ctx.homeRoom && ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0,
        actions: [
          ctx => {
            ctx.sourceId = undefined;
          }
        ]
      }
    }
  }
};

export const REMOTE_MINER_INITIAL_STATE = "travel";
