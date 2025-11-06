# Spawn Management

The SpawnManager handles spawn queue prioritization and dynamic body part generation based on available energy.

## Overview

The spawn system uses a priority queue to manage creep spawning requests and dynamically scales creep bodies based on room energy capacity. This ensures efficient resource utilization and handles cold boot scenarios gracefully.

## Architecture

### Components

- **SpawnManager** (`src/runtime/planning/SpawnManager.ts`) - Manages spawn queue and body generation
- **SpawnRequest** - Queued spawn request with priority and body configuration
- **BodyPartConfig** - Configuration for dynamic body part scaling

### Key Features

1. **Priority Queue** - Spawn requests are processed by priority (highest first)
2. **Dynamic Scaling** - Body parts scale automatically with available energy
3. **Cold Boot Support** - Handles rooms with minimal or zero energy
4. **Multi-Spawn Support** - Coordinates multiple spawns in the same room

## Spawn Queue System

### Adding Requests

```typescript
const spawnManager = new SpawnManager();

const bodyConfig: BodyPartConfig = {
  base: [WORK, CARRY, MOVE],
  pattern: [WORK, CARRY, MOVE],
  maxRepeats: 5
};

const requestId = spawnManager.addRequest(
  "harvester", // role name
  bodyConfig, // body configuration
  { role: "harvester" }, // creep memory
  75, // priority (0-100)
  Game.time + 100 // optional deadline
);
```

### Priority Levels

Use these guidelines for spawn priorities:

- **100 (CRITICAL)** - Essential creeps needed immediately (emergency harvester)
- **75 (HIGH)** - Important roles with time pressure (haulers, builders)
- **50 (NORMAL)** - Standard roles (upgraders, miners)
- **25 (LOW)** - Optional roles (scouts, remote miners)
- **0 (IDLE)** - Background roles (can wait indefinitely)

### Processing Queue

```typescript
const spawns = room.find(FIND_MY_SPAWNS);
const spawned = spawnManager.processQueue(spawns, memory.creepCounter);
memory.creepCounter += spawned.length;
```

## Dynamic Body Generation

### Body Part Configuration

#### Base Parts Only

For fixed-size creeps:

```typescript
const bodyConfig: BodyPartConfig = {
  base: [WORK, CARRY, MOVE]
};
```

This creates a creep with exactly those parts (cost: 200 energy).

#### Scalable Bodies

For creeps that scale with energy:

```typescript
const bodyConfig: BodyPartConfig = {
  base: [MOVE], // Always included
  pattern: [WORK, CARRY, MOVE], // Repeatable unit
  maxRepeats: 10 // Maximum repeats
};
```

With 550 energy available:

- Base cost: 50 (1 MOVE)
- Pattern cost: 200 (WORK + CARRY + MOVE)
- Affordable repeats: floor((550 - 50) / 200) = 2
- Final body: [MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE] (7 parts, 450 energy)

### Body Part Costs

| Part          | Cost |
| ------------- | ---- |
| MOVE          | 50   |
| WORK          | 100  |
| CARRY         | 50   |
| ATTACK        | 80   |
| RANGED_ATTACK | 150  |
| HEAL          | 250  |
| TOUGH         | 10   |
| CLAIM         | 600  |

### Constraints

- Maximum 50 body parts per creep (MAX_CREEP_SIZE)
- Body parts automatically trimmed if over limit
- Returns empty array if insufficient energy for base parts

## Cold Boot Scenarios

### Empty Room Recovery

When a room loses all creeps:

1. SpawnManager waits for energy to accumulate
2. Once minimum energy is available (200 for basic harvester), spawns first creep
3. Prioritizes harvesters to restart energy collection
4. Gradually scales up to normal operation

Example:

```typescript
// Room with 0 energy - request queued but not spawned
spawnManager.addRequest("harvester", basicHarvesterConfig, memory, 100);
let spawned = spawnManager.processQueue(spawns, 0);
// spawned.length === 0 (waiting for energy)

// After energy accumulates to 200
spawned = spawnManager.processQueue(spawns, 0);
// spawned.length === 1 (emergency harvester spawned)
```

### Progressive Scaling

As energy capacity increases with RCL:

| RCL | Energy Capacity | Harvester Body                                                  | Parts | Cost |
| --- | --------------- | --------------------------------------------------------------- | ----- | ---- |
| 1   | 300             | [WORK, CARRY, MOVE]                                             | 3     | 200  |
| 2   | 550             | [MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE]                    | 7     | 450  |
| 3   | 800             | [MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE] | 10    | 700  |

## Queue Management

### Statistics

```typescript
const stats = spawnManager.getQueueStats();
console.log(`Queue size: ${stats.size}`);
console.log(`By priority:`, stats.byPriority);
```

### Maintenance

```typescript
// Clear expired requests
spawnManager.clearExpired();

// Check for pending request
if (spawnManager.hasPendingRequest("harvester")) {
  console.log("Harvester spawn already queued");
}

// Clear all requests (emergency reset)
spawnManager.clear();
```

## Integration with BehaviorController

The SpawnManager integrates with the existing BehaviorController:

```typescript
import { SpawnManager } from "@runtime/planning";

const spawnManager = new SpawnManager();

// In the main loop:
function ensureMinimumPopulation(room: Room, memory: Memory): void {
  const roles = countCreepsByRole(room);

  for (const [role, config] of Object.entries(roleConfigs)) {
    if (roles[role] < config.minimum && !spawnManager.hasPendingRequest(role)) {
      spawnManager.addRequest(role, config.bodyConfig, config.memory(), config.priority);
    }
  }

  const spawns = room.find(FIND_MY_SPAWNS);
  const spawned = spawnManager.processQueue(spawns, memory.creepCounter);
  memory.creepCounter += spawned.length;
}
```

## Testing

Spawn behavior is validated by regression tests in `tests/regression/spawn-recovery.test.ts`:

- Queue management and prioritization
- Dynamic body generation at various energy levels
- Cold boot recovery scenarios
- Multi-spawn coordination
- Edge cases (empty room, low energy, MAX_CREEP_SIZE)

## Performance Considerations

- Queue operations are O(n log n) due to priority sorting
- Body generation is O(1) per request
- Recommended max queue size: 50 requests
- Process queue once per tick, not per spawn

## Future Enhancements

- [ ] Body template library for common roles
- [ ] Automatic priority adjustment based on need
- [ ] Spawn time estimation and scheduling
- [ ] Cross-room spawn coordination
- [ ] Energy reservation for high-priority spawns
