# State Machine Migration Guide

**Status: MIGRATION TO ROLECONTROLLERMANAGER COMPLETE ✅**

The migration from BehaviorController to RoleControllerManager is complete. The system now uses modular role controllers with `USE_MODULAR_CONTROLLERS = true`.

This document outlines the optional pattern for enhancing role controllers with state machines from `@ralphschuler/screeps-xstate`. State machine migration is **optional** - controllers work without it.

## Migration Pattern

Each controller should follow this pattern (see HarvesterController for complete example):

### 1. Update Imports

```typescript
import { StateMachine, serialize, restore } from "@ralphschuler/screeps-xstate";
import {
  roleStates, // e.g., upgraderStates
  ROLE_INITIAL_STATE, // e.g., UPGRADER_INITIAL_STATE
  type RoleContext, // e.g., UpgraderContext
  type RoleEvent // e.g., UpgraderEvent
} from "../stateMachines/roleName";
```

### 2. Update Memory Interface

```typescript
interface RoleMemory extends CreepMemory {
  role: "roleName";
  task: string; // Changed from specific type to string
  version: number;
  stateMachine?: unknown; // Add this
}
```

### 3. Add State Machine Map to Controller

```typescript
export class RoleController extends BaseRoleController<RoleMemory> {
  private machines: Map<string, StateMachine<RoleContext, RoleEvent>> = new Map();
  // ...
}
```

### 4. Update execute() Method Pattern

```typescript
public execute(creep: CreepLike): string {
  const memory = creep.memory as RoleMemory;
  const comm = serviceRegistry.getCommunicationManager();

  // Get or create state machine
  let machine = this.machines.get(creep.name);
  if (!machine) {
    if (memory.stateMachine) {
      machine = restore<RoleContext, RoleEvent>(memory.stateMachine, roleStates);
      machine.getContext().creep = creep as Creep;
    } else {
      machine = new StateMachine<RoleContext, RoleEvent>(
        ROLE_INITIAL_STATE,
        roleStates,
        { creep: creep as Creep }
      );
    }
    this.machines.set(creep.name, machine);
  }

  const ctx = machine.getContext();
  const currentState = machine.getState();

  // Execute behavior based on state
  if (currentState === "state1") {
    // Implement state1 behavior
    // Call machine.send() to trigger transitions
  } else if (currentState === "state2") {
    // Implement state2 behavior
  }
  // ... more states

  // Save state to memory
  memory.stateMachine = serialize(machine);
  memory.task = currentState;

  return currentState;
}
```

## Controllers with State Machine Support (Optional Enhancement)

- [x] HarvesterController ✅ **DONE**
- [x] ScoutController ✅ **DONE**
- [ ] UpgraderController (states: recharge, upgrading) - Works without state machine
- [ ] BuilderController (states: gather, building, maintaining) - Works without state machine
- [ ] HaulerController (states: pickup, delivering) - Works without state machine
- [ ] RepairerController (states: gather, repairing) - Works without state machine
- [ ] StationaryHarvesterController (states: harvesting) - Works without state machine
- [ ] RemoteMinerController (states: travel, mining, returning) - Works without state machine
- [ ] RemoteHaulerController (states: travel, pickup, returning) - Works without state machine
- [ ] AttackerController (states: attacking) - Works without state machine
- [ ] HealerController (states: healing) - Works without state machine
- [ ] DismantlerController (states: dismantling) - Works without state machine
- [ ] ClaimerController (states: claiming) - Works without state machine

**Note**: State machine migration is optional. All controllers work with RoleControllerManager without state machines.

## State Machine Files

All state machine definitions are in `packages/bot/src/runtime/behavior/stateMachines/`:

- `harvester.ts` - HarvesterContext, HarvesterEvent, harvesterStates
- `upgrader.ts` - UpgraderContext, UpgraderEvent, upgraderStates
- `builder.ts` - BuilderContext, BuilderEvent, builderStates
- `hauler.ts` - HaulerContext, HaulerEvent, haulerStates
- `repairer.ts` - RepairerContext, RepairerEvent, repairerStates
- `stationaryHarvester.ts` - StationaryHarvesterContext, StationaryHarvesterEvent, stationaryHarvesterStates
- `remoteMiner.ts` - RemoteMinerContext, RemoteMinerEvent, remoteMinerStates
- `remoteHauler.ts` - RemoteHaulerContext, RemoteHaulerEvent, remoteHaulerStates
- `attacker.ts` - AttackerContext, AttackerEvent, attackerStates
- `healer.ts` - HealerContext, HealerEvent, healerStates
- `dismantler.ts` - DismantlerContext, DismantlerEvent, dismantlerStates
- `claimer.ts` - ClaimerContext, ClaimerEvent, claimerStates
- `scout.ts` - ScoutContext, ScoutEvent, scoutStates

## Benefits of State Machines

1. **Declarative**: State definitions are separate from execution logic
2. **Predictable**: State transitions are explicit and guarded
3. **Debuggable**: Current state is always known and serialized
4. **Testable**: States can be tested independently
5. **Maintainable**: Changes to behavior only affect specific states
6. **Composable**: State machines can be combined and extended

## Notes

- State machines automatically persist to creep memory via `serialize()`
- Each tick, machines are restored from memory via `restore()`
- Creep reference must be updated after restoration (it's a new Game object each tick)
- State transitions use `machine.send(event)` with typed events
- Guards prevent invalid transitions automatically
