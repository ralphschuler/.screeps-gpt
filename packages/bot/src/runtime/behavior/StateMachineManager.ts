/**
 * State Machine Manager for Creep Behaviors
 *
 * Manages state machines for all creep roles, handling initialization,
 * persistence, and execution of state machine-driven behaviors.
 */

import { StateMachine, serialize, restore } from "@ralphschuler/screeps-xstate";
import type { StateConfig } from "@ralphschuler/screeps-xstate";
import {
  harvesterStates,
  HARVESTER_INITIAL_STATE,
  type HarvesterContext,
  type HarvesterEvent,
  upgraderStates,
  UPGRADER_INITIAL_STATE,
  type UpgraderContext,
  type UpgraderEvent,
  builderStates,
  BUILDER_INITIAL_STATE,
  type BuilderContext,
  type BuilderEvent,
  haulerStates,
  HAULER_INITIAL_STATE,
  type HaulerContext,
  type HaulerEvent,
  stationaryHarvesterStates,
  STATIONARY_HARVESTER_INITIAL_STATE,
  type StationaryHarvesterContext,
  type StationaryHarvesterEvent,
  repairerStates,
  REPAIRER_INITIAL_STATE,
  type RepairerContext,
  type RepairerEvent,
  remoteMinerStates,
  REMOTE_MINER_INITIAL_STATE,
  type RemoteMinerContext,
  type RemoteMinerEvent,
  remoteHaulerStates,
  REMOTE_HAULER_INITIAL_STATE,
  type RemoteHaulerContext,
  type RemoteHaulerEvent,
  attackerStates,
  ATTACKER_INITIAL_STATE,
  type AttackerContext,
  type AttackerEvent,
  healerStates,
  HEALER_INITIAL_STATE,
  type HealerContext,
  type HealerEvent,
  dismantlerStates,
  DISMANTLER_INITIAL_STATE,
  type DismantlerContext,
  type DismantlerEvent,
  claimerStates,
  CLAIMER_INITIAL_STATE,
  type ClaimerContext,
  type ClaimerEvent
} from "./stateMachines";

// Union type for all creep contexts
type CreepContext =
  | HarvesterContext
  | UpgraderContext
  | BuilderContext
  | HaulerContext
  | StationaryHarvesterContext
  | RepairerContext
  | RemoteMinerContext
  | RemoteHaulerContext
  | AttackerContext
  | HealerContext
  | DismantlerContext
  | ClaimerContext;

// Union type for all creep events
type CreepEvent =
  | HarvesterEvent
  | UpgraderEvent
  | BuilderEvent
  | HaulerEvent
  | StationaryHarvesterEvent
  | RepairerEvent
  | RemoteMinerEvent
  | RemoteHaulerEvent
  | AttackerEvent
  | HealerEvent
  | DismantlerEvent
  | ClaimerEvent;

// Role name type
type RoleName =
  | "harvester"
  | "upgrader"
  | "builder"
  | "remoteMiner"
  | "remoteHauler"
  | "stationaryHarvester"
  | "hauler"
  | "repairer"
  | "attacker"
  | "healer"
  | "dismantler"
  | "claimer";

// Role configuration mapping
interface RoleConfig {
  states: Record<string, StateConfig<CreepContext, CreepEvent>>;
  initialState: string;
}

const ROLE_CONFIGS: Record<RoleName, RoleConfig> = {
  harvester: {
    states: harvesterStates as Record<string, StateConfig<CreepContext, CreepEvent>>,
    initialState: HARVESTER_INITIAL_STATE
  },
  upgrader: {
    states: upgraderStates as Record<string, StateConfig<CreepContext, CreepEvent>>,
    initialState: UPGRADER_INITIAL_STATE
  },
  builder: {
    states: builderStates as Record<string, StateConfig<CreepContext, CreepEvent>>,
    initialState: BUILDER_INITIAL_STATE
  },
  hauler: {
    states: haulerStates as Record<string, StateConfig<CreepContext, CreepEvent>>,
    initialState: HAULER_INITIAL_STATE
  },
  stationaryHarvester: {
    states: stationaryHarvesterStates as Record<string, StateConfig<CreepContext, CreepEvent>>,
    initialState: STATIONARY_HARVESTER_INITIAL_STATE
  },
  repairer: {
    states: repairerStates as Record<string, StateConfig<CreepContext, CreepEvent>>,
    initialState: REPAIRER_INITIAL_STATE
  },
  remoteMiner: {
    states: remoteMinerStates as Record<string, StateConfig<CreepContext, CreepEvent>>,
    initialState: REMOTE_MINER_INITIAL_STATE
  },
  remoteHauler: {
    states: remoteHaulerStates as Record<string, StateConfig<CreepContext, CreepEvent>>,
    initialState: REMOTE_HAULER_INITIAL_STATE
  },
  attacker: {
    states: attackerStates as Record<string, StateConfig<CreepContext, CreepEvent>>,
    initialState: ATTACKER_INITIAL_STATE
  },
  healer: {
    states: healerStates as Record<string, StateConfig<CreepContext, CreepEvent>>,
    initialState: HEALER_INITIAL_STATE
  },
  dismantler: {
    states: dismantlerStates as Record<string, StateConfig<CreepContext, CreepEvent>>,
    initialState: DISMANTLER_INITIAL_STATE
  },
  claimer: {
    states: claimerStates as Record<string, StateConfig<CreepContext, CreepEvent>>,
    initialState: CLAIMER_INITIAL_STATE
  }
};

/**
 * Manages state machines for all creep roles.
 * Handles initialization, persistence, and state machine lifecycle.
 */
export class StateMachineManager {
  private machines: Map<string, StateMachine<CreepContext, CreepEvent>> = new Map();

  /**
   * Initialize or restore state machines for all creeps.
   * @param creeps - Object containing all game creeps
   */
  public initialize(creeps: { [name: string]: Creep }): void {
    for (const name in creeps) {
      const creep = creeps[name];
      const role = creep.memory.role as RoleName | undefined;

      if (!role || !ROLE_CONFIGS[role]) {
        continue;
      }

      const config = ROLE_CONFIGS[role];

      // Restore from memory or create new machine
      if (creep.memory.stateMachine) {
        const machine = restore<CreepContext, CreepEvent>(
          creep.memory.stateMachine,
          config.states
        );
        // Update creep reference (it's a new Game object each tick)
        machine.getContext().creep = creep;
        this.machines.set(name, machine);
      } else {
        // Create initial context based on role
        const context = this.createInitialContext(creep, role);
        const machine = new StateMachine<CreepContext, CreepEvent>(config.initialState, config.states, context);
        this.machines.set(name, machine);
      }
    }
  }

  /**
   * Get a state machine for a specific creep.
   * @param creepName - Name of the creep
   * @returns State machine instance or undefined if not found
   */
  public getMachine(creepName: string): StateMachine<CreepContext, CreepEvent> | undefined {
    return this.machines.get(creepName);
  }

  /**
   * Save all state machines to creep memory.
   * @param creeps - Object containing all game creeps
   */
  public persist(creeps: { [name: string]: Creep }): void {
    for (const [name, machine] of this.machines) {
      const creep = creeps[name];
      if (creep) {
        creep.memory.stateMachine = serialize(machine);
      }
    }
  }

  /**
   * Clean up state machines for dead creeps.
   * @param creeps - Object containing all game creeps
   */
  public cleanup(creeps: { [name: string]: Creep }): void {
    for (const name of this.machines.keys()) {
      if (!creeps[name]) {
        this.machines.delete(name);
      }
    }
  }

  /**
   * Create initial context for a creep based on its role.
   * @param creep - The creep instance
   * @param role - The creep's role
   * @returns Initial context object
   */
  private createInitialContext(creep: Creep, role: RoleName): CreepContext {
    // Base context common to all roles
    const baseContext = { creep };

    // Add role-specific context properties
    switch (role) {
      case "remoteMiner":
        return {
          ...baseContext,
          homeRoom: creep.memory.homeRoom ?? creep.room.name,
          targetRoom: creep.memory.targetRoom ?? creep.room.name
        } as RemoteMinerContext;

      case "remoteHauler":
        return {
          ...baseContext,
          homeRoom: creep.memory.homeRoom ?? creep.room.name,
          targetRoom: creep.memory.targetRoom ?? creep.room.name
        } as RemoteHaulerContext;

      case "claimer":
        return {
          ...baseContext,
          homeRoom: creep.memory.homeRoom ?? creep.room.name,
          targetRoom: creep.memory.targetRoom ?? ""
        } as ClaimerContext;

      case "attacker":
      case "healer":
      case "dismantler":
        return {
          ...baseContext,
          targetRoom: creep.memory.targetRoom,
          squadId: creep.memory.squadId
        } as AttackerContext | HealerContext | DismantlerContext;

      case "stationaryHarvester":
        return {
          ...baseContext,
          sourceId: creep.memory.sourceId,
          containerId: creep.memory.containerId
        } as StationaryHarvesterContext;

      default:
        return baseContext as CreepContext;
    }
  }
}

// Extend CreepMemory to include state machine
declare global {
  interface CreepMemory {
    stateMachine?: {
      state: string;
      context: unknown;
    };
    homeRoom?: string;
    targetRoom?: string;
    sourceId?: Id<Source>;
    containerId?: Id<StructureContainer>;
    squadId?: string;
  }
}
