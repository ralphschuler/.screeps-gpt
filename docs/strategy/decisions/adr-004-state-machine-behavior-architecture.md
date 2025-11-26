# ADR-004: State Machine Behavior Architecture

**Status**: Accepted  
**Date**: 2024-11-26 (Retroactive - decision made during Phase 2-3 implementation)  
**Deciders**: Autonomous development system, @ralphschuler  
**Context**: Phase 2-3 Behavior Evolution  
**Related Issues**: #1267 (State machine migration), #1261 (Creep behavior modularity)

## Context and Problem Statement

The bot's behavior system evolved from a monolithic `BehaviorController` that managed all creep roles in a single class. As the codebase grew to support multiple role types (harvester, upgrader, builder, hauler, etc.) with complex behaviors, the monolithic approach became difficult to maintain, test, and extend. How should we structure creep behavior to support:

- Clear state transitions and behavior logic
- Independent development and testing of role types
- Extensibility for new roles without affecting existing ones
- Integration with the kernel-based process architecture

## Decision Drivers

- **Modularity** - Each role should be independently testable and maintainable
- **State Clarity** - Creep behavior involves explicit states (idle, harvesting, delivering, etc.)
- **Maintainability** - Changes to one role shouldn't affect others
- **Testability** - Individual role behaviors must be unit testable
- **CPU Efficiency** - State transitions should be lightweight
- **Type Safety** - State machines should leverage TypeScript's type system
- **Memory Persistence** - State must survive tick boundaries
- **Extensibility** - Easy to add new roles without modifying existing code

## Considered Options

### Option 1: State Machine Architecture (Selected)

**Description**: Implement each role as a dedicated state machine using the `screeps-xstate` package. Each role controller manages:
- State machine definitions with explicit states and transitions
- Role-specific context and event types
- Integration with `RoleControllerManager` for orchestration

**Architecture Components**:

1. **State Machines** (`packages/bot/src/runtime/behavior/stateMachines/`)
   - One state machine per role (harvester, upgrader, builder, etc.)
   - Explicit state definitions with entry/exit actions
   - Event-driven state transitions
   - Serializable to/from memory

2. **Role Controllers** (`packages/bot/src/runtime/behavior/controllers/`)
   - One controller per role implementing `RoleController` interface
   - Manages state machine lifecycle
   - Handles memory validation and migration
   - Executes state-specific behavior

3. **RoleControllerManager** (`packages/bot/src/runtime/behavior/RoleControllerManager.ts`)
   - Orchestrates all role controllers
   - Manages spawning and role counts
   - Handles CPU budget management
   - Registered as kernel process via `@process` decorator

4. **StateMachineManager** (`packages/bot/src/runtime/behavior/StateMachineManager.ts`)
   - Manages state machine instances for all creeps
   - Handles initialization, persistence, and cleanup
   - Restores machines from memory across ticks

**Pros**:

- **Explicit State Modeling**: States and transitions are clearly defined and visible
- **Independent Development**: Each role is self-contained with its own state machine
- **Type Safety**: TypeScript enforces context and event types per role
- **Testability**: State machines can be tested in isolation with mock contexts
- **Memory Efficiency**: State machines serialize cleanly to memory
- **Extensibility**: Adding new roles requires no changes to existing roles
- **Debugging**: Current state is visible in memory for inspection
- **Reusability**: State machine patterns can be shared across similar roles
- **Integration**: Works seamlessly with kernel process architecture

**Cons**:

- **Learning Curve**: Developers must understand state machine concepts
- **Initial Complexity**: More files and structure than monolithic approach
- **Memory Overhead**: Each creep stores serialized state machine state
- **Abstraction Layer**: Additional layer between game logic and execution

**Complexity**: Medium-High (initial), Medium (long-term)

### Option 2: Monolithic BehaviorController (Previous Implementation)

**Description**: Single class with methods for each role's behavior logic. Role switching via `switch` statements or method dispatch based on creep memory role.

**Pros**:

- Simple initial implementation
- All behavior logic in one place
- Easy to see role interactions

**Cons**:

- **Poor Modularity**: Changes to one role risk breaking others
- **Testing Difficulty**: Hard to test individual roles in isolation
- **Merge Conflicts**: Multiple developers working on roles cause conflicts
- **State Management**: Implicit state tracking in memory without clear transitions
- **Scalability**: Grows unwieldy as roles and behaviors increase
- **Maintenance Burden**: Bug fixes require understanding entire controller
- **Coupling**: High coupling between different role behaviors

**Complexity**: Low (initially), Very High (at scale)

### Option 3: Pure Functional Role Behaviors

**Description**: Each role implemented as pure functions taking creep and game state, returning actions. No explicit state machines.

**Pros**:

- Functional programming paradigm
- Pure functions are easy to test
- No state management complexity
- Lightweight implementation

**Cons**:

- **State Tracking**: Must manually track state in memory
- **Complex Transitions**: Multi-step behaviors require manual coordination
- **Debugging**: Harder to understand current behavior state
- **Code Duplication**: State transition logic repeated across roles
- **Type Safety**: Less TypeScript assistance for state validation

**Complexity**: Medium

### Option 4: Behavior Trees

**Description**: Hierarchical tree of behavior nodes (selectors, sequences, actions) that execute based on priorities and conditions.

**Pros**:

- Visual representation possible
- Common in game AI
- Reusable subtrees
- Priority-based execution

**Cons**:

- **Overkill**: Screeps doesn't need complex AI decision trees
- **Performance**: Tree traversal has CPU overhead
- **Memory**: Large tree structures
- **Complexity**: Harder to reason about than state machines
- **Integration**: Doesn't align with kernel architecture

**Complexity**: High

## Decision Outcome

**Chosen Option**: State Machine Architecture (Option 1)

**Rationale**:

The state machine architecture provides the best balance of:

1. **Explicit Behavior Modeling**: State machines make behavior logic and transitions explicit and visible
2. **Modularity**: Each role is completely independent with clear interfaces
3. **Type Safety**: TypeScript provides compile-time guarantees for state transitions
4. **Integration**: Works seamlessly with existing kernel and process architecture
5. **Scalability**: New roles can be added without touching existing code
6. **Maintainability**: Changes are localized to specific role controllers
7. **Debugging**: State is visible and inspectable in memory

The `screeps-xstate` package provides lightweight state machine primitives specifically designed for Screeps, avoiding the overhead of full XState while maintaining the state machine paradigm.

## Implementation Timeline

### Phase 1: Foundation (Completed)
- Created `StateMachineManager` for lifecycle management
- Implemented core role state machines (harvester, upgrader)
- Established `RoleController` interface pattern

### Phase 2: Migration (Completed)
- Migrated all roles to state machine pattern
- Created specialized state machines for each role type
- Integrated with `RoleControllerManager` orchestration

### Phase 3: Deprecation (Issue #1267 - In Progress)
- Remove obsolete `BehaviorController` code
- Update documentation to reflect new architecture
- Remove `USE_MODULAR_CONTROLLERS` feature flag

## Consequences

### Positive

- **Clear Separation**: Each role has dedicated state machine and controller
- **Independent Testing**: Role behaviors can be tested in complete isolation
- **Type Safety**: TypeScript enforces valid state transitions and events
- **Extensibility**: New roles require only adding new files, no modifications
- **Maintainability**: Bug fixes and features are localized to specific roles
- **Debugging**: Current state visible in memory aids troubleshooting
- **CPU Efficiency**: State machines execute only relevant behavior per state
- **Memory Persistence**: State survives across ticks via serialization

### Negative

- **Initial Learning**: Developers need to understand state machine concepts
- **More Files**: Each role requires multiple files (state machine + controller)
- **Memory Overhead**: Each creep stores serialized state (~50-100 bytes)
- **Abstraction Cost**: Additional layer between game and behavior logic

### Neutral

- **Architecture Consistency**: Aligns with kernel process architecture
- **Pattern Precedent**: Establishes state machine pattern for future features
- **Migration Effort**: One-time cost to migrate from BehaviorController

## Related Decisions

- **ADR-001**: Manager-Based Architecture - State machines fit within manager pattern
- **ADR-002**: Role-to-Task Migration - State machines manage task selection per role
- **Kernel Architecture** (custom-kernel.md) - RoleControllerManager integrates as kernel process

## Examples

### State Machine Definition (Harvester)

```typescript
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
```

### Role Controller Integration

```typescript
@profile
export class HarvesterController implements RoleController<CreepMemory> {
  getRoleName(): string {
    return "harvester";
  }

  execute(creep: CreepLike): string {
    const machine = stateMachineManager.getMachine(creep.name);
    if (!machine) return "idle";

    const currentState = machine.getCurrentState();
    
    // Execute state-specific logic
    switch (currentState) {
      case "harvesting":
        return this.executeHarvesting(creep, machine);
      case "delivering":
        return this.executeDelivering(creep, machine);
      default:
        return this.executeIdle(creep, machine);
    }
  }
}
```

### RoleControllerManager Orchestration

```typescript
@process({ name: "RoleControllerManager", priority: 50, singleton: true })
export class RoleControllerManager {
  private readonly roleControllers: Map<string, RoleController>;

  public execute(game: GameContext, memory: Memory): BehaviorSummary {
    // Initialize state machines
    stateMachineManager.initialize(game.creeps);

    // Execute each creep via its role controller
    for (const creep of Object.values(game.creeps)) {
      const controller = this.roleControllers.get(creep.memory.role);
      if (controller) {
        controller.execute(creep);
      }
    }

    // Persist state machines
    stateMachineManager.persist(game.creeps);
    stateMachineManager.cleanup(game.creeps);
  }
}
```

## Verification

Migration to state machine architecture is considered complete when:

- ✅ All role types have dedicated state machines
- ✅ All role types have dedicated controllers implementing `RoleController`
- ✅ `RoleControllerManager` orchestrates all roles
- ✅ `StateMachineManager` handles lifecycle
- ✅ State machines integrated with kernel via `@process` decorator
- ⏳ `BehaviorController` removed from codebase (Issue #1267)
- ⏳ `USE_MODULAR_CONTROLLERS` feature flag removed (Issue #1267)
- ⏳ Documentation updated to reflect state machine architecture
- ⏳ Migration guide created for future reference

## References

- **Issue #1267**: Complete state machine migration
- **Issue #1261**: Document creep behavior modularity
- **Screeps XState Package**: `packages/screeps-xstate/` - Lightweight state machine library
- **State Machines**: `packages/bot/src/runtime/behavior/stateMachines/`
- **Role Controllers**: `packages/bot/src/runtime/behavior/controllers/`
- **RoleControllerManager**: `packages/bot/src/runtime/behavior/RoleControllerManager.ts`
- **StateMachineManager**: `packages/bot/src/runtime/behavior/StateMachineManager.ts`
- **Custom Kernel Architecture**: `docs/architecture/custom-kernel.md`

## Notes

This ADR is written retroactively to document the decision process and rationale behind the state machine migration. The implementation was completed incrementally over multiple releases, with this document serving as the official architectural record.
