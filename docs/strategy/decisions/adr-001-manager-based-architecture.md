# ADR-001: Manager-Based Architecture

**Status**: Accepted  
**Date**: 2024-11-06 (Retroactive - decision made during initial implementation)  
**Deciders**: Autonomous development system, @ralphschuler  
**Context**: Phase 1-5 Foundation

## Context and Problem Statement

The bot needs a modular, maintainable architecture for organizing game logic across different concerns (spawning, defense, infrastructure, economy, etc.). How should we structure the codebase to support autonomous evolution while maintaining clarity and testability?

## Decision Drivers

- **Modularity** - Components should be independently testable and updatable
- **Maintainability** - Clear separation of concerns for easier debugging
- **Extensibility** - Easy to add new features without affecting existing code
- **Performance** - Minimal CPU overhead from architecture itself
- **Autonomous Development** - Structure should support AI-driven code changes
- **Screeps Best Practices** - Align with proven patterns from successful bots

## Considered Options

### Option 1: Manager-Based Architecture

**Description**: Organize code into specialized manager classes, each responsible for a specific domain (SpawnManager, TowerManager, LinkManager, etc.). Managers are orchestrated by a central Kernel.

**Pros**:

- Clear separation of concerns
- Easy to test individual managers in isolation
- Straightforward to add new managers without touching existing code
- Managers can be enabled/disabled independently
- Aligns with Overmind and other successful bot patterns
- Good for autonomous development (agents can work on one manager at a time)

**Cons**:

- Requires careful orchestration to avoid coupling
- Manager communication needs well-defined interfaces
- Potential for duplicate logic if not careful with shared utilities
- More files/classes than monolithic approach

**Complexity**: Medium

### Option 2: Monolithic Main Loop

**Description**: Single file with all game logic, organized by game object types (creeps, spawns, towers, etc.) with helper functions.

**Pros**:

- Simple to understand initially
- No abstraction overhead
- Easy to see all logic in one place
- Fast prototyping

**Cons**:

- Becomes unwieldy as complexity grows
- Hard to test individual features
- Difficult to maintain and debug
- Poor separation of concerns
- Not suitable for autonomous development (conflicting changes)
- Scales poorly to multi-room and advanced features

**Complexity**: Low (initially), Very High (at scale)

### Option 3: Event-Driven Architecture

**Description**: Components publish and subscribe to events (e.g., "creep died", "spawn idle", "under attack"). Central event bus coordinates actions.

**Pros**:

- Highly decoupled components
- Easy to add new event listeners
- Flexible and extensible
- Good for complex coordination

**Cons**:

- Harder to reason about control flow
- Potential performance overhead from event propagation
- Difficult to debug (indirect relationships)
- Overkill for current needs
- More complex for autonomous development

**Complexity**: High

## Decision Outcome

**Chosen option**: "Manager-Based Architecture"

**Rationale**:

- Provides best balance of modularity, maintainability, and performance
- Aligns with proven Screeps bot patterns (Overmind, Quorum)
- Supports autonomous development by isolating concerns
- Easy to test and debug individual components
- Extensible for future features without architectural changes
- Clear ownership boundaries for each domain

## Consequences

### Positive

- **Clear Structure**: Each manager has well-defined responsibilities
- **Testability**: Managers can be unit tested in isolation
- **Maintainability**: Changes localized to specific managers
- **Extensibility**: New managers added without modifying kernel
- **Performance**: Minimal overhead, managers called directly by kernel
- **Autonomous Development**: Agents can work on managers independently

### Negative

- **Boilerplate**: Requires manager class setup for new features
- **Orchestration Complexity**: Kernel must manage execution order
- **Potential Coupling**: Must be careful with manager dependencies
- **Learning Curve**: New developers need to understand manager pattern

### Neutral

- **File Count**: More files than monolithic, but organized
- **Abstraction Level**: Medium abstraction - not too simple, not over-engineered

## Implementation Notes

### Core Architecture

**Kernel** (`src/runtime/bootstrap/kernel.ts`):

- Central orchestrator for all managers
- Handles execution order and error isolation
- Provides lifecycle hooks (init, pre-tick, tick, post-tick)
- Manages CPU budget allocation

**Manager Pattern**:

```typescript
export class ExampleManager {
  static run(room: Room): void {
    // Manager logic here
  }
}
```

**Manager Organization**:

- `src/runtime/behavior/` - Creep role and spawn management
- `src/runtime/defense/` - Tower and defense logic
- `src/runtime/energy/` - Link and storage management
- `src/runtime/infrastructure/` - Construction and planning
- `src/runtime/tasks/` - Task queue and assignment
- `src/runtime/scouting/` - Room exploration and mapping

### Execution Flow

1. **Kernel.loop()** called each tick
2. **Global managers** execute (respawn detection, memory cleanup)
3. **Per-room managers** execute in order:
   - RespawnManager (detect respawn, reinitialize)
   - BasePlanner (plan construction)
   - TowerManager (defense and repair)
   - LinkManager (energy distribution)
   - BehaviorController (creep roles and spawning)
4. **Post-tick cleanup** (stats collection, profiling)

### Manager Dependencies

Managers should minimize dependencies on each other. When needed:

- Use shared contracts (`src/shared/contracts.ts`)
- Access game state directly (Game, Memory)
- Communicate via Memory structures
- Avoid direct manager-to-manager calls

### Adding New Managers

1. Create manager file in appropriate directory
2. Implement static `run(room: Room)` method
3. Add to kernel execution order
4. Add unit tests
5. Document in code and relevant docs
6. Update CHANGELOG

### Migration Path

None required - this was the initial architecture. Future changes to task-based architecture (Phase 2+) will co-exist with manager pattern.

## Validation Criteria

✅ **Achieved**:

- All major features implemented as managers
- Clear separation of concerns
- Comprehensive test coverage (1020 tests)
- Bot functional from RCL 1-8
- Successfully supports autonomous development
- No performance issues from architecture

**Ongoing Validation**:

- CPU usage remains efficient (<20 CPU/tick at scale)
- Managers remain decoupled (low coupling metrics)
- Test coverage maintained (>80% for critical managers)
- Code changes localized to single manager (80%+ of changes)

## Links

- [Kernel Implementation](../../packages/bot/src/runtime/bootstrap/kernel.ts)
- [Manager Examples](../../packages/bot/src/runtime/)
- [Overmind Analysis](../research/overmind-analysis.md) - Inspiration
- [Phase 1 Documentation](../phases/phase-1.md)
- [CHANGELOG](../../../CHANGELOG.md) - Initial implementation

## Notes

### Future Considerations

**Phase 2-3 Task System**: Manager architecture will co-exist with task-based system. Managers will generate tasks, TaskManager will assign them to creeps.

**Phase 4-5 Multi-Room**: Manager pattern extends naturally to multi-room by adding ColonyManager to coordinate room-level managers.

**Performance**: If CPU becomes constrained, consider:

- Selective manager execution (skip managers when not needed)
- CPU bucket-aware scheduling (defer non-critical managers)
- Manager profiling to identify expensive operations

### Lessons Learned

**Successes**:

- Architecture scaled well from Phase 1 to Phase 5
- Easy to add new features (labs, factories, combat)
- Autonomous development worked smoothly
- Testing and debugging straightforward

**Challenges**:

- Initial kernel orchestration required careful thought
- Some managers grew large (BehaviorController, BasePlanner)
- Occasional coupling issues (spawn priority vs. task priority)

**Recommendations**:

- Keep managers focused (single responsibility)
- Extract large managers into smaller ones when needed
- Use shared utilities for common operations
- Document manager dependencies clearly
