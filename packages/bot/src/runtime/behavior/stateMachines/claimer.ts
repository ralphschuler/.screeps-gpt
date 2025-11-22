/**
 * Claimer Creep State Machine
 *
 * Manages claimer behavior using finite state machine from screeps-xstate.
 * Claimers travel to target rooms and claim controllers.
 */

import type { StateConfig } from "@ralphschuler/screeps-xstate";

export interface ClaimerContext {
  creep: Creep;
  targetRoom: string;
  homeRoom: string;
}

export type ClaimerEvent =
  | { type: "ARRIVED_AT_TARGET" }
  | { type: "CLAIM_COMPLETE" };

export const claimerStates: Record<string, StateConfig<ClaimerContext, ClaimerEvent>> = {
  travel: {
    on: {
      ARRIVED_AT_TARGET: {
        target: "claim",
        guard: ctx => ctx.creep.room.name === ctx.targetRoom
      }
    }
  },

  claim: {
    on: {
      CLAIM_COMPLETE: {
        target: "idle"
      }
    }
  },

  idle: {
    // Claimer has completed its task. No transitions from idle by default.
  }
};

export const CLAIMER_INITIAL_STATE = "travel";
