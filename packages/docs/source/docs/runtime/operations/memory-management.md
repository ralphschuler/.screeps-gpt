---
title: Memory Management
date: 2025-10-24T12:33:51.452Z
---

# Memory Management

This document describes memory management patterns, optimization strategies, and cleanup procedures implemented in `src/runtime/memory/MemoryManager.ts`.

## Overview

The Memory object in Screeps persists between ticks and can grow unbounded if not properly managed. The `MemoryManager` handles hygiene by pruning stale entries and maintaining aggregate statistics.

## Memory Structure

### Top-Level Memory Schema

```typescript
interface Memory {
  creeps: Record<string, CreepMemory>; // Per-creep state
  roles: Record<string, number>; // Role population counts
  respawn?: {
    // Respawn tracking (optional)
    needsRespawn: boolean;
    respawnRequested: boolean;
    lastSpawnLostTick?: number;
  };
  systemReport?: {
    // Evaluation results (optional)
    lastGenerated: number;
    report: SystemReport;
  };
}
```

### Creep Memory Schema

```typescript
interface CreepMemory {
  role: "harvester" | "upgrader"; // Role assignment (required)
  task: string; // Current task state (required)
  version: number; // Role version for migrations (required)
  // Additional custom fields allowed
}
```

### Role Counts Schema

```typescript
interface RoleCounts {
  harvester: number; // Count of harvester creeps
  upgrader: number; // Count of upgrader creeps
  unassigned?: number; // Count of creeps without roles
}
```

## Memory Hygiene Operations

### Pruning Stale Creep Memories

**Trigger**: Every tick via `Kernel.run()`  
**Method**: `MemoryManager.pruneMissingCreeps()`

**Algorithm**:

```
1. Iterate all keys in Memory.creeps
2. Check if creep exists in Game.creeps
3. If not found, delete Memory.creeps[name]
4. Log removed creep names
5. Return list of pruned names
```

**Example Log**:

```
Removed 2 stale creep memories: harvester-12345-789, upgrader-12350-123
```

**Purpose**:

- Prevents unbounded memory growth
- Reclaims memory from dead creeps
- Keeps memory access performant

**Memory Savings**:

- ~50-100 bytes per pruned creep
- Prevents multi-KB accumulation over hundreds of ticks

### Updating Role Bookkeeping

**Trigger**: Every tick via `Kernel.run()`  
**Method**: `MemoryManager.updateRoleBookkeeping()`

**Algorithm**:

```
1. Initialize empty role count map
2. Iterate all living creeps in Game.creeps
3. Read role from creep.memory.role
4. Increment count for that role
5. Store final counts in Memory.roles
6. Return role count map
```

**Example Result**:

```typescript
{
  harvester: 2,
  upgrader: 1
}
```

**Purpose**:

- Provides aggregate statistics for spawn logic
- Enables quick population queries without iteration
- Caches derived data for efficiency

**CPU Cost**: ~0.05-0.1 CPU per tick

## Memory Access Patterns

### Read Patterns

**Per-Tick Reads** (executed every tick):

- `Memory.creeps[name]`: Individual creep memory (per creep)
- `Memory.roles`: Role population counts (once per tick)
- `Memory.respawn`: Respawn state (once per tick)
- `Memory.systemReport`: Last evaluation (once per tick)

**Cost**: ~0.1 CPU total per tick

**Optimization**: Direct property access is faster than `Object.keys()` iteration

### Write Patterns

**Per-Tick Writes**:

- `Memory.creeps[name].task`: Task state updates (per creep)
- `Memory.roles`: Role counts (once per tick)
- `Memory.respawn`: Respawn state changes (when needed)
- `Memory.systemReport`: Evaluation results (when needed)

**Cost**: ~0.05-0.1 CPU total per tick

**Optimization**: Batch writes minimize serialization overhead

## Memory Size Limits

### Practical Limits

Screeps has a **soft limit** of 2MB per Memory object, but performance degrades significantly before that:

**Performance Tiers**:

- **<100 KB**: Excellent (no noticeable impact)
- **100-500 KB**: Good (minor CPU overhead)
- **500 KB - 1 MB**: Degraded (noticeable CPU cost)
- **1+ MB**: Poor (significant CPU cost, risk of limit)

### Current Memory Usage (Typical)

**Baseline** (3 creeps, RCL 1):

```
Memory.creeps:      ~300 bytes  (100 bytes × 3 creeps)
Memory.roles:       ~50 bytes
Memory.respawn:     ~100 bytes
Memory.systemReport: ~500 bytes
──────────────────────────────
Total:              ~1 KB
```

**Scaled** (50 creeps, RCL 6):

```
Memory.creeps:      ~5 KB  (100 bytes × 50 creeps)
Memory.roles:       ~100 bytes
Memory.respawn:     ~100 bytes
Memory.systemReport: ~1 KB
──────────────────────────────
Total:              ~6.2 KB
```

**Growth Rate**: ~100 bytes per creep (baseline memory structure)

## Memory Cleanup Strategies

### Automatic Cleanup

**Implemented Strategies**:

1. **Creep Memory Pruning** (Every tick)
   - Removes memory for dead creeps
   - Prevents unbounded growth
   - Zero manual intervention required

2. **Role Count Updates** (Every tick)
   - Overwrites previous counts
   - No historical data accumulation
   - Self-maintaining

### Manual Cleanup (If Needed)

**Orphaned Respawn State**:

```javascript
// Clear respawn state manually in console
delete Memory.respawn;
```

**Old System Reports**:

```javascript
// Clear old evaluation results
delete Memory.systemReport;
```

**Complete Memory Reset** (Nuclear option):

```javascript
// WARNING: Deletes ALL memory
for (const name in Memory.creeps) {
  delete Memory.creeps[name];
}
delete Memory.roles;
delete Memory.respawn;
delete Memory.systemReport;
```

### Selective Cleanup

**Remove Specific Role Memories**:

```javascript
// Remove all harvester memories
for (const name in Game.creeps) {
  if (Game.creeps[name].memory.role === "harvester") {
    delete Memory.creeps[name];
  }
}
```

## Memory Corruption Recovery

### Detection

**Symptoms**:

- Creeps behave incorrectly
- Role counts incorrect
- System evaluation failures
- Error logs about missing memory fields

**Diagnostic Queries** (in console):

```javascript
// Check for creeps with missing role
Object.keys(Game.creeps).filter(name => !Game.creeps[name].memory.role);

// Check for memory without living creeps
Object.keys(Memory.creeps).filter(name => !Game.creeps[name]);

// Check role count accuracy
const actual = {};
for (const name in Game.creeps) {
  const role = Game.creeps[name].memory.role || "unassigned";
  actual[role] = (actual[role] || 0) + 1;
}
console.log("Expected:", Memory.roles, "Actual:", actual);
```

### Recovery Procedures

**Level 1: Automatic Recovery** (Handled by runtime)

- Creep version mismatches → Reset to defaults
- Missing task fields → Reset to role default
- No manual intervention needed

**Level 2: Guided Recovery**

```javascript
// Force memory refresh (in console)
for (const name in Game.creeps) {
  const creep = Game.creeps[name];
  if (!creep.memory.role) {
    creep.memory.role = "harvester"; // Assign default role
    creep.memory.task = "harvest";
    creep.memory.version = 1;
  }
}
```

**Level 3: Full Reset** (Last resort)

```javascript
// Complete memory wipe and rebuild (in console)
for (const name in Memory.creeps) {
  delete Memory.creeps[name];
}
// Let MemoryManager rebuild on next tick
```

### Prevention Strategies

1. **Validate Before Write**
   - Always check memory field types
   - Use TypeScript for compile-time checks
   - Validate in tests

2. **Defensive Reads**
   - Check for undefined/null before using
   - Provide fallback defaults
   - Example: `const role = creep.memory.role || 'harvester'`

3. **Version Migration**
   - Increment role versions when changing memory structure
   - Detect old versions and reset safely
   - Prevents incompatible memory layouts

## Memory Optimization Techniques

### 1. Avoid Storing Redundant Data

**Bad**:

```typescript
creep.memory.sourceId = source.id;
creep.memory.sourcePos = source.pos; // Redundant!
creep.memory.sourceName = source.name; // Redundant!
```

**Good**:

```typescript
creep.memory.sourceId = source.id; // Only store ID, derive rest
```

### 2. Use Short Property Names

**Impact**: ~30% memory savings on deeply nested objects

**Bad**:

```typescript
{
  currentTaskName: 'harvest',
  targetSourceIdentifier: '5bbcad0f9099fc012e638886'
}
```

**Good**:

```typescript
{
  task: 'harvest',
  src: '5bbcad0f9099fc012e638886'
}
```

### 3. Avoid Storing Entire Objects

**Bad**:

```typescript
creep.memory.target = targetStructure; // Stores entire object!
```

**Good**:

```typescript
creep.memory.targetId = targetStructure.id; // Store only ID
// Retrieve later: Game.getObjectById(creep.memory.targetId)
```

### 4. Use Bitflags for Boolean States

**For advanced users**: Multiple booleans can be stored as single number

**Example**:

```typescript
// Instead of:
{ idle: false, moving: true, harvesting: false, upgrading: false }

// Use bitflags:
{ state: 0b0010 } // Single number, 4 bits
```

**Savings**: ~75% memory for boolean flags

## Memory Persistence Patterns

### Transient State (DO NOT PERSIST)

**Examples**:

- Pathfinding cache (regenerated each tick)
- Target distance calculations
- Temporary variables in task logic

**Guideline**: If it can be recalculated cheaply, don't store it.

### Persistent State (OK TO PERSIST)

**Examples**:

- Role assignment (changes rarely)
- Current task state (changes per task cycle)
- Role version (changes on code updates)
- Assigned resource IDs (stable across ticks)

**Guideline**: If recalculation is expensive or state must survive tick boundary, persist it.

### Cached State (CONDITIONAL PERSISTENCE)

**Examples**:

- Source assignments (recalculate every N ticks)
- Room statistics (refresh every 10-100 ticks)
- Pathfinding results (cache for 5-50 ticks)

**Guideline**: Store with TTL, refresh when expired.

## Memory Usage Monitoring

### Manual Inspection

**Check Memory Size** (in console):

```javascript
// Approximate memory size in bytes
JSON.stringify(Memory).length;
```

**Per-Creep Memory Size**:

```javascript
// Average memory per creep
const totalSize = JSON.stringify(Memory.creeps).length;
const creepCount = Object.keys(Memory.creeps).length;
console.log(`${(totalSize / creepCount).toFixed(0)} bytes per creep`);
```

### Automated Monitoring

**Track in System Evaluation**:

```typescript
// Add to SystemEvaluator.evaluate()
const memorySize = JSON.stringify(memory).length;
if (memorySize > 100000) {
  // 100 KB warning threshold
  findings.push({
    severity: "warning",
    title: "Memory usage high",
    detail: `Memory size: ${(memorySize / 1024).toFixed(1)} KB`,
    recommendation: "Review memory storage patterns and clean up unused data."
  });
}
```

## Best Practices Summary

### DO:

- ✓ Prune dead creep memories every tick
- ✓ Store only essential state in memory
- ✓ Use IDs instead of object references
- ✓ Validate memory structure before use
- ✓ Implement version migrations for schema changes

### DON'T:

- ✗ Store entire game objects in memory
- ✗ Accumulate historical data without limits
- ✗ Store redundant/derivable information
- ✗ Use long property names unnecessarily
- ✗ Persist transient state

### MONITOR:

- ⚠ Total memory size (keep <100 KB for good performance)
- ⚠ Memory growth rate (should be stable)
- ⚠ Orphaned memory entries (should be zero)
- ⚠ CPU cost of memory operations (should be <0.2 CPU/tick)

## Related Documentation

- [Creep Roles](../strategy/creep-roles.md) - Memory structure for each role
- [Safe Refactoring](../development/safe-refactoring.md) - How to migrate memory schemas safely
- [Performance Monitoring](./performance-monitoring.md) - CPU impact of memory operations
- [Respawn Procedures](./respawn-handling.md) - Memory state during respawn
