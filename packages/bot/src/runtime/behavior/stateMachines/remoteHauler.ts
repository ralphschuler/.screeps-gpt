/**
 * Remote Hauler Creep State Machine
 *
 * Manages remote hauler behavior using finite state machine from screeps-xstate.
 * Remote haulers travel to remote rooms, pickup energy, and return home to deliver.
 */

import type { StateConfig } from "@ralphschuler/screeps-xstate";

export interface RemoteHaulerContext {
  creep: Creep;
  homeRoom: string;
  targetRoom: string;
}

export type RemoteHaulerEvent =
  | { type: "ARRIVED_AT_TARGET" }
  | { type: "ENERGY_FULL" }
  | { type: "NO_ENERGY" }
  | { type: "ARRIVED_AT_HOME" }
  | { type: "ENERGY_EMPTY" };

// Guard: Check if arrived home and empty
const isHomeAndEmpty = (ctx: RemoteHaulerContext): boolean =>
  ctx.creep.room.name === ctx.homeRoom && ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0;

export const remoteHaulerStates: Record<string, StateConfig<RemoteHaulerContext, RemoteHaulerEvent>> = {
  travel: {
    on: {
      ARRIVED_AT_TARGET: {
        target: "pickup",
        guard: ctx => ctx.creep.room.name === ctx.targetRoom
      }
    }
  },

  pickup: {
    on: {
      ENERGY_FULL: {
        target: "return",
        guard: ctx => ctx.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
      },
      NO_ENERGY: {
        target: "return"
      }
    }
  },

  return: {
    on: {
      ARRIVED_AT_HOME: {
        target: "travel",
        guard: isHomeAndEmpty
      },
      ENERGY_EMPTY: {
        target: "travel",
        guard: isHomeAndEmpty
      }
    }
  }
};

export const REMOTE_HAULER_INITIAL_STATE = "travel";
