# @ralphschuler/screeps-async

Generator-based async patterns for multi-tick operations in Screeps runtime.

## Features

- ✅ Generator-based (`function*` with `yield`)
- ✅ Priority scheduling
- ✅ CPU budget control
- ✅ Manual execution control
- ✅ Memory persistence
- ✅ TypeScript strict mode
- ✅ 12+ helper utilities

## Installation

```bash
npm install @ralphschuler/screeps-async
```

## Quick Start

```typescript
import { TaskRunner } from "@ralphschuler/screeps-async";

const taskRunner = new TaskRunner(Memory);

// Create multi-tick task
taskRunner.createTask("harvest", function* () {
  const creep = Game.creeps["Harvester1"];
  const source = creep.pos.findClosestByPath(FIND_SOURCES);

  while (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
    creep.harvest(source!);
    yield; // Pause until next tick
  }

  return creep.store.energy;
});

// In game loop
export function loop() {
  taskRunner.runNext(); // Execute one task
  // or
  taskRunner.runUntilCpuLimit(5); // Execute until CPU budget

  taskRunner.endTick(); // Cleanup and save
}
```

## API

### TaskRunner

**Create tasks:**

```typescript
taskRunner.createTask(id, generatorFn, options);
```

**Execute tasks:**

```typescript
taskRunner.runNext(); // Execute next task
taskRunner.runTask(id); // Execute specific task
taskRunner.runUntilCpuLimit(cpu); // Execute until CPU limit
```

**Manage tasks:**

```typescript
taskRunner.getTask(id);
taskRunner.hasTask(id);
taskRunner.cancelTask(id);
taskRunner.clear();
taskRunner.getStats();
```

### Task Options

```typescript
{
  priority: 10,           // Higher = earlier execution
  maxTicks: 100,          // Auto-cancel after N ticks
  cpuBudget: 2,           // Pause if exceeds CPU
  cleanupAfterTicks: 20   // Remove N ticks after completion
}
```

### Helper Functions

```typescript
import { waitTicks, retry, timeout } from "@ralphschuler/screeps-async";

// Wait N ticks
yield * waitTicks(5);

// Retry on failure
yield * retry(riskyOperation, 3, 2);

// Timeout
yield * timeout(longOperation, 100);

// More: waitUntil, sequence, repeat, whilst, interval, map, filter, race, all
```

## Examples

### Harvester with Priority

```typescript
taskRunner.createTask(
  "harvest-priority",
  function* () {
    const creep = Game.creeps["Harvester1"];
    const source = Game.getObjectById("source-id" as Id<Source>);

    while (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      if (creep.harvest(source!) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source!);
      }
      yield;
    }
  },
  { priority: 50 }
);
```

### Builder with Timeout

```typescript
import { timeout } from "@ralphschuler/screeps-async";

taskRunner.createTask("build", function* () {
  const creep = Game.creeps["Builder1"];
  const site = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);

  yield* timeout(function* () {
    while (site && site.progress < site.progressTotal) {
      if (creep.build(site) === ERR_NOT_IN_RANGE) {
        creep.moveTo(site);
      }
      yield;
    }
  }, 100);
});
```

### CPU-Aware Execution

```typescript
export function loop() {
  const cpuAvailable = Game.cpu.limit - Game.cpu.getUsed();
  const cpuBudget = Math.min(cpuAvailable * 0.5, 5);

  taskRunner.runUntilCpuLimit(cpuBudget);
  taskRunner.endTick();
}
```

## License

MIT © OpenAI Automations
