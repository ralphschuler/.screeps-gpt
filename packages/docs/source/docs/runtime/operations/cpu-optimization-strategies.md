# CPU Optimization Strategies

## Overview

This guide provides comprehensive strategies for optimizing CPU usage in the Screeps bot. It focuses on kernel-level CPU budget allocation, incremental protection patterns, memory operation optimization, and creep behavior efficiency improvements.

**Purpose**: Enable developers and autonomous workflows to implement effective CPU optimizations that maintain bot performance within safe operating limits while maximizing game progress.

**Target Performance**:

- CPU usage <90% sustained (prevent timeout risk)
- CPU bucket >2000 (maintain burst capacity)
- Per-creep CPU <1.5 average
- Kernel overhead <5 CPU per tick

**Related Documentation**:

- [CPU Timeout Diagnostic Runbook](../../operations/cpu-timeout-diagnosis.md) - Diagnosis and emergency response
- [Performance Optimization Guide](../../operations/performance-optimization.md) - General optimization strategies
- [Performance Monitoring](./performance-monitoring.md) - CPU tracking implementation
- [Memory Management](./memory-management.md) - Memory optimization techniques

---

## Table of Contents

1. [Kernel CPU Budget Allocation](#kernel-cpu-budget-allocation)
2. [Incremental CPU Protection Patterns](#incremental-cpu-protection-patterns)
3. [Memory Operation Optimization](#memory-operation-optimization)
4. [Creep Behavior Efficiency](#creep-behavior-efficiency)
5. [Advanced Optimization Techniques](#advanced-optimization-techniques)

---

## Kernel CPU Budget Allocation

### Understanding Kernel Operations

The Kernel (`src/runtime/bootstrap/kernel.ts`) orchestrates all bot operations each tick:

```typescript
// Kernel tick execution flow
1. Bootstrap & initialization (0.5-1.0 CPU)
2. Memory migrations & self-healing (0.5-1.5 CPU)
3. Behavior execution (variable, most CPU)
4. Stats collection (0.5-1.0 CPU)
5. System evaluation (0.5-1.0 CPU)
6. Performance tracking (0.3-0.5 CPU)
```

**Total Kernel overhead**: 2.3-5.0 CPU per tick (excluding behavior execution)

### Budget Allocation Strategy

#### Subsystem Budgets

Define CPU budgets for each kernel subsystem:

```typescript
// src/runtime/bootstrap/kernel.ts
const KERNEL_BUDGETS = {
  bootstrap: 1.0, // Initialization
  memoryMigration: 1.5, // Memory migrations
  memorySelfHealing: 1.0, // Corruption repair
  behaviorExecution: 0, // Dynamic (most CPU)
  statsCollection: 1.0, // Stats gathering
  systemEvaluation: 1.0, // Health reports
  performanceTracking: 0.5, // Metrics
  emergency: 2.0 // Emergency reserve
};
```

#### Dynamic Budget Calculation

Allocate behavior execution budget based on available CPU:

```typescript
function calculateBehaviorBudget(cpuLimit: number): number {
  // Fixed overhead
  const fixedOverhead = Object.entries(KERNEL_BUDGETS)
    .filter(([key]) => key !== "behaviorExecution" && key !== "emergency")
    .reduce((sum, [, budget]) => sum + budget, 0);

  // Emergency reserve
  const emergency = KERNEL_BUDGETS.emergency;

  // Available for behaviors
  const available = cpuLimit - fixedOverhead - emergency;

  // Apply safety margin (80%)
  const safetyMargin = Memory.config?.cpuSafetyMargin || 0.8;

  return available * safetyMargin;
}

// Usage in Kernel
const behaviorBudget = calculateBehaviorBudget(Game.cpu.limit);
console.log(`Behavior budget: ${behaviorBudget.toFixed(2)} CPU`);
```

#### Budget Enforcement

Track and enforce budgets per subsystem:

```typescript
class KernelBudgetTracker {
  private budgets: Record<string, number>;
  private usage: Record<string, number> = {};

  constructor(budgets: Record<string, number>) {
    this.budgets = budgets;
  }

  startSubsystem(name: string): void {
    this.usage[name] = Game.cpu.getUsed();
  }

  endSubsystem(name: string): boolean {
    const cpuUsed = Game.cpu.getUsed() - this.usage[name];
    const budget = this.budgets[name];

    if (budget > 0 && cpuUsed > budget) {
      console.log(`⚠ ${name} exceeded budget: ${cpuUsed.toFixed(2)}/${budget}`);
      return false; // Over budget
    }

    return true; // Within budget
  }

  getReport(): Record<string, { used: number; budget: number; percent: number }> {
    const report: Record<string, any> = {};

    for (const name in this.usage) {
      const used = Game.cpu.getUsed() - this.usage[name];
      const budget = this.budgets[name];

      report[name] = {
        used: parseFloat(used.toFixed(2)),
        budget,
        percent: budget > 0 ? parseFloat(((used / budget) * 100).toFixed(1)) : 0
      };
    }

    return report;
  }
}

// Usage in Kernel loop
const budgetTracker = new KernelBudgetTracker(KERNEL_BUDGETS);

budgetTracker.startSubsystem("bootstrap");
runBootstrap();
budgetTracker.endSubsystem("bootstrap");

budgetTracker.startSubsystem("behaviorExecution");
runBehaviors(behaviorBudget);
budgetTracker.endSubsystem("behaviorExecution");

// Store report for monitoring
Memory.stats.budgets = budgetTracker.getReport();
```

### Priority-Based Execution

Execute subsystems in priority order with CPU checks:

```typescript
enum SubsystemPriority {
  CRITICAL = 0, // Must run (bootstrap, emergency)
  HIGH = 1, // Important (spawning, harvesters)
  MEDIUM = 2, // Normal (upgraders, builders)
  LOW = 3 // Optional (stats, evaluation)
}

interface Subsystem {
  name: string;
  priority: SubsystemPriority;
  budget: number;
  execute: () => void;
}

function executeSubsystems(subsystems: Subsystem[]): void {
  // Sort by priority
  const sorted = subsystems.sort((a, b) => a.priority - b.priority);

  for (const subsystem of sorted) {
    const cpuBefore = Game.cpu.getUsed();
    const cpuAvailable = Game.cpu.limit - cpuBefore;

    // Skip low priority if CPU constrained
    if (subsystem.priority === SubsystemPriority.LOW && cpuAvailable < subsystem.budget * 1.5) {
      console.log(`⚠ Skipping ${subsystem.name} due to CPU constraints`);
      continue;
    }

    // Execute with budget check
    subsystem.execute();

    const cpuUsed = Game.cpu.getUsed() - cpuBefore;
    if (cpuUsed > subsystem.budget) {
      console.log(`⚠ ${subsystem.name} exceeded budget: ${cpuUsed.toFixed(2)}/${subsystem.budget}`);
    }

    // Emergency abort if critical threshold reached
    if (Game.cpu.getUsed() > Game.cpu.limit * 0.9) {
      console.log("🚨 Emergency CPU abort!");
      break;
    }
  }
}
```

---

## Incremental CPU Protection Patterns

### Multi-Layer Protection System

**Reference**: Issue #364 - Incremental CPU guards implementation

Implement graduated CPU protection at multiple levels:

```
Layer 1: BehaviorController (80%) - Stop processing creeps
Layer 2: PerformanceTracker (70%/90%) - Warnings and alerts
Layer 3: Kernel (90%) - Emergency abort
Layer 4: Per-operation (check before expensive ops)
```

### Layer 1: BehaviorController Protection

**Location**: `src/runtime/behavior/BehaviorController.ts`

```typescript
export class BehaviorController {
  private cpuSafetyMargin = 0.8; // Stop at 80%

  public runCreepBehaviors(): void {
    const creeps = Object.values(Game.creeps);

    for (const creep of creeps) {
      // Check CPU before each creep
      const cpuPercent = Game.cpu.getUsed() / Game.cpu.limit;

      if (cpuPercent > this.cpuSafetyMargin) {
        console.log(`⚠ CPU safety margin reached (${(cpuPercent * 100).toFixed(1)}%), skipping remaining creeps`);
        break;
      }

      // Track per-creep CPU
      const cpuBefore = Game.cpu.getUsed();

      this.runCreepBehavior(creep);

      const cpuUsed = Game.cpu.getUsed() - cpuBefore;
      if (cpuUsed > 1.5) {
        console.log(`⚠ Creep ${creep.name} used excessive CPU: ${cpuUsed.toFixed(2)}`);
      }
    }
  }
}
```

### Layer 2: PerformanceTracker Monitoring

**Location**: `src/runtime/metrics/PerformanceTracker.ts`

```typescript
export class PerformanceTracker {
  private readonly WARNING_THRESHOLD = 0.7; // 70%
  private readonly CRITICAL_THRESHOLD = 0.9; // 90%

  public checkThresholds(): void {
    const cpuPercent = Game.cpu.getUsed() / Game.cpu.limit;
    const bucket = Game.cpu.bucket;

    // Multi-level warnings
    if (cpuPercent > this.CRITICAL_THRESHOLD) {
      console.log("🔴 CRITICAL CPU usage!", (cpuPercent * 100).toFixed(1) + "%");
      this.recordAlert("CRITICAL", cpuPercent, bucket);
    } else if (cpuPercent > this.WARNING_THRESHOLD) {
      console.log("⚠ High CPU usage:", (cpuPercent * 100).toFixed(1) + "%");
      this.recordAlert("WARNING", cpuPercent, bucket);
    }

    // Bucket warnings
    if (bucket < 500) {
      console.log("🔴 CPU bucket critically low!", bucket);
      this.recordAlert("CRITICAL_BUCKET", cpuPercent, bucket);
    } else if (bucket < 1000) {
      console.log("⚠ CPU bucket low:", bucket);
      this.recordAlert("WARNING_BUCKET", cpuPercent, bucket);
    }
  }

  private recordAlert(level: string, cpuPercent: number, bucket: number): void {
    Memory.stats = Memory.stats || {};
    Memory.stats.alerts = Memory.stats.alerts || [];

    Memory.stats.alerts.push({
      tick: Game.time,
      level,
      cpuPercent: parseFloat((cpuPercent * 100).toFixed(1)),
      bucket
    });

    // Keep only last 100 alerts
    if (Memory.stats.alerts.length > 100) {
      Memory.stats.alerts = Memory.stats.alerts.slice(-100);
    }
  }
}
```

### Layer 3: Kernel Emergency Abort

**Location**: `src/runtime/bootstrap/kernel.ts`

```typescript
export class Kernel {
  private readonly EMERGENCY_THRESHOLD = 0.9; // 90%

  public loop(): void {
    try {
      // Bootstrap
      this.runBootstrap();

      // Check CPU before behaviors
      if (this.shouldAbort()) {
        console.log("🚨 Emergency CPU abort before behaviors!");
        return;
      }

      // Behaviors (most CPU intensive)
      this.runBehaviors();

      // Check CPU before stats/evaluation
      if (this.shouldAbort()) {
        console.log("🚨 Emergency CPU abort before stats!");
        return;
      }

      // Stats and evaluation (always run if possible)
      this.runStats();
      this.runEvaluation();
    } catch (error) {
      console.log("❌ Kernel error:", error);
      this.handleError(error);
    }
  }

  private shouldAbort(): boolean {
    const cpuPercent = Game.cpu.getUsed() / Game.cpu.limit;
    return cpuPercent > this.EMERGENCY_THRESHOLD;
  }
}
```

### Layer 4: Per-Operation Guards

**Pattern**: Check CPU before expensive operations

```typescript
// Pathfinding guard
function moveCreepSafely(creep: Creep, target: RoomPosition): void {
  // Check CPU before pathfinding
  if (Game.cpu.getUsed() > Game.cpu.limit * 0.85) {
    console.log(`⚠ Skipping pathfinding for ${creep.name} due to CPU`);
    return;
  }

  creep.moveTo(target, {
    reusePath: 50,
    maxRooms: 1
  });
}

// Room analysis guard
function analyzeRoom(room: Room): void {
  const cpuBefore = Game.cpu.getUsed();
  const cpuAvailable = Game.cpu.limit - cpuBefore;

  // Skip if insufficient CPU
  if (cpuAvailable < 3) {
    console.log(`⚠ Skipping room analysis for ${room.name} due to CPU`);
    return;
  }

  // Perform analysis
  const sources = room.find(FIND_SOURCES);
  const structures = room.find(FIND_STRUCTURES);
  // ... analysis logic

  const cpuUsed = Game.cpu.getUsed() - cpuBefore;
  console.log(`Room ${room.name} analysis: ${cpuUsed.toFixed(2)} CPU`);
}

// Task execution guard
function executeTask(task: Task): boolean {
  const cpuBefore = Game.cpu.getUsed();

  // Abort if approaching limit
  if (cpuBefore > Game.cpu.limit * 0.85) {
    console.log(`⚠ Deferring task ${task.type} due to CPU`);
    return false; // Defer to next tick
  }

  // Execute task
  const result = task.execute();

  // Track CPU usage
  const cpuUsed = Game.cpu.getUsed() - cpuBefore;
  task.cpuHistory = task.cpuHistory || [];
  task.cpuHistory.push(cpuUsed);

  if (cpuUsed > 2.0) {
    console.log(`⚠ Expensive task ${task.type}: ${cpuUsed.toFixed(2)} CPU`);
  }

  return result;
}
```

---

## Memory Operation Optimization

### Minimize Memory Access

Memory operations (read/write) have CPU cost due to serialization:

```typescript
// ❌ Bad: Multiple Memory accesses
function processCreeps(): void {
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];

    if (Memory.creeps[name].role === "harvester") {
      // Access 1
      Memory.creeps[name].working = true; // Access 2
      Memory.creeps[name].target = findTarget(); // Access 3
    }
  }
}

// ✅ Good: Cache Memory reference
function processCreeps(): void {
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    const memory = Memory.creeps[name]; // Single reference

    if (memory.role === "harvester") {
      memory.working = true;
      memory.target = findTarget();
    }
  }
}
```

### Lazy Memory Initialization

Initialize memory structures only when needed:

```typescript
// ❌ Bad: Initialize everything upfront
Memory.rooms = Memory.rooms || {};
Memory.creeps = Memory.creeps || {};
Memory.spawns = Memory.spawns || {};
Memory.stats = Memory.stats || {};
// ... many more

// ✅ Good: Initialize on-demand
function getMemorySection<T>(section: string, defaultValue: T): T {
  if (!(section in Memory)) {
    (Memory as any)[section] = defaultValue;
  }
  return (Memory as any)[section];
}

// Usage
const stats = getMemorySection("stats", {});
const roomData = getMemorySection(`rooms.${roomName}`, {});
```

### Memory Cleanup

Regularly clean stale data to reduce memory size:

```typescript
// Cleanup dead creeps
function cleanupDeadCreeps(): void {
  for (const name in Memory.creeps) {
    if (!Game.creeps[name]) {
      delete Memory.creeps[name];
    }
  }
}

// Cleanup old cache
function cleanupCache(): void {
  if (!Memory.cache) return;

  const currentTick = Game.time;
  const maxAge = 100; // ticks

  if (Memory.cache.time && currentTick > Memory.cache.time + maxAge) {
    console.log("🧹 Cleaning stale cache");
    delete Memory.cache;
  }
}

// Cleanup old history
function cleanupHistory(): void {
  const maxHistoryLength = 100;

  if (Memory.stats?.cpu?.history && Memory.stats.cpu.history.length > maxHistoryLength) {
    Memory.stats.cpu.history = Memory.stats.cpu.history.slice(-maxHistoryLength);
  }
}

// Run all cleanup operations
function runMemoryCleanup(): void {
  const cpuBefore = Game.cpu.getUsed();

  cleanupDeadCreeps();
  cleanupCache();
  cleanupHistory();

  const cpuUsed = Game.cpu.getUsed() - cpuBefore;
  console.log(`Memory cleanup: ${cpuUsed.toFixed(2)} CPU`);
}
```

### Efficient Data Structures

Use compact data structures to reduce memory size:

```typescript
// ❌ Bad: Full objects in Memory
Memory.creeps[name].targetPos = {
  x: 25,
  y: 25,
  roomName: "W1N1"
};

// ✅ Good: Compact string format
Memory.creeps[name].targetPos = "25,25,W1N1";

// Helper functions
function packPosition(pos: RoomPosition): string {
  return `${pos.x},${pos.y},${pos.roomName}`;
}

function unpackPosition(packed: string): RoomPosition {
  const [x, y, roomName] = packed.split(",");
  return new RoomPosition(parseInt(x), parseInt(y), roomName);
}

// ❌ Bad: Store full path
Memory.creeps[name].path = [
  { x: 10, y: 10, roomName: "W1N1" },
  { x: 11, y: 10, roomName: "W1N1" }
  // ... many positions
];

// ✅ Good: Store path as serialized Room.serializePath result
Memory.creeps[name].path = Room.serializePath(path); // Compact string
// Use Room.deserializePath(path) to restore
```

---

## Creep Behavior Efficiency

### Pathfinding Optimization

Pathfinding is one of the most CPU-intensive operations:

```typescript
// Default optimization settings
const PATHFINDING_DEFAULTS = {
  reusePath: 30, // Cache paths for 30 ticks (up from 5)
  maxRooms: 1, // Single room pathfinding (unless needed)
  ignoreCreeps: false // Avoid creeps (set true for static targets)
};

// Apply to all movement
Creep.prototype.moveTo = function (target: RoomPosition | { pos: RoomPosition }, opts?: MoveToOpts): number {
  const options = {
    ...PATHFINDING_DEFAULTS,
    ...opts,
    visualizePathStyle: Memory.experimentalFeatures?.roomVisuals ? {} : undefined
  };

  return this.moveTo(target, options);
};
```

#### Pathfinding Serialization

Prevent multiple creeps from pathfinding simultaneously:

```typescript
class PathfindingQueue {
  private static queue: Array<{ creep: Creep; target: RoomPosition }> = [];
  private static maxPerTick = 5;
  private static processed = 0;

  static addRequest(creep: Creep, target: RoomPosition): void {
    this.queue.push({ creep, target });
  }

  static processQueue(): void {
    this.processed = 0;

    while (this.queue.length > 0 && this.processed < this.maxPerTick) {
      const request = this.queue.shift()!;

      // Check CPU before pathfinding
      if (Game.cpu.getUsed() > Game.cpu.limit * 0.85) {
        console.log("⚠ Deferring remaining pathfinding requests");
        break;
      }

      request.creep.moveTo(request.target, {
        reusePath: 50,
        maxRooms: 1
      });

      this.processed++;
    }

    console.log(`Pathfinding: ${this.processed} requests processed, ${this.queue.length} deferred`);
  }

  static reset(): void {
    this.queue = [];
    this.processed = 0;
  }
}

// Usage in kernel
PathfindingQueue.reset();
// ... during creep processing, queue pathfinding requests
PathfindingQueue.addRequest(creep, target);
// ... after all creeps processed
PathfindingQueue.processQueue();
```

### Role-Specific Optimizations

#### Harvester Optimization

```typescript
class Harvester {
  run(creep: Creep): void {
    const memory = creep.memory;

    // State machine: harvest or transfer
    if (!memory.working && creep.store.getFreeCapacity() === 0) {
      memory.working = true;
      delete memory.sourceId; // Clear cached source
    }
    if (memory.working && creep.store.getUsedCapacity() === 0) {
      memory.working = false;
      delete memory.targetId; // Clear cached target
    }

    if (memory.working) {
      this.transferEnergy(creep, memory);
    } else {
      this.harvestEnergy(creep, memory);
    }
  }

  private harvestEnergy(creep: Creep, memory: CreepMemory): void {
    // Cache source ID to avoid find() every tick
    if (!memory.sourceId) {
      const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
      if (!source) return;
      memory.sourceId = source.id;
    }

    const source = Game.getObjectById(memory.sourceId as Id<Source>);
    if (!source) {
      delete memory.sourceId; // Source exhausted
      return;
    }

    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
      // Only path if not already moving
      if (!creep.memory.path || creep.memory.path.length === 0) {
        creep.moveTo(source, { reusePath: 50 });
      }
    }
  }

  private transferEnergy(creep: Creep, memory: CreepMemory): void {
    // Cache transfer target to avoid find() every tick
    if (!memory.targetId) {
      const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: s =>
          (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      });
      if (!target) return;
      memory.targetId = target.id;
    }

    const target = Game.getObjectById(memory.targetId as Id<AnyStructure>);
    if (!target || (target as any).store?.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      delete memory.targetId; // Target full or gone
      return;
    }

    if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      if (!creep.memory.path || creep.memory.path.length === 0) {
        creep.moveTo(target, { reusePath: 50 });
      }
    }
  }
}
```

#### Upgrader Optimization

```typescript
class Upgrader {
  run(creep: Creep): void {
    const memory = creep.memory;
    const room = creep.room;

    // State machine
    if (!memory.working && creep.store.getFreeCapacity() === 0) {
      memory.working = true;
    }
    if (memory.working && creep.store.getUsedCapacity() === 0) {
      memory.working = false;
    }

    if (memory.working) {
      // Upgrade controller (no pathfinding needed if in range)
      if (creep.upgradeController(room.controller!) === ERR_NOT_IN_RANGE) {
        // Cache upgrade position (static target)
        if (!memory.upgradePos) {
          memory.upgradePos = packPosition(room.controller!.pos);
        }

        const upgradePos = unpackPosition(memory.upgradePos);
        creep.moveTo(upgradePos, {
          reusePath: 50,
          ignoreCreeps: true, // Static target, can ignore creeps
          range: 3 // Upgrade range
        });
      }
    } else {
      // Withdraw from storage/container
      this.withdrawEnergy(creep, memory);
    }
  }

  private withdrawEnergy(creep: Creep, memory: CreepMemory): void {
    // Prefer link/storage, fallback to container/source
    if (!memory.sourceId) {
      const link = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_LINK && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
      });

      if (link) {
        memory.sourceId = link.id;
      } else {
        const storage = creep.room.storage;
        if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
          memory.sourceId = storage.id;
        }
      }
    }

    const source = Game.getObjectById(memory.sourceId as Id<AnyStructure>);
    if (!source || (source as any).store?.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      delete memory.sourceId;
      return;
    }

    if (creep.withdraw(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(source, { reusePath: 50 });
    }
  }
}
```

### Task Batching

Process multiple similar tasks together:

```typescript
// ❌ Bad: Process creeps individually
for (const name in Game.creeps) {
  const creep = Game.creeps[name];
  runCreepBehavior(creep);
}

// ✅ Good: Batch by role
const creepsByRole = _.groupBy(Game.creeps, c => c.memory.role);

for (const role in creepsByRole) {
  const creeps = creepsByRole[role];

  // Shared calculations for role
  const roleData = calculateRoleData(role);

  for (const creep of creeps) {
    // Check CPU
    if (Game.cpu.getUsed() > Game.cpu.limit * 0.8) break;

    // Use shared data
    runCreepBehavior(creep, roleData);
  }
}
```

---

## Advanced Optimization Techniques

### Caching Strategy

Implement multi-level caching:

```typescript
class CacheManager {
  private static perTick: Map<string, any> = new Map();
  private static persistent: Record<string, any> = {};

  // Per-tick cache (cleared each tick)
  static getPerTick<T>(key: string, factory: () => T): T {
    if (!this.perTick.has(key)) {
      this.perTick.set(key, factory());
    }
    return this.perTick.get(key)!;
  }

  // Persistent cache (in Memory)
  static getPersistent<T>(key: string, factory: () => T, ttl = 10): T {
    const cache = (Memory.cache = Memory.cache || {});
    const entry = cache[key];

    if (entry && Game.time < entry.expires) {
      return entry.value;
    }

    const value = factory();
    cache[key] = {
      value,
      expires: Game.time + ttl
    };

    return value;
  }

  // Reset per-tick cache
  static reset(): void {
    this.perTick.clear();
  }
}

// Usage
const sources = CacheManager.getPerTick("room.W1N1.sources", () => Game.rooms.W1N1.find(FIND_SOURCES));

const roomPlans = CacheManager.getPersistent(
  "room.W1N1.plan",
  () => calculateRoomPlan(Game.rooms.W1N1),
  100 // Cache for 100 ticks
);
```

### Profiling Integration

Use profiler to identify hot spots:

```typescript
// Enable profiler when CPU usage high
if (Memory.stats?.cpu?.average > Game.cpu.limit * 0.8) {
  Memory.experimentalFeatures = Memory.experimentalFeatures || {};
  Memory.experimentalFeatures.profiler = true;
}

// Review profiler data
if (Memory.profiler) {
  const hotSpots = Object.entries(Memory.profiler)
    .filter(([, data]: [string, any]) => data.totalCpu > 5)
    .sort((a, b) => b[1].totalCpu - a[1].totalCpu);

  console.log("🔥 CPU Hot Spots:");
  for (const [func, data] of hotSpots.slice(0, 5)) {
    console.log(`  ${func}: ${data.totalCpu.toFixed(2)} CPU (${data.calls} calls)`);
  }
}
```

### Adaptive Behavior

Dynamically adjust behavior based on CPU:

```typescript
class AdaptiveBehaviorController {
  private performanceMode: "full" | "optimized" | "minimal" = "full";

  updatePerformanceMode(): void {
    const cpuPercent = Game.cpu.getUsed() / Game.cpu.limit;
    const bucket = Game.cpu.bucket;

    if (bucket < 1000 || cpuPercent > 0.95) {
      this.performanceMode = "minimal";
    } else if (bucket < 2000 || cpuPercent > 0.85) {
      this.performanceMode = "optimized";
    } else {
      this.performanceMode = "full";
    }
  }

  runCreeps(): void {
    const creeps = Object.values(Game.creeps);

    switch (this.performanceMode) {
      case "minimal":
        // Only critical roles
        this.runCriticalCreeps(creeps.filter(c => c.memory.role === "harvester" || c.memory.role === "upgrader"));
        break;

      case "optimized":
        // All roles but with optimizations
        this.runOptimizedCreeps(creeps);
        break;

      case "full":
        // All features enabled
        this.runFullCreeps(creeps);
        break;
    }
  }
}
```

---

## Appendix

### Quick Reference

#### CPU Budget Guidelines

- Kernel overhead: <5 CPU
- Per-creep average: <1.5 CPU
- Pathfinding: <3 CPU per request
- Room analysis: <3 CPU per room
- Stats collection: <1 CPU

#### Safety Thresholds

- BehaviorController: 80%
- Warning: 70%
- Critical: 90%
- Emergency abort: 90%

#### Optimization Priorities

1. Pathfinding optimization (highest CPU impact)
2. Memory access reduction
3. Creep behavior efficiency
4. Caching strategies
5. Task batching

### Related Issues

**Systematic CPU Solutions**:

- #364 - Incremental CPU guards implementation
- #392 - Proactive CPU monitoring system
- #299 - Proactive CPU monitoring system

**Performance Optimization**:

- #117 - CPU usage optimization below 90% threshold
- #304 - Performance optimization guide

---

_Last updated: 2025-11-08_
_Maintainer: Autonomous Copilot Workflows_
