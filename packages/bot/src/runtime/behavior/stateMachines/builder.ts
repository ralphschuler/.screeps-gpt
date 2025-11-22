/**
 * Builder Creep State Machine
 *
 * Manages builder behavior using finite state machine from screeps-xstate.
 * Builders gather energy, construct buildings, and repair/maintain structures.
 */

import type { StateConfig } from "@ralphschuler/screeps-xstate";

export interface BuilderContext {
  creep: Creep;
  targetId?: Id<ConstructionSite | Structure>;
}

export type BuilderEvent =
  | { type: "START_GATHER" }
  | { type: "ENERGY_FULL" }
  | { type: "START_BUILD"; targetId: Id<ConstructionSite> }
  | { type: "NO_CONSTRUCTION" }
  | { type: "START_MAINTAIN"; targetId: Id<Structure> }
  | { type: "ENERGY_EMPTY" };

export const builderStates: Record<string, StateConfig<BuilderContext, BuilderEvent>> = {
  gather: {
    on: {
      ENERGY_FULL: {
        target: "build",
        guard: ctx => ctx.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
      }
    }
  },

  build: {
    on: {
      START_BUILD: {
        target: "build",
        actions: [
          (ctx, event) => {
            ctx.targetId = event.targetId;
          }
        ]
      },
      NO_CONSTRUCTION: {
        target: "maintain",
        actions: [
          ctx => {
            ctx.targetId = undefined;
          }
        ]
      },
      ENERGY_EMPTY: {
        target: "gather",
        guard: ctx => ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0,
        actions: [
          ctx => {
            ctx.targetId = undefined;
          }
        ]
      }
    }
  },

  maintain: {
    on: {
      START_MAINTAIN: {
        target: "maintain",
        actions: [
          (ctx, event) => {
            ctx.targetId = event.targetId;
          }
        ]
      },
      ENERGY_EMPTY: {
        target: "gather",
        guard: ctx => ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0,
        actions: [
          ctx => {
            ctx.targetId = undefined;
          }
        ]
      }
    }
  }
};

export const BUILDER_INITIAL_STATE = "gather";
