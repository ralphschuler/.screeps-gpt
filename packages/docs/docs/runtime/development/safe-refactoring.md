# Safe Refactoring Guidelines

This document provides guidelines for safely modifying runtime components, preserving game performance, and preventing breaking changes during code evolution.

## Overview

Refactoring Screeps AI code carries unique risks because bugs can cause game progress loss or resource waste. These guidelines help minimize risk while improving code quality.

## Refactoring Principles

### The Safety Triangle

All refactoring must balance three concerns:

1. **Correctness**: Does the code still work as intended?
2. **Performance**: Is CPU and memory usage preserved or improved?
3. **Maintainability**: Is the code easier to understand and modify?

**Golden Rule**: Never sacrifice correctness for performance or maintainability.

## Risk Assessment Framework

### Risk Levels

**Low Risk** (Safe to refactor freely):

- Code formatting and style changes
- Adding comments or documentation
- Renaming private variables
- Extracting pure utility functions
- Updating types without behavior changes

**Medium Risk** (Requires careful testing):

- Changing function signatures
- Modifying task state machines
- Updating memory schemas
- Changing pathfinding parameters
- Adjusting thresholds and constants

**High Risk** (Requires extensive validation):

- Rewriting core algorithms
- Changing spawn logic
- Modifying kernel orchestration
- Altering evaluation criteria
- Changing respawn detection

### Risk Mitigation Checklist

Before refactoring:

- [ ] Identify risk level
- [ ] Document current behavior
- [ ] Create regression test
- [ ] Measure baseline performance
- [ ] Plan rollback strategy

## Safe Refactoring Patterns

### Pattern 1: Extract Function

**Safe When**:

- Logic is pure (no side effects)
- No shared state dependencies
- Function is self-contained

**Example**:

```typescript
// Before
function runHarvester(creep: Creep): string {
  const sources = creep.room.find(FIND_SOURCES_ACTIVE);
  const closest = creep.pos.findClosestByPath(sources);
  // ... more logic
}

// After (extracted)
function findBestSource(creep: Creep): Source | null {
  const sources = creep.room.find(FIND_SOURCES_ACTIVE);
  return sources.length > 0 ? creep.pos.findClosestByPath(sources) : null;
}

function runHarvester(creep: Creep): string {
  const source = findBestSource(creep);
  // ... use source
}
```

**Validation**:

- Unit test extracted function
- Verify behavior unchanged
- Check CPU impact is neutral

### Pattern 2: Rename for Clarity

**Safe When**:

- Name change improves understanding
- Only internal usage (not exported)
- IDE refactoring tool used

**Example**:

```typescript
// Before
const t = creep.memory.task;

// After
const currentTask = creep.memory.task;
```

**Validation**:

- Ensure all references updated
- Run full test suite
- Check TypeScript compilation

### Pattern 3: Introduce Constant

**Safe When**:

- Magic numbers used multiple times
- Value may need tuning
- Improves readability

**Example**:

```typescript
// Before
if (spawn.store.energy < 50) { ... }
if (spawn.store.energy < 50) { ... }

// After
const MINIMUM_SPAWN_ENERGY = 50;
if (spawn.store.energy < MINIMUM_SPAWN_ENERGY) { ... }
```

**Validation**:

- Verify constant value correct
- Test all usage locations
- Document constant purpose

### Pattern 4: Simplify Conditional

**Safe When**:

- Logic is equivalent
- Edge cases preserved
- Readability improved

**Example**:

```typescript
// Before
if (memory.task !== HARVEST_TASK && memory.task !== DELIVER_TASK && memory.task !== UPGRADE_TASK) {
  memory.task = HARVEST_TASK;
}

// After
const VALID_TASKS = [HARVEST_TASK, DELIVER_TASK, UPGRADE_TASK];
if (!VALID_TASKS.includes(memory.task)) {
  memory.task = HARVEST_TASK;
}
```

**Validation**:

- Test all branches
- Verify edge cases
- Benchmark performance

## Dangerous Refactoring Patterns (Avoid)

### Anti-Pattern 1: Premature Optimization

**Problem**: Optimizing before measuring

**Example**:

```typescript
// Don't do this without profiling first!
const sourceCache = new Map(); // Might not be needed
```

**Solution**: Profile first, optimize second

### Anti-Pattern 2: Breaking API Contracts

**Problem**: Changing exported interfaces

**Example**:

```typescript
// Before
class BehaviorController {
  execute(game: GameContext, memory: Memory, roleCounts: Record<string, number>);
}

// DANGEROUS: Breaks consumers!
class BehaviorController {
  execute(game: GameContext, memory: Memory); // Removed parameter
}
```

**Solution**: Deprecate old interface, add new version

### Anti-Pattern 3: Removing Error Handling

**Problem**: Simplifying by removing safety

**Example**:

```typescript
// Before
const spawn = this.findAvailableSpawn(spawns);
if (!spawn) {
  this.logger.warn('No available spawns');
  return;
}

// DANGEROUS: Silently fails!
const spawn = this.findAvailableSpawn(spawns);
spawn.spawnCreep(...); // May be null!
```

**Solution**: Keep error handling even when "shouldn't happen"

### Anti-Pattern 4: Untested Behavior Changes

**Problem**: Changing logic without tests

**Example**:

```typescript
// Before
if (cpuUsed > cpuLimit * 0.8) { ... }

// DANGEROUS: Threshold changed, no test!
if (cpuUsed > cpuLimit * 0.9) { ... }
```

**Solution**: Write test, change code, verify test

## Component-Specific Guidelines

### BehaviorController Refactoring

**Critical Invariants**:

- Minimum role populations maintained
- Task state machines remain valid
- Spawn logic doesn't break
- Memory initialization preserved

**Safe Changes**:

- Pathfinding parameters (`reusePath`, `range`)
- Task transition logic (if tested)
- Target selection algorithms (if CPU-neutral)

**Risky Changes**:

- Role definitions (body, minimum count)
- State machine structure
- Spawn priority ordering

**Testing Requirements**:

- Unit tests for role logic
- Integration tests for spawn logic
- Regression tests for task switching

### MemoryManager Refactoring

**Critical Invariants**:

- Dead creeps always pruned
- Role counts always accurate
- Memory size doesn't grow unbounded

**Safe Changes**:

- Logging improvements
- Performance optimizations (if measured)
- Additional bookkeeping (if bounded)

**Risky Changes**:

- Pruning algorithm
- Role counting logic
- Memory schema modifications

**Testing Requirements**:

- Test pruning with various creep states
- Verify role counts with edge cases
- Check memory growth over time

### Kernel Refactoring

**Critical Invariants**:

- Components execute in correct order
- Performance tracking accurate
- Respawn detection works
- Evaluation persists correctly

**Safe Changes**:

- Component initialization
- Logging improvements
- Configuration options

**Risky Changes**:

- Execution order
- Component wiring
- Error handling flow

**Testing Requirements**:

- End-to-end integration tests
- Multi-tick simulation tests
- Respawn scenario tests

## Memory Schema Migrations

### Safe Migration Pattern

**Step 1: Add New Field (Non-Breaking)**

```typescript
// Version 1: Original
interface CreepMemory {
  role: string;
  task: string;
}

// Version 2: Add optional field
interface CreepMemory {
  role: string;
  task: string;
  assignedSource?: string; // New, optional
}
```

**Step 2: Populate New Field**

```typescript
// Initialize for new creeps
memory: () => ({
  role: "harvester",
  task: "harvest",
  assignedSource: undefined
});

// Migrate existing creeps gradually
if (creep.memory.assignedSource === undefined) {
  creep.memory.assignedSource = findSourceAssignment(creep);
}
```

**Step 3: Remove Old Field (Breaking)**

```typescript
// Only after all creeps migrated
delete creep.memory.oldField;
```

### Version Migration Strategy

**Use Role Versions**:

```typescript
const HARVESTER_VERSION = 2; // Increment when schema changes

// Detect and migrate
if (creep.memory.version !== HARVESTER_VERSION) {
  // Reset to defaults with new schema
  creep.memory = handler.memory();
}
```

**Benefits**:

- Automatic migration
- No manual intervention
- Gradual rollout as old creeps die

## Performance-Safe Refactoring

### CPU Budget Preservation

**Before Refactoring**:

```typescript
// Measure baseline
const cpuBefore = Game.cpu.getUsed();
oldImplementation();
const baselineCpu = Game.cpu.getUsed() - cpuBefore;
```

**After Refactoring**:

```typescript
// Measure new implementation
const cpuBefore = Game.cpu.getUsed();
newImplementation();
const newCpu = Game.cpu.getUsed() - cpuBefore;

// Verify improvement or neutral
assert(newCpu <= baselineCpu * 1.05, "CPU regression detected");
```

### Memory Size Preservation

**Before Refactoring**:

```typescript
const memoryBefore = JSON.stringify(Memory).length;
```

**After Refactoring**:

```typescript
const memoryAfter = JSON.stringify(Memory).length;
const growth = memoryAfter - memoryBefore;
assert(growth < 1000, `Memory grew by ${growth} bytes`);
```

## Rollback Procedures

### Level 1: Quick Rollback (Same Session)

**In Console**:

```javascript
// Revert to previous code
require("main").loop = previousLoopFunction;
```

**Limitations**: Only works if previous code still in cache

### Level 2: Git Rollback (Requires Deploy)

**Local**:

```bash
git revert HEAD
bun run build
bun run deploy
```

**Wait**: ~10-30 seconds for deployment

### Level 3: Emergency Rollback (Manual)

**When**: Catastrophic failure, immediate action needed

**Steps**:

1. Stop all creeps: `for (const name in Game.creeps) Game.creeps[name].suicide()`
2. Redeploy last known good version
3. Wait for respawn or rebuild

## Refactoring Checklist

### Pre-Refactoring

- [ ] Understand current behavior completely
- [ ] Identify all usage locations
- [ ] Create regression tests
- [ ] Measure baseline performance
- [ ] Document intended changes
- [ ] Plan rollback strategy

### During Refactoring

- [ ] Make minimal changes
- [ ] Preserve existing tests
- [ ] Update documentation
- [ ] Add new tests for changes
- [ ] Run tests frequently
- [ ] Check TypeScript compilation

### Post-Refactoring

- [ ] All tests pass
- [ ] Coverage maintained or improved
- [ ] Performance neutral or better
- [ ] Documentation updated
- [ ] Code review completed
- [ ] Deployed to test environment

### Post-Deployment

- [ ] Monitor CPU usage (first 1000 ticks)
- [ ] Watch for error logs
- [ ] Verify behavior matches expectations
- [ ] Check memory growth
- [ ] Validate metrics vs baseline
- [ ] Rollback if regressions detected

## Common Refactoring Scenarios

### Scenario 1: Optimizing Pathfinding

**Goal**: Reduce CPU by caching paths longer

**Risk**: High (can cause stuck creeps)

**Safe Approach**:

1. Test in private server first
2. Increase `reusePath` incrementally (5 → 7 → 10)
3. Monitor for stuck creeps
4. Rollback if issues detected

**Validation**:

- Creeps reach destinations
- CPU decreases measurably
- No idle time increase

### Scenario 2: Adding New Role

**Goal**: Introduce builder role

**Risk**: Medium (spawn logic changes)

**Safe Approach**:

1. Define role with minimum: 0 initially
2. Test role logic in isolation
3. Increase minimum after validation
4. Monitor energy balance

**Validation**:

- New role spawns correctly
- Existing roles unaffected
- CPU budget accommodates new role

### Scenario 3: Changing Task Logic

**Goal**: Improve harvester delivery efficiency

**Risk**: High (core behavior change)

**Safe Approach**:

1. Document current behavior
2. Create comprehensive tests
3. Implement change with feature flag
4. A/B test in private server
5. Gradually enable in production

**Validation**:

- Energy flow maintained or improved
- No delivery target starvation
- Task transitions remain valid

## Code Review Guidelines

### Reviewer Checklist

**Correctness**:

- [ ] Logic changes preserve behavior
- [ ] Edge cases handled
- [ ] Error handling adequate

**Performance**:

- [ ] CPU impact measured
- [ ] Memory usage checked
- [ ] No obvious performance regressions

**Testing**:

- [ ] Tests updated or added
- [ ] Coverage maintained
- [ ] Tests verify key behaviors

**Documentation**:

- [ ] Comments explain why, not what
- [ ] Public APIs documented
- [ ] Breaking changes noted

## Related Documentation

- [Strategy Testing](./strategy-testing.md) - Testing methodologies
- [Improvement Metrics](./improvement-metrics.md) - Measuring effectiveness
- [Creep Roles](../strategy/creep-roles.md) - Expected behaviors to preserve
- [Memory Management](../operations/memory-management.md) - Memory safety guidelines
- [Performance Monitoring](../operations/performance-monitoring.md) - CPU tracking
