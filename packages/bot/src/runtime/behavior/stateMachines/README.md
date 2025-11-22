# Creep Behavior State Machines

This directory contains finite state machine definitions for all creep roles using the `@ralphschuler/screeps-xstate` package.

## Overview

State machines provide a declarative approach to managing complex creep behaviors, improving testability and maintainability compared to imperative logic. Each role has its own state machine definition that defines:

- **States**: Distinct modes of operation (e.g., "harvesting", "delivering", "idle")
- **Events**: Triggers that cause state transitions (e.g., "ENERGY_FULL", "START_HARVEST")
- **Guards**: Conditional logic that controls when transitions occur
- **Actions**: Side effects executed during transitions (e.g., updating context)

## Architecture

### State Machine Manager

The `StateMachineManager` class (located in `../StateMachineManager.ts`) handles:

- Initialization of state machines for all creeps
- Restoration from Memory between ticks
- Persistence to Memory at end of tick
- Cleanup of machines for dead creeps

### Role State Machines

Each role has its own TypeScript module defining:

1. **Context Interface**: Data specific to that role
2. **Event Union Type**: All possible events for that role
3. **State Configuration**: State definitions with transitions, guards, and actions
4. **Initial State Constant**: The starting state for new creeps

## Usage Example

```typescript
import { StateMachineManager } from "./StateMachineManager";

// In your main game loop
const stateMachineManager = new StateMachineManager();

export function loop() {
  // Initialize or restore machines
  stateMachineManager.initialize(Game.creeps);

  // Execute behavior for each creep
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    const machine = stateMachineManager.getMachine(name);

    if (machine) {
      // Send events based on game state
      // Execute actions based on current state
      // See roleExecutors/ for implementation examples
    }
  }

  // Persist machines to Memory
  stateMachineManager.persist(Game.creeps);

  // Cleanup dead creeps
  stateMachineManager.cleanup(Game.creeps);
}
```

## State Machine Definitions

### Harvester

**States**: idle → harvesting → delivering → upgrading
**Purpose**: Collect energy from sources and deliver to spawns/extensions

### Upgrader

**States**: recharge ⇄ upgrading
**Purpose**: Collect energy and upgrade room controller

### Builder

**States**: gather → build → maintain
**Purpose**: Collect energy, construct buildings, repair structures

### Hauler

**States**: pickup ⇄ deliver
**Purpose**: Transport energy from containers to spawns/extensions/towers

### Stationary Harvester

**States**: harvesting (continuous)
**Purpose**: Harvest energy at a fixed position near a source

### Repairer

**States**: gather ⇄ repair
**Purpose**: Collect energy and repair damaged structures

### Remote Miner

**States**: travel → mine → return
**Purpose**: Mine energy from remote rooms and return to home room

### Remote Hauler

**States**: travel → pickup → return
**Purpose**: Haul energy from remote rooms back to home room

### Attacker

**States**: travel → attack
**Purpose**: Engage hostile creeps and structures in combat

### Healer

**States**: travel → heal
**Purpose**: Support combat by healing wounded friendly creeps

### Dismantler

**States**: travel → dismantle
**Purpose**: Destroy hostile structures

### Claimer

**States**: travel → claim
**Purpose**: Claim controllers in target rooms

## Integration Status

The state machine definitions are complete and ready for use. However, they are not yet integrated into the main `BehaviorController.ts`.

**Current Status**: ✅ State machines defined | ⚠️ Integration pending

**Next Steps**:

1. Implement role executors that use the state machines (see `../roleExecutors/`)
2. Update `BehaviorController` to optionally use state machine-based execution
3. Migrate role handlers one at a time to state machine approach
4. Add comprehensive tests for state machine behaviors
5. Measure CPU performance compared to imperative approach

## Benefits

- **Declarative**: States and transitions are explicit and easy to understand
- **Testable**: State machines can be tested in isolation without game context
- **Maintainable**: Adding new states or transitions is straightforward
- **Debuggable**: Current state is always visible in Memory
- **Type-Safe**: Full TypeScript support with strict typing

## Performance

The `screeps-xstate` library is optimized for Screeps:

- Minimal bundle size (<5KB minified)
- Minimal CPU overhead (simple transitions with no interpreter)
- Built-in serialization for Memory storage
- ~0.01 CPU per transition
- ~0.02 CPU for serialization per machine

A typical creep with 5 states and 2 transitions per tick uses **~0.05 CPU total**.

## Resources

- [screeps-xstate README](../../../../packages/screeps-xstate/README.md)
- [Example: Harvester Integration](../../../../packages/screeps-xstate/examples/harvester-integration.ts)
- [Main Behavior Controller](../BehaviorController.ts)
