# Starter Bot Guide

This guide explains the basic Screeps bot implementation included in this repository. The starter bot provides a minimal viable product (MVP) that demonstrates essential Screeps automation patterns and serves as a foundation for more advanced features.

## Overview

The starter bot is implemented in `src/runtime/behavior/BehaviorController.ts` and provides:

- **Auto-spawning system** - Automatically maintains minimum creep counts
- **Auto-harvesting behavior** - Creeps collect energy from sources
- **Auto-upgrading functionality** - Creeps upgrade the room controller
- **Error handling** - Graceful handling of edge cases

## Architecture

### Core Components

1. **BehaviorController** - The main orchestrator that coordinates all bot activities
2. **Role Definitions** - Configuration for each creep role (body, minimum count, behavior)
3. **Role Behaviors** - The actual logic that executes each tick for each creep

### Execution Flow

Every game tick, the BehaviorController:

1. **Ensures minimum creep counts** - Spawns missing creeps as needed
2. **Executes creep behaviors** - Runs the appropriate behavior function for each active creep
3. **Reports metrics** - Returns a summary of actions taken for performance tracking

```typescript
// Example execution in the main loop
const summary = behaviorController.execute(game, memory, roleCounts);
// Returns: { processedCreeps: 3, spawnedCreeps: ['harvester-123'], tasksExecuted: { harvest: 2, upgrade: 1 } }
```

## Creep Roles

### Harvester Role

**Purpose**: The foundation of the colony's economy, responsible for energy collection and distribution.

**Body Composition**: `[WORK, CARRY, MOVE]`

**Minimum Count**: 2 creeps

**Behavior Priority**:
1. **Harvest Phase** (when not full)
   - Finds the closest active energy source
   - Moves to and harvests from the source
   
2. **Supply Phase** (when full)
   - Locates spawns or extensions that need energy
   - Transfers energy to keep spawning capability active
   
3. **Upgrade Phase** (when full but nothing needs energy)
   - Uses excess energy to upgrade the room controller
   - Prevents energy waste and contributes to progression

**Task Identifiers**: `harvest`, `supply`, `upgrade`, `idle`

### Upgrader Role

**Purpose**: Dedicated to improving the room controller level, which unlocks new structures and capabilities.

**Body Composition**: `[WORK, CARRY, MOVE]`

**Minimum Count**: 1 creep

**Behavior Priority**:
1. **Recharge Phase** (when empty)
   - Withdraws energy from spawns or extensions with surplus (>50 energy)
   - Ensures spawning operations aren't disrupted
   
2. **Upgrade Phase** (when carrying energy)
   - Moves to the room controller
   - Continuously upgrades to increase controller level

**Task Identifiers**: `recharge`, `upgrade`, `idle`

## Auto-Spawning System

The auto-spawning system maintains minimum creep counts for each role:

```typescript
const ROLE_DEFINITIONS = {
  harvester: {
    minimum: 2,  // Always maintain at least 2 harvesters
    body: [WORK, CARRY, MOVE],
    // ...
  },
  upgrader: {
    minimum: 1,  // Always maintain at least 1 upgrader
    body: [WORK, CARRY, MOVE],
    // ...
  }
};
```

### Spawning Logic

1. **Check role counts** - Compare current counts against minimums
2. **Find available spawn** - Locate a spawn that's not currently busy
3. **Spawn creep** - Create new creep with appropriate body and memory
4. **Handle failures** - Log warnings for spawn failures (e.g., insufficient energy)

The system will attempt to spawn missing creeps each tick until minimums are satisfied.

## Error Handling

The starter bot includes several error handling mechanisms:

### Unknown Roles
If a creep has an unrecognized role, the controller logs a warning and skips that creep:

```typescript
if (!handler) {
  this.logger.warn?.(`Unknown role '${role}' for creep ${creep.name}`);
  continue;
}
```

### No Available Spawns
When all spawns are busy or missing, the controller logs a warning and continues:

```typescript
if (!spawn) {
  this.logger.warn?.(`No available spawns to satisfy minimum role ${role}`);
  continue;
}
```

### Spawn Failures
When spawn attempts fail (e.g., insufficient energy), the failure is logged:

```typescript
if (result === OK) {
  spawned.push(name);
} else {
  this.logger.warn?.(`Failed to spawn ${role}: ${result}`);
}
```

## Extending the Starter Bot

The starter bot is designed to be easily extended. Here are common modifications:

### Adding a New Role

1. **Define the role** in `ROLE_DEFINITIONS`:

```typescript
builder: {
  minimum: 1,
  body: [WORK, CARRY, MOVE],
  memory: () => ({ role: "builder", task: "build", version: 1 }),
  run: (creep: CreepLike) => runBuilder(creep)
}
```

2. **Implement the behavior function**:

```typescript
function runBuilder(creep: CreepLike): string {
  // Your builder logic here
  return "build";
}
```

3. **Add unit tests** in `tests/unit/behaviorController.test.ts`

### Adjusting Minimum Counts

Simply modify the `minimum` property in the role definition:

```typescript
harvester: {
  minimum: 4,  // Increase from 2 to 4 harvesters
  // ...
}
```

### Customizing Body Parts

Modify the `body` array to change creep composition:

```typescript
harvester: {
  body: [WORK, WORK, CARRY, MOVE],  // More work parts for faster harvesting
  // ...
}
```

### Adding State to Creep Memory

Update the `memory` factory function:

```typescript
memory: () => ({ 
  role: "harvester", 
  task: "harvest", 
  version: 1,
  targetSource: null,  // Add custom state
  lastHarvest: 0
})
```

## Testing

The starter bot includes comprehensive unit tests in `tests/unit/behaviorController.test.ts`. The tests cover:

- Auto-spawning system (6 tests)
- Harvester behavior (4 tests)
- Upgrader behavior (3 tests)
- Error handling (1 test)
- Summary reporting (3 tests)

Run tests with:

```bash
npm run test:unit
```

## Performance Considerations

The starter bot prioritizes simplicity and clarity over optimization, but includes several efficiency features:

1. **Path caching** - Uses `findClosestByPath` to optimize movement
2. **Energy thresholds** - Upgraders only withdraw when spawns have surplus
3. **Task prioritization** - Harvesters prioritize spawning infrastructure over upgrading
4. **Idle prevention** - All roles have fallback behaviors to prevent idle time

## Troubleshooting

### Creeps Not Spawning

**Symptoms**: Role counts remain below minimum, warnings about no available spawns

**Causes**:
- Insufficient energy in spawn
- All spawns are busy
- Spawn is missing/destroyed

**Solutions**:
- Wait for harvesters to collect more energy
- Increase harvester count to speed up energy collection
- Check for respawn scenarios (see `docs/operations/respawn-handling.md`)

### Creeps Idle

**Symptoms**: Creeps not performing expected tasks

**Causes**:
- No sources available in room
- No controller in room
- Path finding failures

**Solutions**:
- Verify room has active sources
- Check controller ownership
- Review game logs for path finding errors

### Energy Shortages

**Symptoms**: Spawns frequently empty, slow progression

**Causes**:
- Too few harvesters
- Harvesters spending too much time upgrading
- High spawn demand

**Solutions**:
- Increase harvester minimum count
- Add more WORK parts to harvester body
- Reduce upgrader count temporarily

## Next Steps

Once comfortable with the starter bot, consider:

1. **Adding more roles** - Builders, repairers, defenders
2. **Room planning** - Strategic structure placement
3. **Multi-room operations** - Expanding to multiple rooms
4. **Resource optimization** - Advanced energy management
5. **Defense systems** - Towers and military creeps
6. **Remote harvesting** - Mining from neighboring rooms

See the main [README.md](../README.md) and [DOCS.md](../DOCS.md) for more advanced topics and development guidance.
