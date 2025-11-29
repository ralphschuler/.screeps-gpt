# Automatic Base Building

This document describes the automatic base building system that dynamically places structures in owned rooms.

## Overview

The automatic base building system uses a **dynamic layout** to plan and create construction sites for structures based on the room's Controller Level (RCL). The system integrates with the existing builder creep role to automatically construct the planned structures.

**Key Features:**

- Dynamic structure placement based on RCL 1-8
- Automatic detection of misplaced structures
- Chess/checkerboard pattern for optimal pathing
- Visualization support for debugging

## Architecture

### Components

1. **BasePlanner** (`src/runtime/planning/BasePlanner.ts`)
   - Calculates optimal anchor point for the base using spawn position or distance transform
   - Uses dynamic layout with fixed offsets from anchor for RCL 1-8
   - Filters out invalid positions (walls, edges)
   - Detects misplaced structures that need to be removed
   - Provides visualization support for debugging
   - Includes layout statistics for analysis

2. **ConstructionManager** (`src/runtime/planning/ConstructionManager.ts`)
   - Manages construction site creation for all owned rooms
   - Tracks planning state per room to avoid unnecessary re-planning
   - Creates construction sites incrementally (CPU-efficient)
   - Integrates with kernel to run each tick

### Integration

The ConstructionManager is integrated into the main game loop through the Kernel:

```typescript
// In kernel.ts
this.constructionManager.planConstructionSites(game);
```

This runs once per tick before creep behavior execution, ensuring construction sites are available for builders.

## Dynamic Layout

The dynamic layout uses a **chess/checkerboard pattern** where structures are placed at fixed offsets from an anchor point (typically the spawn). This pattern ensures that all 8 adjacent tiles to the spawn remain walkable, preventing spawning blockage.

**Characteristics:**

- Compact, high-defense design
- All structures within rampart protection range
- Efficient for energy logistics (short creep paths)
- Requires large open area (approximately 11x11 minimum)
- Can detect and flag misplaced structures for removal

**Pattern Rules:**

- Structures are placed at positions where the sum of coordinates (dx + dy) is even
- This creates a checkerboard pattern with alternating walkable and structure tiles
- All tiles adjacent to the spawn (distance 1) remain walkable at all RCL levels
- Structures are distributed evenly in all four quadrants

## Structure Progression by RCL

| RCL | Spawns | Extensions | Towers | Storage | Links | Terminal | Labs | Factory | Observer | Power Spawn | Nuker |
| --- | ------ | ---------- | ------ | ------- | ----- | -------- | ---- | ------- | -------- | ----------- | ----- |
| 1   | 1      | 0          | 0      | 0       | 0     | 0        | 0    | 0       | 0        | 0           | 0     |
| 2   | 1      | 5          | 0      | 0       | 0     | 0        | 0    | 0       | 0        | 0           | 0     |
| 3   | 1      | 10         | 1      | 0       | 0     | 0        | 0    | 0       | 0        | 0           | 0     |
| 4   | 1      | 20         | 1      | 1       | 0     | 0        | 0    | 0       | 0        | 0           | 0     |
| 5   | 1      | 30         | 2      | 1       | 2     | 0        | 0    | 0       | 0        | 0           | 0     |
| 6   | 1      | 40         | 2      | 1       | 3     | 1        | 3    | 0       | 0        | 0           | 0     |
| 7   | 2      | 50         | 3      | 1       | 4     | 1        | 6    | 1       | 0        | 0           | 0     |
| 8   | 3      | 60         | 6      | 1       | 6     | 1        | 10   | 1       | 1        | 1           | 1     |

### RCL 6 Structures

- Terminal for inter-room trading
- 3 Labs for boosting creeps
- 40 Extensions for larger creep bodies
- 3 Links for energy distribution
- Extractor for mineral harvesting (placed at mineral position)

### RCL 7 Structures

- Second Spawn for faster creep production
- Factory for resource processing
- 6 Labs (3 more)
- 4 Links (1 more)
- Third Tower
- 50 Extensions (10 more)

### RCL 8 Structures

- Third Spawn
- 6 Towers (3 more)
- Observer for remote room scouting
- Power Spawn for power processing
- Nuker for room offense
- 10 Labs (4 more)
- 6 Links (2 more)
- 60 Extensions (10 more)

## Anchor Point Selection

The BasePlanner selects an anchor point using this priority:

1. **Existing Spawn**: If a spawn exists, use its position as the anchor
2. **Distance Transform**: If no spawn exists, find the position furthest from walls using a simplified distance transform algorithm

The distance transform algorithm:

- Initializes a 2D array with wall tiles set to 0, open tiles to 255
- Performs a single-pass approximation to calculate distance from walls
- Considers source proximity for optimal energy access
- Selects the position with maximum distance in the center region (10-40 x/y)

## Position Validation

Before placing structures, positions are validated to ensure:

- Not on walls (`TERRAIN_MASK_WALL`)
- Not too close to edges (2-tile border)
- No existing structure at the same position
- No construction site already queued for that position

## State Management

The ConstructionManager maintains state for each room:

- Caches the BasePlanner instance per room
- Tracks the last RCL at which planning occurred
- Only re-plans when RCL changes (avoids redundant work)

## Configuration

### ConstructionManager Configuration

```typescript
const manager = new ConstructionManager({
  logger: console, // Logger instance
  maxSitesPerTick: 5, // Maximum construction sites per tick
  maxSitesPerRoom: 1, // Maximum sites per room per tick
  enableVisualization: false // Enable visual debugging
});
```

### Handling Misplaced Structures

The system can detect and optionally remove structures that are not in planned positions:

```typescript
// Get misplaced structures without destroying
const misplaced = manager.getMisplacedStructures(room);

// Get and destroy misplaced structures
const result = manager.handleMisplacedStructures(room, true);
console.log(`Destroyed ${result.destroyed} misplaced structures`);
```

## Visualization

The BasePlanner supports Room.visual debugging to visualize planned layouts:

```typescript
const planner = new BasePlanner("W1N1", {
  enableVisualization: true
});

// In game loop, visualize layout
planner.visualize(room, 8, true); // Show RCL 8 layout with labels
```

### Layout Statistics

```typescript
const stats = planner.getLayoutStats(8);
console.log(stats);
// {
//   totalStructures: 92,
//   byType: { spawn: 3, extension: 60, tower: 6, ... },
//   byRCL: { 1: 1, 2: 6, 3: 6, ... },
//   boundingBox: { minX: -10, maxX: 10, minY: -8, maxY: 10 }
// }
```

## CPU Efficiency

To prevent CPU spikes, the system:

- Creates a maximum of 1 construction site per tick by default (configurable)
- Only runs planning when RCL changes
- Caches anchor point after first calculation
- Stops processing early if site limit is reached
- Layout plans are pre-computed and static (no per-tick calculations)

## Testing

The system includes comprehensive unit tests:

- `tests/unit/base-planner-rcl-6-8.test.ts` - RCL 6-8 layout tests
- `tests/unit/basePlanner.test.ts` - Core planner tests
- `tests/unit/constructionManager.test.ts` - Construction manager tests

Tests cover:

- Anchor point calculation
- Structure planning by RCL (1-8)
- Position validation
- Construction site creation
- State management
- Layout statistics
- Visualization
- CONTROLLER_STRUCTURES compliance

## References

- [Screeps Wiki: Automatic Base Building](https://wiki.screepspl.us/Automatic_base_building/)
- [Automating Base Planning in Screeps](https://sy-harabi.github.io/Automating-base-planning-in-screeps/)
- [Base Planning Algorithms Research](../research/base-planning-algorithms.md)
