/**
 * Attacker Creep State Machine
 *
 * Manages attacker behavior using finite state machine from screeps-xstate.
 * Attackers engage hostile creeps and structures in combat.
 */

import type { StateConfig } from "@ralphschuler/screeps-xstate";

export interface AttackerContext {
  creep: Creep;
  targetRoom?: string;
  squadId?: string;
  targetId?: Id<Creep | Structure>;
}

export type AttackerEvent =
  | { type: "ARRIVED_AT_TARGET" }
  | { type: "ENGAGE"; targetId: Id<Creep | Structure> }
  | { type: "TARGET_DESTROYED" };

export const attackerStates: Record<string, StateConfig<AttackerContext, AttackerEvent>> = {
  travel: {
    on: {
      ARRIVED_AT_TARGET: {
        target: "attack",
        guard: ctx => !ctx.targetRoom || ctx.creep.room.name === ctx.targetRoom
      }
    }
  },

  attack: {
    on: {
      ENGAGE: {
        target: "attack",
        actions: [
          (ctx, event) => {
            ctx.targetId = event.targetId;
          }
        ]
      },
      TARGET_DESTROYED: {
        target: "attack",
        actions: [
          ctx => {
            ctx.targetId = undefined;
          }
        ]
      }
    }
  }
};

export const ATTACKER_INITIAL_STATE = "travel";
