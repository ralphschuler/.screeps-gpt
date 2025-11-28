# Pathfinding System

The runtime uses the [screeps-pathfinding](https://github.com/NesCafe62/screeps-pathfinding) library for advanced pathfinding with traffic management capabilities.

## Key Features

### Traffic Management
The pathfinding system enables intelligent traffic coordination:

- **Priority-based movement**: Higher priority creeps move first and can push lower priority creeps aside
- **Creep swapping**: Two creeps can swap positions instead of getting stuck
- **Move off road**: Creeps can step off roads when finished working to avoid blocking traffic
- **Spot reservation**: Reserve positions to prevent creep queueing at chokepoints

### Movement Priority Levels

Movement priorities determine which creeps have precedence in traffic situations:

| Priority | Level | Roles | Description |
|----------|-------|-------|-------------|
| 6 | STATIONARY_HARVESTER | Stationary Harvesters | Highest - fixed source positions |
| 5 | HARVESTER | Harvesters | Critical for energy collection |
| 4 | HAULER | Haulers | Logistics backbone |
| 3 | COMBAT | Attackers, Healers, Dismantlers | Defense and offense |
| 2 | BUILDER | Builders, Repairers | Infrastructure support |
| 1 | SUPPORT | Scouts, Claimers | Support roles |
| 0 | UPGRADER | Upgraders | Lowest - can wait |

## Architecture

### Components

```
┌─────────────────────────────────────────────────────┐
│              RoleControllerManager                   │
│  - Initializes PathfindingManager                   │
│  - Registers in ServiceLocator                      │
│  - Calls runMoves() after all behavior execution    │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              PathfindingManager                      │
│  - Wraps NesCafePathfinder                          │
│  - Provides moveTo(), runMoves(), reservePos()      │
│  - Manages path caching                             │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              NesCafePathfinder                       │
│  - Integrates screeps-pathfinding library           │
│  - Traffic management and priority handling          │
│  - Cost matrix caching and terrain optimization     │
└─────────────────────────────────────────────────────┘
```

### Traffic Management Flow

1. **Move Intent Phase**: All role controllers call `moveTo()` or `priorityMoveTo()` during behavior execution
2. **Queue Collection**: screeps-pathfinding collects all movement intents with their priorities
3. **Execution Phase**: `runMoves()` is called at the end of RoleControllerManager.execute()
4. **Traffic Resolution**: Higher priority creeps move first, lower priority creeps are pushed/swapped

## Usage

### Using Priority-Aware Movement

Role controllers can use the `priorityMoveTo()` helper function for traffic-managed movement:

```typescript
import { priorityMoveTo, MOVEMENT_PRIORITY } from "@runtime/behavior/controllers/helpers";

// High priority movement for harvesters
priorityMoveTo(creep, target, {
  range: 1,
  priority: MOVEMENT_PRIORITY.HARVESTER,
  reusePath: 30
});

// Low priority movement for upgraders
priorityMoveTo(creep, target, {
  range: 3,
  priority: MOVEMENT_PRIORITY.UPGRADER,
  reusePath: 30
});
```

### Accessing PathfindingManager

Use the ServiceLocator to access the PathfindingManager:

```typescript
import { serviceRegistry } from "@runtime/behavior/controllers/ServiceLocator";

const pathfindingManager = serviceRegistry.getPathfindingManager();
if (pathfindingManager?.isAvailable()) {
  // Use advanced pathfinding features
  pathfindingManager.reservePos(position, priority);
  pathfindingManager.moveOffRoad(creep);
}
```

### Move Off Road Behavior

Creeps can step off roads when idle to avoid blocking traffic:

```typescript
const pathfindingManager = serviceRegistry.getPathfindingManager();
if (creep.store.energy === 0 && pathfindingManager?.isAvailable()) {
  pathfindingManager.moveOffRoad(creep, { range: 3 });
}
```

### Spot Reservation

Reserve positions to prevent creep queueing:

```typescript
const pathfindingManager = serviceRegistry.getPathfindingManager();
if (pathfindingManager?.isAvailable()) {
  // Reserve the harvest position for this stationary harvester
  pathfindingManager.reservePos(harvestPosition, MOVEMENT_PRIORITY.STATIONARY_HARVESTER);
}
```

## Configuration

PathfindingManager is initialized in RoleControllerManager with these defaults:

```typescript
this.pathfindingManager = new PathfindingManager({
  enableCaching: true,  // Enable path caching for performance
  logger: this.logger   // Share logger for debugging
});
```

### Cache Management

The path cache can be cleared when room structures change:

```typescript
const pathfindingManager = serviceRegistry.getPathfindingManager();
if (pathfindingManager) {
  // Clear all caches
  pathfindingManager.clearCache();
  
  // Clear cache for specific room
  pathfindingManager.invalidateRoom("W1N1");
  
  // Clear structure-based caches (call when structures built/destroyed)
  pathfindingManager.invalidateStructures("W1N1");
}
```

## Graceful Degradation

The system gracefully falls back to native Screeps pathfinding when:

- screeps-pathfinding library fails to load
- PathfindingManager is not available in ServiceLocator
- Running in test environment without Screeps globals

```typescript
// priorityMoveTo automatically falls back to native moveTo
priorityMoveTo(creep, target, { priority: MOVEMENT_PRIORITY.HARVESTER });
// If PathfindingManager unavailable, uses: creep.moveTo(target, { range, reusePath, ignoreCreeps })
```

## Related Documentation

- [Role Controllers](./architecture/state-machines.md) - State machine behavior for roles
- [Defense System](./defense.md) - Combat role priorities
- [Energy Economy](./energy-economy.md) - Harvester and hauler logistics

## References

- [screeps-pathfinding](https://github.com/NesCafe62/screeps-pathfinding) - Library by NesCafe62
- [Issue #1358](https://github.com/ralphschuler/.screeps-gpt/issues/1358) - Integration PR
- [Issue #1459](https://github.com/ralphschuler/.screeps-gpt/issues/1459) - ignoreCreeps for narrow passages
