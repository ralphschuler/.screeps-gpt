---
name: Migrate All Role Controllers to xstate
about: Track the migration of all role controllers to use xstate state machines for consistency
title: 'refactor(runtime): Migrate remaining role controllers to xstate state machines'
labels: 'type/enhancement, runtime, refactor, state-machine'
assignees: ''
---

## Summary

Migrate all remaining role controllers to use xstate state machines for consistent, declarative behavior management. This follows the pattern established by HarvesterController, UpgraderController, and ScoutController.

## Motivation

**Context:**
- W1N4 controller downgrade incident revealed that UpgraderController was not using xstate properly
- After migrating UpgraderController to xstate, the energy depletion issue was fixed
- Currently only 3/14 controllers use xstate state machines
- Inconsistent patterns across controllers make maintenance and debugging harder

**Benefits of xstate migration:**
1. **Declarative state management**: Clear, testable state definitions
2. **Event-driven transitions**: Predictable behavior changes based on events
3. **Guard conditions**: Safe state transitions with validation
4. **Persistence**: Automatic state serialization to creep memory
5. **Consistency**: Same pattern across all role controllers
6. **Debugging**: Easier to trace state transitions and identify issues

## Current State

### ✅ Controllers Using xstate (3/14)

- [x] HarvesterController (`packages/bot/src/runtime/behavior/controllers/HarvesterController.ts`)
- [x] UpgraderController (`packages/bot/src/runtime/behavior/controllers/UpgraderController.ts`)
- [x] ScoutController (`packages/bot/src/runtime/behavior/controllers/ScoutController.ts`)

### ⏳ Controllers To Migrate (11/14)

- [ ] BuilderController (`packages/bot/src/runtime/behavior/controllers/BuilderController.ts`)
- [ ] HaulerController (`packages/bot/src/runtime/behavior/controllers/HaulerController.ts`)
- [ ] RepairerController (`packages/bot/src/runtime/behavior/controllers/RepairerController.ts`)
- [ ] StationaryHarvesterController (`packages/bot/src/runtime/behavior/controllers/StationaryHarvesterController.ts`)
- [ ] RemoteMinerController (`packages/bot/src/runtime/behavior/controllers/RemoteMinerController.ts`)
- [ ] RemoteHaulerController (`packages/bot/src/runtime/behavior/controllers/RemoteHaulerController.ts`)
- [ ] RemoteBuilderController (`packages/bot/src/runtime/behavior/controllers/RemoteBuilderController.ts`)
- [ ] AttackerController (`packages/bot/src/runtime/behavior/controllers/AttackerController.ts`)
- [ ] HealerController (`packages/bot/src/runtime/behavior/controllers/HealerController.ts`)
- [ ] DismantlerController (`packages/bot/src/runtime/behavior/controllers/DismantlerController.ts`)
- [ ] ClaimerController (`packages/bot/src/runtime/behavior/controllers/ClaimerController.ts`)

## State Machine Definitions

### ✅ State Machines Already Defined (12/14)

All state machine definitions exist in `packages/bot/src/runtime/behavior/stateMachines/`:

- [x] `harvester.ts` - Used by HarvesterController
- [x] `upgrader.ts` - Used by UpgraderController
- [x] `builder.ts` - **Ready to use** by BuilderController
- [x] `hauler.ts` - **Ready to use** by HaulerController
- [x] `repairer.ts` - **Ready to use** by RepairerController
- [x] `stationaryHarvester.ts` - **Ready to use** by StationaryHarvesterController
- [x] `remoteMiner.ts` - **Ready to use** by RemoteMinerController
- [x] `remoteHauler.ts` - **Ready to use** by RemoteHaulerController
- [x] `attacker.ts` - **Ready to use** by AttackerController
- [x] `healer.ts` - **Ready to use** by HealerController
- [x] `dismantler.ts` - **Ready to use** by DismantlerController
- [x] `claimer.ts` - **Ready to use** by ClaimerController

### ⏳ State Machines To Create (1/14)

- [ ] `remoteBuilder.ts` - New state machine needed for RemoteBuilderController

## Migration Pattern

Based on the successful UpgraderController migration, each controller should follow this pattern:

### 1. Import xstate Dependencies

```typescript
import { StateMachine, serialize, restore } from "@ralphschuler/screeps-xstate";
import {
  roleStates,
  ROLE_INITIAL_STATE,
  type RoleContext,
  type RoleEvent
} from "../stateMachines/role";
```

### 2. Add State Machine Property

```typescript
export class RoleController extends BaseRoleController<RoleMemory> {
  private machines: Map<string, StateMachine<RoleContext, RoleEvent>> = new Map();
  // ...
}
```

### 3. Update Memory Interface

```typescript
interface RoleMemory extends CreepMemory {
  role: "roleName";
  task: string;
  version: number;
  stateMachine?: unknown; // Add this
}
```

### 4. Initialize or Restore Machine

```typescript
public execute(creep: CreepLike): string {
  const memory = creep.memory as RoleMemory;
  
  // Clean up dead creeps
  this.cleanupDeadCreepMachines();
  
  // Get or create state machine
  let machine = this.machines.get(creep.name);
  if (!machine) {
    if (memory.stateMachine) {
      machine = restore<RoleContext, RoleEvent>(memory.stateMachine, roleStates);
    } else {
      machine = new StateMachine<RoleContext, RoleEvent>(
        ROLE_INITIAL_STATE,
        roleStates,
        { creep: creep as Creep }
      );
    }
    this.machines.set(creep.name, machine);
  }
  
  // Update creep reference
  machine.getContext().creep = creep as Creep;
  
  const currentState = machine.getState();
  // ...
}
```

### 5. Execute Based on State

```typescript
if (currentState === "recharge") {
  // Recharge logic
  if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
    machine.send({ type: "ENERGY_FULL" });
  }
} else if (currentState === "working") {
  // Working logic
  if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    machine.send({ type: "ENERGY_EMPTY" });
  }
}
```

### 6. Persist State

```typescript
// Save state to memory
memory.stateMachine = serialize(machine);
memory.task = machine.getState();
return memory.task;
```

### 7. Add Cleanup Method

```typescript
private cleanupDeadCreepMachines(): void {
  if (typeof Game === "undefined" || !Game.creeps) {
    return;
  }
  for (const creepName of this.machines.keys()) {
    if (!Game.creeps[creepName]) {
      this.machines.delete(creepName);
    }
  }
}
```

## Implementation Plan

### Phase 1: Core Roles (Priority: High)

These are the most critical roles that should be migrated first:

1. **BuilderController** - Essential for construction
2. **HaulerController** - Critical for energy logistics
3. **RepairerController** - Important for maintenance

### Phase 2: Stationary & Remote Roles (Priority: Medium)

4. **StationaryHarvesterController** - Specialized harvesting
5. **RemoteMinerController** - Multi-room operations
6. **RemoteHaulerController** - Multi-room logistics
7. **RemoteBuilderController** - Multi-room construction (needs state machine creation)

### Phase 3: Combat Roles (Priority: Low)

8. **AttackerController** - Combat operations
9. **HealerController** - Combat support
10. **DismantlerController** - Combat/utility
11. **ClaimerController** - Room expansion

## Acceptance Criteria

For each controller migration:

- [ ] Controller imports and uses xstate state machine
- [ ] Memory interface includes `stateMachine?: unknown`
- [ ] State machine is created/restored in execute method
- [ ] Creep reference is updated every tick
- [ ] State transitions use events (ENERGY_FULL, ENERGY_EMPTY, etc.)
- [ ] State is persisted to memory after each tick
- [ ] Cleanup method implemented to prevent memory leaks
- [ ] Build succeeds without errors
- [ ] Linting passes
- [ ] Unit tests pass
- [ ] Controller behavior matches original functionality

## Testing Requirements

For each migrated controller:

1. **Unit Tests**: Verify state transitions work correctly
2. **Integration Tests**: Test full creep lifecycle with state persistence
3. **Regression Tests**: Ensure behavior matches pre-migration functionality
4. **Performance Tests**: Verify no significant CPU overhead from state machine usage

## Documentation

- [ ] Update `packages/docs/source/docs/operations/controller-management.md` after each migration
- [ ] Document any behavioral changes or improvements
- [ ] Add examples of state machine usage to developer documentation
- [ ] Update CHANGELOG.md for each migration

## Related Issues

- W1N4 controller downgrade alert (fixed by UpgraderController migration)
- #1383 - Monitoring: Add proactive controller downgrade alerts
- #1327 - RCL 4→2 downgrade with workforce collapse

## References

- UpgraderController migration: commit 963cc44
- State machine definitions: `packages/bot/src/runtime/behavior/stateMachines/`
- xstate library: `@ralphschuler/screeps-xstate`
- Example implementation: `HarvesterController.ts`, `UpgraderController.ts`

## Notes

- Each controller should be migrated in a separate PR for easier review
- State machines are already defined for most controllers, making migration straightforward
- The migration should maintain backward compatibility with existing creep behavior
- Consider adding state visualization in the game UI for debugging (future enhancement)
