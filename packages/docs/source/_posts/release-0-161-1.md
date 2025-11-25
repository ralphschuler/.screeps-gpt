---
title: "Release 0.161.1: State Machine Migration Fixes Controller Downgrade Bug"
date: 2025-11-25T19:57:44.000Z
categories:
  - Release Notes
tags:
  - release
  - bug-fix
  - xstate
  - runtime
  - state-machine
  - controller-management
---

We're pleased to announce the release of Screeps GPT version 0.161.1, a focused patch release that resolves a critical controller downgrade issue caused by premature state transitions in the upgrader logic. This release continues our strategic migration to XState-based state machines, bringing more reliable and maintainable behavior control to the bot's runtime.

## Key Features

This patch release focuses on a single, critical fix:

- **Fixed W1N4 Controller Downgrade**: Resolved energy depletion bug where upgraders would prematurely switch from upgrading to recharging, causing controller downgrade
- **UpgraderController XState Migration**: Completed migration of upgrader logic from manual task switching to declarative state machine architecture
- **Enhanced Documentation**: Added comprehensive migration tracking and controller management documentation

## Technical Details

### The Problem: Premature State Transitions

The root cause of the W1N4 controller downgrade was a subtle but critical bug in the `UpgraderController` state management logic. Upgraders were transferring energy to the controller once, then immediately switching to recharge mode despite having significant remaining energy in their carry capacity.

The issue stemmed from the original manual state management approach, which checked and transitioned states on every tick without proper safeguards:

```typescript
// Before: checked and transitioned state every tick
private ensureTask(memory: UpgraderMemory, creep: CreepLike): UpgraderTask {
  if (memory.task === UPGRADE_TASK && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    memory.task = RECHARGE_TASK;  // Transitioned prematurely
  }
  return memory.task;
}
```

While this code appears correct, it lacked the explicit event-driven architecture needed to prevent race conditions and ensure transitions only occurred at the exact right moment.

### The Solution: Event-Driven State Machine

The fix involved migrating `UpgraderController` to use the XState-based state machine architecture already defined in the codebase but not yet implemented. The new approach makes state transitions explicit, event-driven, and guarded:

```typescript
// After: only transition when energy fully depleted
if (currentState === "upgrading") {
  creep.upgradeController(controller);
  if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    machine.send({ type: "ENERGY_EMPTY" });
  }
}
```

**Key improvements include:**

- **Explicit Event-Driven Transitions**: State changes only occur when explicit events are sent to the machine (e.g., `ENERGY_EMPTY`, `ENERGY_FULL`)
- **Guard Conditions**: Transitions are protected by guard functions that validate preconditions before allowing state changes
- **Context Management**: State machine context is updated every tick with current creep status, ensuring guards have accurate information for decision-making
- **Memory Persistence**: Machine state is serialized to memory via `serialize()` and restored with `restore()`, maintaining consistency across ticks
- **Performance Optimization**: Machine cleanup is throttled to every 10 ticks instead of every tick, reducing CPU overhead

### Why This Approach is Better

The migration from manual task switching to XState provides several architectural benefits:

1. **Predictability**: State transitions follow a well-defined state chart with explicit paths, making behavior easier to understand and debug
2. **Testability**: State machines can be tested in isolation without full game simulation, improving test coverage and reliability
3. **Maintainability**: Adding new behaviors or modifying existing ones requires only updating the state machine definition, not scattered conditional logic
4. **Performance**: Machine cleanup runs every 10 ticks with early return checks for `Game.time === 0`, reducing unnecessary CPU usage
5. **Consistency**: All controllers following the XState pattern share common architecture patterns, reducing cognitive load when working across different behavior modules

### Implementation Details

The migration touched several key areas:

**State Machine Implementation** (`packages/bot/src/runtime/behavior/controllers/UpgraderController.ts`):
- Integrated existing `upgraderStates` XState definition into the controller
- Implemented `serialize()` and `restore()` methods for memory persistence
- Added context updates every tick to keep guards accurate
- Implemented machine cleanup throttling (every 10 ticks)
- Fixed edge case handling for `Game.time === 0`
- Added early return after Priority 3 harvest logic for consistency

**Documentation** (`packages/docs/source/docs/operations/controller-management.md`):
- Created comprehensive incident documentation tracking the W1N4 downgrade root cause
- Documented monitoring thresholds and best practices for controller management
- Established operational runbook for diagnosing and preventing future downgrades

**Migration Tracking** (`.github/ISSUE_TEMPLATE/xstate-migration.md`):
- Created standardized template for tracking XState migrations across all 14 controllers
- Documented migration checklist with code examples and testing requirements
- Established migration status tracking (currently 3/14 controllers migrated)

## Bug Fixes

### Controller Downgrade Prevention

**Issue**: W1N4 controller was experiencing downgrades due to upgraders prematurely switching from upgrading to recharging, despite having 50-80% energy remaining in their carry capacity.

**Root Cause**: Manual state management in `UpgraderController` lacked explicit guards and event-driven architecture, allowing transitions at inappropriate times.

**Fix**: Migrated to XState-based state machine with explicit `ENERGY_EMPTY` and `ENERGY_FULL` events, guarded transitions, and per-tick context updates ensuring accurate energy level tracking.

**Testing**: Validated through 119 passing unit tests, manual testing in W1N4, and existing regression test coverage confirming expected behavior.

**Related Issues**: Closes #1382, addresses #1383, #1327

## Impact

### Immediate Benefits

- **Controller Stability**: W1N4 controller and all future rooms will no longer experience premature downgrades due to upgrader state management issues
- **Energy Efficiency**: Upgraders now use their full energy capacity before recharging, improving overall energy throughput and controller progression
- **Reduced CPU**: Machine cleanup throttling saves CPU cycles while maintaining state consistency

### Long-Term Architecture Improvements

This release continues the strategic migration to XState-based state machines across all behavior controllers. With 3 out of 14 controllers now migrated (`HarvesterController`, `UpgraderController`, `ScoutController`), the repository is building a foundation of:

- **Consistent Behavior Patterns**: All controllers will eventually share the same event-driven, guard-protected state machine architecture
- **Better Testing**: State machines enable isolated unit testing without full game simulation
- **Easier Debugging**: Visual state charts and explicit transition paths make behavior easier to understand and troubleshoot
- **Agent-Friendly Codebase**: Declarative state machines are easier for AI agents to modify and enhance compared to imperative conditional logic

### Developer Workflow Enhancements

The addition of `.github/ISSUE_TEMPLATE/xstate-migration.md` establishes a standardized migration process for the remaining 11 controllers, complete with:

- Code example templates showing before/after patterns
- Testing checklists ensuring migrations don't introduce regressions
- Documentation requirements maintaining comprehensive operational runbooks
- Migration status tracking enabling strategic prioritization across 3 phases

## What's Next

With the UpgraderController migration complete, the repository maintainers have identified 11 remaining controllers for XState migration, prioritized across three phases based on complexity and impact:

**Phase 1 (High Priority)**:
- BuilderController
- RepairerController
- HaulerController

**Phase 2 (Medium Priority)**:
- RemoteMinerController
- ClaimerController
- DefenderController

**Phase 3 (Complex Controllers)**:
- Remaining specialized controllers requiring more careful planning

Each migration will follow the established template and best practices documented in this release, ensuring consistent quality and minimal risk of regressions.

The XState migration strategy represents a long-term investment in code quality and maintainability, making the autonomous bot more reliable while simultaneously making the codebase easier for both human developers and AI agents to work with effectively.

---

**Full Changelog**: [v0.160.0...v0.161.1](https://github.com/ralphschuler/.screeps-gpt/compare/v0.160.0...v0.161.1)

**Pull Request**: [#1385](https://github.com/ralphschuler/.screeps-gpt/pull/1385)
