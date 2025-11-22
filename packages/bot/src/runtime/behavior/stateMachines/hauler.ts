/**
 * Hauler Creep State Machine
 *
 * Manages hauler behavior using finite state machine from screeps-xstate.
 * Haulers transport energy from containers/dropped resources to spawns/extensions/towers.
 */

import type { StateConfig } from "@ralphschuler/screeps-xstate";

export interface HaulerContext {
  creep: Creep;
  pickupTargetId?: Id<Resource | StructureContainer>;
  deliveryTargetId?: Id<AnyStoreStructure>;
}

export type HaulerEvent =
  | { type: "START_PICKUP"; targetId: Id<Resource | StructureContainer> }
  | { type: "ENERGY_FULL" }
  | { type: "START_DELIVER"; targetId: Id<AnyStoreStructure> }
  | { type: "ENERGY_EMPTY" };

export const haulerStates: Record<string, StateConfig<HaulerContext, HaulerEvent>> = {
  pickup: {
    on: {
      START_PICKUP: {
        target: "pickup",
        actions: [
          (ctx, event) => {
            ctx.pickupTargetId = event.targetId;
          }
        ]
      },
      ENERGY_FULL: {
        target: "deliver",
        guard: ctx => ctx.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0,
        actions: [
          ctx => {
            ctx.pickupTargetId = undefined;
          }
        ]
      }
    }
  },

  deliver: {
    on: {
      START_DELIVER: {
        target: "deliver",
        actions: [
          (ctx, event) => {
            ctx.deliveryTargetId = event.targetId;
          }
        ]
      },
      ENERGY_EMPTY: {
        target: "pickup",
        guard: ctx => ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0,
        actions: [
          ctx => {
            ctx.deliveryTargetId = undefined;
          }
        ]
      }
    }
  }
};

export const HAULER_INITIAL_STATE = "pickup";
