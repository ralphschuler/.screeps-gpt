# Remote Harvesting Strategy

This guide covers the remote harvesting system for extracting resources from neighboring rooms.

## Overview

Remote harvesting expands the colony's economy by accessing energy sources in rooms beyond the home room. The system consists of:

1. **ScoutManager**: Discovers and maps remote rooms
2. **RemoteMiner creeps**: Travel to remote rooms and harvest resources
3. **Memory persistence**: Stores scout data for long-term planning

## ScoutManager

The `ScoutManager` class (`src/runtime/scouting/ScoutManager.ts`) handles discovery and intelligence gathering for remote rooms.

### Key Features

- **Room scanning**: Collects information about sources, minerals, ownership, and threats
- **Data persistence**: Stores room data in `Memory.scout` for future reference
- **Automatic cleanup**: Removes stale data after configurable lifetime (default: 10,000 ticks)
- **Best target selection**: Ranks rooms by distance, source count, and safety

### Memory Structure

```typescript
Memory.scout = {
  rooms: {
    W1N1: {
      roomName: "W1N1",
      lastScouted: 12000,
      owned: false,
      sourceCount: 2,
      sources: [
        { id: "source_id_1", x: 10, y: 20 },
        { id: "source_id_2", x: 30, y: 40 }
      ],
      mineral: { type: "H", x: 25, y: 25, id: "mineral_id" },
      hasHostiles: false,
      hostileCount: 0,
      isSourceKeeper: false,
      pathDistance: 2
    }
  },
  lastUpdate: 12000,
  activeScouts: {}
};
```

### Usage Example

```typescript
import { ScoutManager } from "@runtime/scouting";

const scoutManager = new ScoutManager();

// Initialize memory
scoutManager.initializeMemory(Memory);

// Scout a room
if (Game.rooms["W1N1"]) {
  const roomData = scoutManager.scoutRoom(Game.rooms["W1N1"], Memory, Game);
  console.log(`Found ${roomData.sourceCount} sources in ${roomData.roomName}`);
}

// Find best remote target
const target = scoutManager.findBestRemoteTarget("W0N0", Memory, Game);
if (target) {
  console.log(`Best remote target: ${target.roomName} (distance: ${target.pathDistance})`);
}

// Clean up old data
scoutManager.cleanupOldData(Memory, Game);
```

## Remote Room Selection Criteria

The `findBestRemoteTarget` method filters and ranks rooms based on:

### Filtering Criteria (all must pass)

1. **Data freshness**: Room must be scouted within the data lifetime window
2. **Ownership**: Unowned or owned by us (excludes hostile-owned rooms)
3. **Safety**: Not a Source Keeper room (SK rooms require special handling)
4. **Hostiles**: No hostile creeps present
5. **Resources**: At least one source available

### Ranking Criteria (priority order)

1. **Path distance**: Shorter distances preferred (lower CPU and travel time)
2. **Source count**: More sources = higher energy potential

## RemoteMiner Creeps

Remote miners are already implemented in `BehaviorController.ts` with a three-state task loop:

1. **Travel**: Move to target room
2. **Mine**: Harvest energy from source
3. **Return**: Transport energy back to home room

### Memory Requirements

```typescript
{
  role: "remoteMiner",
  task: "travel" | "mine" | "return",
  homeRoom: "W0N0",
  targetRoom: "W1N1",
  sourceId: "source_id" // Optional, cached source assignment
}
```

## Integration with BehaviorController

To enable remote mining:

1. Scout adjacent rooms using `ScoutManager`
2. Identify suitable targets with `findBestRemoteTarget`
3. Spawn remote miners with `targetRoom` set to the chosen room
4. Remote miners automatically handle travel, mining, and return cycles

## Performance Considerations

### CPU Optimization

- **Data caching**: Scout data persists in Memory to avoid repeated room scans
- **Selective cleanup**: Only removes data older than the configured lifetime
- **Lazy evaluation**: Room scanning only happens when creeps have vision

### Memory Management

- **Configurable lifetime**: Default 10,000 ticks, adjustable based on empire size
- **Automatic pruning**: `cleanupOldData()` removes stale entries
- **Corruption recovery**: Handles missing or corrupt memory gracefully

## Testing

The remote harvesting system includes comprehensive test coverage:

### Unit Tests (`tests/unit/scoutManager.test.ts`)

- Memory initialization and persistence
- Room scouting with various scenarios (owned, reserved, hostile, SK)
- Data retrieval and filtering
- Best target selection
- Data cleanup and rescouting detection

### Regression Tests (`tests/regression/remote-room-data-persistence.test.ts`)

- Recovery from memory loss/corruption
- Partial memory corruption handling
- Data persistence across tick resets
- Concurrent scouting operations
- Cleanup without affecting recent data

## Future Enhancements

Potential improvements for future phases:

1. **Scout creep role**: Dedicated lightweight creeps for exploration
2. **SK room support**: Specialized logic for Source Keeper rooms
3. **Threat assessment**: Track hostile activity patterns
4. **Resource prediction**: Estimate energy income from remote sources
5. **Route optimization**: Calculate optimal harvester counts per room
6. **Reservation support**: Automatically reserve remote rooms with controller

## References

- [Phase 3: Economy Expansion](../../strategy/phases/03-economy-expansion.md)
- [Creep Roles](./creep-roles.md)
- [Memory Management](../operations/memory-management.md)
