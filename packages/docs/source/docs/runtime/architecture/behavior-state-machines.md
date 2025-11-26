---
title: Behavior State Machines
date: 2024-11-26
updated: 2024-11-26
categories:
  - Runtime
  - Architecture
tags:
  - state-machines
  - behavior
  - creeps
  - architecture
---

# Behavior State Machines

This document describes the state machine architecture used for creep behavior management in the Screeps bot runtime.

## Overview

The bot uses **state machines** to model and execute creep behaviors. Each role (harvester, upgrader, builder, etc.) is implemented as a dedicated state machine that:

- Defines explicit states (idle, harvesting, delivering, etc.)
- Declares valid state transitions via events
- Manages role-specific context and behavior
- Persists state across tick boundaries
- Integrates with the kernel process architecture

This approach replaced the monolithic `BehaviorController` pattern to improve modularity, testability, and maintainability.

## Architecture Components

### 1. State Machines

**Location**: `packages/bot/src/runtime/behavior/stateMachines/`

Each role has a dedicated state machine file that defines:

```typescript
// Example: harvester.ts
export interface HarvesterContext {
  creep: Creep;
  sourceId?: Id<Source>;
  targetId?: Id<AnyStoreStructure>;
}

export type HarvesterEvent =
  | { type: "START_HARVEST"; sourceId: Id<Source> }
  | { type: "ENERGY_FULL" }
  | { type: "START_DELIVER"; targetId: Id<AnyStoreStructure> }
  | { type: "ENERGY_EMPTY" };

export const harvesterStates: Record<string, StateConfig<HarvesterContext, HarvesterEvent>> = {
  idle: {
    onEntry: [ctx => {
      ctx.sourceId = undefined;
      ctx.targetId = undefined;
    }],
    on: {
      START_HARVEST: {
        target: "harvesting",
        actions: [(ctx, event) => {
          if (event.type === "START_HARVEST") {
            ctx.sourceId = event.sourceId;
          }
        }]
      }
    }
  },
  harvesting: {
    on: {
      ENERGY_FULL: { target: "delivering" },
      SOURCE_DEPLETED: { target: "idle" }
    }
  },
  delivering: {
    on: {
      ENERGY_EMPTY: { target: "idle" },
      TARGET_FULL: { target: "idle" }
    }
  }
};

export const HARVESTER_INITIAL_STATE = "idle";
```

**Key Features**:

- **Type-Safe Context**: Each role defines its own context interface
- **Event-Driven**: State transitions triggered by typed events
- **Guards**: Conditional transitions based on context state
- **Actions**: Side effects executed during transitions or state entry/exit
- **Serializable**: State machines can be serialized to/from memory

### 2. Role Controllers

**Location**: `packages/bot/src/runtime/behavior/controllers/`

Each role has a controller class that:

- Implements the `RoleController` interface
- Manages the state machine lifecycle for creeps
- Executes state-specific behavior logic
- Handles memory validation and migration

```typescript
// Example: HarvesterController.ts
import { profile } from "@ralphschuler/screeps-profiler";
import type { RoleController, RoleConfig } from "./RoleController";

@profile
export class HarvesterController implements RoleController<CreepMemory> {
  getRoleName(): string {
    return "harvester";
  }

  getConfig(): RoleConfig<CreepMemory> {
    return {
      minimum: 2,
      body: [WORK, CARRY, MOVE],
      createMemory: () => ({ role: "harvester" }),
      version: 1
    };
  }

  createMemory(): CreepMemory {
    return { role: "harvester" };
  }

  validateMemory(creep: CreepLike): void {
    // Validate and migrate memory if needed
    if (!creep.memory.role) {
      creep.memory.role = "harvester";
    }
  }

  execute(creep: CreepLike): string {
    const machine = stateMachineManager.getMachine(creep.name);
    if (!machine) return "idle";

    const currentState = machine.getCurrentState();
    
    // Execute state-specific behavior
    switch (currentState) {
      case "idle":
        return this.executeIdle(creep, machine);
      case "harvesting":
        return this.executeHarvesting(creep, machine);
      case "delivering":
        return this.executeDelivering(creep, machine);
      default:
        return "idle";
    }
  }

  private executeHarvesting(creep: Creep, machine: StateMachine): string {
    // Get source from context
    const ctx = machine.getContext();
    if (!ctx.sourceId) {
      machine.send({ type: "SOURCE_DEPLETED" });
      return "idle";
    }

    const source = Game.getObjectById(ctx.sourceId);
    if (!source) {
      machine.send({ type: "SOURCE_DEPLETED" });
      return "idle";
    }

    // Execute harvest
    const result = creep.harvest(source);
    if (result === OK && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      machine.send({ type: "ENERGY_FULL" });
    }

    return "harvest";
  }

  // Additional state execution methods...
}
```

### 3. RoleControllerManager

**Location**: `packages/bot/src/runtime/behavior/RoleControllerManager.ts`

The manager orchestrates all role controllers:

- Registers all role controllers at initialization
- Coordinates spawning based on role minimums
- Executes creep behavior via appropriate controller
- Manages CPU budget to prevent timeouts
- Integrates with kernel as a process

```typescript
import { process } from "@ralphschuler/screeps-kernel";
import { profile } from "@ralphschuler/screeps-profiler";

@process({ name: "RoleControllerManager", priority: 50, singleton: true })
@profile
export class RoleControllerManager {
  private readonly roleControllers: Map<string, RoleController>;

  constructor() {
    this.roleControllers = new Map();
    
    // Register all role controllers
    this.registerRoleController(new HarvesterController());
    this.registerRoleController(new UpgraderController());
    this.registerRoleController(new BuilderController());
    // ... more roles
  }

  public execute(game: GameContext, memory: Memory): BehaviorSummary {
    // Spawn creeps to meet role minimums
    this.ensureRoleMinimums(game, memory, roleCounts);

    // Execute each creep via its role controller
    for (const creep of Object.values(game.creeps)) {
      const controller = this.roleControllers.get(creep.memory.role);
      if (controller) {
        controller.execute(creep);
      }
    }

    return summary;
  }
}
```

### 4. StateMachineManager

**Location**: `packages/bot/src/runtime/behavior/StateMachineManager.ts`

Manages state machine instances:

- Initializes state machines for all creeps
- Restores machines from memory across ticks
- Persists machine state to memory
- Cleans up machines for dead creeps

```typescript
export class StateMachineManager {
  private machines: Map<string, StateMachine<CreepContext, CreepEvent>>;

  initialize(creeps: { [name: string]: Creep }): void {
    for (const name in creeps) {
      const creep = creeps[name];
      const role = creep.memory.role;
      const config = ROLE_CONFIGS[role];

      if (creep.memory.stateMachine) {
        // Restore from memory
        const machine = restore(creep.memory.stateMachine, config.states);
        machine.getContext().creep = creep; // Update creep reference
        this.machines.set(name, machine);
      } else {
        // Create new machine
        const context = this.createInitialContext(creep, role);
        const machine = new StateMachine(config.initialState, config.states, context);
        this.machines.set(name, machine);
      }
    }
  }

  persist(creeps: { [name: string]: Creep }): void {
    for (const [name, machine] of this.machines) {
      const creep = creeps[name];
      if (creep) {
        creep.memory.stateMachine = serialize(machine);
      }
    }
  }
}
```

## State Machine Patterns

### Basic State Transitions

```typescript
// Simple two-state machine (upgrader)
export const upgraderStates = {
  recharge: {
    on: {
      ENERGY_FULL: { 
        target: "upgrading",
        guard: ctx => ctx.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
      }
    }
  },
  upgrading: {
    on: {
      ENERGY_EMPTY: { 
        target: "recharge",
        guard: ctx => ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0
      }
    }
  }
};
```

### Conditional Transitions with Guards

```typescript
// Transition only if condition is met
{
  on: {
    CHECK_STORAGE: {
      target: "delivering",
      guard: ctx => {
        const storage = ctx.creep.room.storage;
        return storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 1000;
      }
    }
  }
}
```

### State Entry/Exit Actions

```typescript
// Execute logic when entering/exiting states
{
  idle: {
    onEntry: [ctx => {
      // Clear context when entering idle
      ctx.sourceId = undefined;
      ctx.targetId = undefined;
    }],
    onExit: [ctx => {
      // Log state exit
      console.log(`${ctx.creep.name} leaving idle state`);
    }]
  }
}
```

### Transition Actions

```typescript
// Execute logic during transition
{
  on: {
    START_HARVEST: {
      target: "harvesting",
      actions: [(ctx, event) => {
        if (event.type === "START_HARVEST") {
          ctx.sourceId = event.sourceId;
          ctx.creep.say("⛏️");
        }
      }]
    }
  }
}
```

## Role-Specific State Machines

### Harvester (Energy Collection + Delivery)

**States**: `idle`, `harvesting`, `delivering`

**Flow**:
1. `idle` → Find source → `START_HARVEST` → `harvesting`
2. `harvesting` → Energy full → `ENERGY_FULL` → `delivering`
3. `delivering` → Energy empty → `ENERGY_EMPTY` → `idle`

**Context**: `{ creep, sourceId, targetId }`

### Upgrader (Recharge + Upgrade)

**States**: `recharge`, `upgrading`

**Flow**:
1. `recharge` → Collect energy → `ENERGY_FULL` → `upgrading`
2. `upgrading` → Use energy → `ENERGY_EMPTY` → `recharge`

**Context**: `{ creep, sourceId }`

### Builder (Recharge + Build/Repair)

**States**: `recharge`, `building`, `repairing`

**Flow**:
1. `recharge` → Collect energy → `ENERGY_FULL` → `building` or `repairing`
2. `building` → Build complete or energy empty → `recharge` or `repairing`
3. `repairing` → Repair complete or energy empty → `recharge`

**Context**: `{ creep, sourceId, targetId, taskType }`

### Hauler (Pickup + Deliver)

**States**: `idle`, `collecting`, `delivering`

**Flow**:
1. `idle` → Find pickup → `START_COLLECT` → `collecting`
2. `collecting` → Energy full → `ENERGY_FULL` → `delivering`
3. `delivering` → Energy empty → `ENERGY_EMPTY` → `idle`

**Context**: `{ creep, pickupId, deliveryId }`

### Remote Roles (Travel + Work)

**States**: `travelToTarget`, `working`, `travelToHome`, `deposit`

**Flow**:
1. `travelToTarget` → Arrive → `ARRIVED` → `working`
2. `working` → Full or task complete → `FULL` or `TASK_COMPLETE` → `travelToHome`
3. `travelToHome` → Arrive → `ARRIVED` → `deposit`
4. `deposit` → Empty → `EMPTY` → `travelToTarget`

**Context**: `{ creep, homeRoom, targetRoom, ... }`

## Integration with Kernel

State machines integrate with the kernel process architecture:

```typescript
// main.ts
import { Kernel } from "@ralphschuler/screeps-kernel";
import "./runtime/behavior/RoleControllerManager"; // Auto-registers via @process

const kernel = new Kernel({ logger: console });

export const loop = () => {
  kernel.run(Game, Memory);
};
```

The `RoleControllerManager` is registered as a kernel process with:
- **Priority**: 50 (core gameplay)
- **Singleton**: true (single instance reused across ticks)
- **Execution**: Automatic via kernel scheduling

## Memory Persistence

State machines serialize to memory for cross-tick persistence:

```typescript
// Serialized format in creep memory
{
  "stateMachine": {
    "currentState": "harvesting",
    "context": {
      "sourceId": "5bbcab9c9099fc012e638441",
      "targetId": "5bbcab9c9099fc012e638442"
    }
  }
}
```

**Serialization Process**:
1. `StateMachineManager.persist()` called at end of tick
2. Each machine serialized via `serialize(machine)`
3. Stored in `creep.memory.stateMachine`
4. On next tick, restored via `restore(creep.memory.stateMachine, states)`
5. Creep reference updated (Game object changes each tick)

## Testing State Machines

### Unit Testing

```typescript
import { describe, it, expect } from "vitest";
import { StateMachine } from "@ralphschuler/screeps-xstate";
import { harvesterStates, HARVESTER_INITIAL_STATE } from "./harvester";

describe("Harvester State Machine", () => {
  it("should transition from idle to harvesting", () => {
    const context = { creep: mockCreep() };
    const machine = new StateMachine(
      HARVESTER_INITIAL_STATE,
      harvesterStates,
      context
    );

    expect(machine.getCurrentState()).toBe("idle");

    machine.send({ type: "START_HARVEST", sourceId: "source123" });

    expect(machine.getCurrentState()).toBe("harvesting");
    expect(machine.getContext().sourceId).toBe("source123");
  });

  it("should transition to delivering when energy full", () => {
    const context = { creep: mockCreep({ store: { energy: 50 } }) };
    const machine = new StateMachine("harvesting", harvesterStates, context);

    machine.send({ type: "ENERGY_FULL" });

    expect(machine.getCurrentState()).toBe("delivering");
  });
});
```

### Integration Testing

```typescript
describe("HarvesterController Integration", () => {
  it("should execute harvest and transition states", () => {
    const controller = new HarvesterController();
    const creep = createMockCreep({ role: "harvester" });
    
    // Initialize state machine
    stateMachineManager.initialize({ [creep.name]: creep });

    // First execution - should find source and harvest
    const task1 = controller.execute(creep);
    expect(task1).toBe("harvest");

    // Fill creep energy
    creep.store[RESOURCE_ENERGY] = creep.store.getCapacity();

    // Second execution - should transition to delivering
    const task2 = controller.execute(creep);
    expect(task2).toBe("deliver");
  });
});
```

## Best Practices

### 1. Keep States Focused

Each state should have a clear, single responsibility:

```typescript
// ✅ Good: Clear state purpose
harvesting: {
  on: { ENERGY_FULL: { target: "delivering" } }
}

// ❌ Bad: Multiple responsibilities
working: {
  on: { 
    ENERGY_FULL: { target: "delivering" },
    FOUND_CONSTRUCTION: { target: "building" },
    FOUND_REPAIR: { target: "repairing" }
  }
}
```

### 2. Use Guards for Validation

Add guards to prevent invalid transitions:

```typescript
// ✅ Good: Guard prevents invalid transition
on: {
  START_UPGRADE: {
    target: "upgrading",
    guard: ctx => ctx.creep.room.controller?.my === true
  }
}
```

### 3. Minimize Context Size

Keep context lean to reduce memory overhead:

```typescript
// ✅ Good: Only essential IDs
interface HarvesterContext {
  creep: Creep;
  sourceId?: Id<Source>;
  targetId?: Id<Structure>;
}

// ❌ Bad: Storing entire objects
interface HarvesterContext {
  creep: Creep;
  source?: Source;           // Don't store game objects
  target?: Structure;        // Use IDs instead
  pathCache?: PathFinderPath; // Don't cache complex data
}
```

### 4. Handle Invalid States

Always have fallback behavior:

```typescript
execute(creep: CreepLike): string {
  const machine = stateMachineManager.getMachine(creep.name);
  if (!machine) {
    // Fallback: create new machine or use default behavior
    return "idle";
  }

  const state = machine.getCurrentState();
  if (!this.stateHandlers[state]) {
    // Unknown state - transition to safe state
    machine.send({ type: "RESET" });
    return "idle";
  }

  return this.stateHandlers[state](creep, machine);
}
```

### 5. Use Descriptive Event Names

Events should clearly describe what happened:

```typescript
// ✅ Good: Clear event names
type HarvesterEvent =
  | { type: "SOURCE_DEPLETED" }
  | { type: "TARGET_FULL" }
  | { type: "ENERGY_EMPTY" };

// ❌ Bad: Ambiguous names
type HarvesterEvent =
  | { type: "DONE" }
  | { type: "ERROR" }
  | { type: "NEXT" };
```

## Performance Considerations

### Memory Overhead

- Each serialized state machine: ~50-100 bytes
- Simple states (idle/recharge): minimal overhead
- Complex states with IDs: ~100-150 bytes

### CPU Overhead

- State machine lookup: ~0.01 CPU
- State transition: ~0.02 CPU
- Serialization: ~0.03 CPU per machine
- Total per creep: ~0.06-0.10 CPU

### Optimization Tips

1. **Use Singleton RoleControllerManager**: Reuse instance across ticks
2. **Batch State Machine Operations**: Initialize/persist all at once
3. **Lazy Context Updates**: Only update context when needed
4. **Cache Controller Lookups**: Store controller references

## Migration from BehaviorController

If migrating from the old `BehaviorController` pattern:

1. **Identify Role Behaviors**: Extract each role's logic from monolithic controller
2. **Define States**: Map behavior phases to explicit states
3. **Define Events**: Identify triggers for state transitions
4. **Create State Machine**: Implement state definitions
5. **Create Controller**: Implement `RoleController` interface
6. **Register Controller**: Add to `RoleControllerManager`
7. **Test**: Unit test state machine and controller
8. **Deploy**: Verify in-game behavior matches old system
9. **Remove Old Code**: Delete obsolete `BehaviorController` code

See [Behavior Migration Guide](../operations/behavior-migration-guide.md) for detailed steps.

## Related Documentation

- [ADR-004: State Machine Architecture](../../../../../docs/strategy/decisions/adr-004-state-machine-behavior-architecture.md)
- [Behavior Migration Guide](../../operations/behavior-migration-guide.md)
- [Custom Kernel Architecture](../../../../../docs/architecture/custom-kernel.md)
- [Creep Roles Strategy](../strategy/creep-roles.md)

## Examples Repository

Full state machine implementations available at:

- `packages/bot/src/runtime/behavior/stateMachines/` - All role state machines
- `packages/bot/src/runtime/behavior/controllers/` - All role controllers
- `packages/bot/tests/unit/behavior/` - Unit tests
- `packages/bot/tests/e2e/behavior/` - Integration tests
