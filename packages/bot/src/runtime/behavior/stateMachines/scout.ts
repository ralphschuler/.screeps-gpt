/**
 * Scout Creep State Machine
 *
 * Manages scout behavior using finite state machine from screeps-xstate.
 * Scouts move to target rooms for reconnaissance and intel gathering.
 */

import type { StateConfig } from "@ralphschuler/screeps-xstate";

export interface ScoutContext {
  creep: Creep;
  targetRoom?: string;
}

export type ScoutEvent =
  | { type: "START_SCOUT"; targetRoom: string }
  | { type: "ARRIVED" }
  | { type: "NO_TARGET" };

export const scoutStates: Record<string, StateConfig<ScoutContext, ScoutEvent>> = {
  idle: {
    onEntry: [
      ctx => {
        ctx.targetRoom = undefined;
      }
    ],
    on: {
      START_SCOUT: {
        target: "scouting",
        actions: [
          (ctx, event) => {
            if (event.type === "START_SCOUT") {
              ctx.targetRoom = event.targetRoom;
            }
          }
        ]
      }
    }
  },

  scouting: {
    on: {
      ARRIVED: {
        target: "idle",
        actions: [
          ctx => {
            ctx.targetRoom = undefined;
          }
        ]
      },
      NO_TARGET: {
        target: "idle",
        actions: [
          ctx => {
            ctx.targetRoom = undefined;
          }
        ]
      }
    }
  }
};

export const SCOUT_INITIAL_STATE = "idle";
