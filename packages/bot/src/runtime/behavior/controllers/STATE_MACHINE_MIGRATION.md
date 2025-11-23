# State Machine Migration Guide

This document outlines the pattern for migrating role controllers to use state machines from `@ralphschuler/screeps-xstate`.

## Migration Pattern

Each controller should follow this pattern (see HarvesterController for complete example):

### 1. Update Imports
```typescript
import { StateMachine, serialize, restore } from "@ralphschuler/screeps-xstate";
import {
  roleStates,          // e.g., upgraderStates
  ROLE_INITIAL_STATE,  // e.g., UPGRADER_INITIAL_STATE
  type RoleContext,    // e.g., UpgraderContext
  type RoleEvent       // e.g., UpgraderEvent
} from "../stateMachines/roleName";
```

### 2. Update Memory Interface
```typescript
interface RoleMemory extends CreepMemory {
  role: "roleName";
  task: string;  // Changed from specific type to string
  version: number;
  stateMachine?: unknown;  // Add this
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

## Controllers to Migrate

- [x] HarvesterController ✅ **DONE**
- [ ] UpgraderController (states: recharge, upgrading)
- [ ] BuilderController (states: gather, building, maintaining)
- [ ] HaulerController (states: pickup, delivering)
- [ ] RepairerController (states: gather, repairing)
- [ ] StationaryHarvesterController (states: harvesting)
- [ ] RemoteMinerController (states: travel, mining, returning)
- [ ] RemoteHaulerController (states: travel, pickup, returning)
- [ ] AttackerController (states: attacking)
- [ ] HealerController (states: healing)
- [ ] DismantlerController (states: dismantling)
- [ ] ClaimerController (states: claiming)
- [ ] ScoutController (states: scouting)

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
