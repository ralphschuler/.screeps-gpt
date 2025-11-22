/**
 * Dismantler Creep State Machine
 *
 * Manages dismantler behavior using finite state machine from screeps-xstate.
 * Dismantlers destroy hostile structures.
 */

import type { StateConfig } from "@ralphschuler/screeps-xstate";

export interface DismantlerContext {
  creep: Creep;
  targetRoom?: string;
  squadId?: string;
  targetId?: Id<Structure>;
}

export type DismantlerEvent =
  | { type: "ARRIVED_AT_TARGET" }
  | { type: "DISMANTLE"; targetId: Id<Structure> }
  | { type: "TARGET_DESTROYED" };

export const dismantlerStates: Record<string, StateConfig<DismantlerContext, DismantlerEvent>> = {
  travel: {
    on: {
      ARRIVED_AT_TARGET: {
        target: "dismantle",
        guard: ctx => !ctx.targetRoom || ctx.creep.room.name === ctx.targetRoom
      }
    }
  },

  dismantle: {
    on: {
      DISMANTLE: {
        target: "dismantle",
        actions: [
          (ctx, event) => {
            ctx.targetId = event.targetId;
          }
        ]
      },
      TARGET_DESTROYED: {
        target: "dismantle",
        actions: [
          ctx => {
            ctx.targetId = undefined;
          }
        ]
      }
    }
  }
};

export const DISMANTLER_INITIAL_STATE = "travel";
