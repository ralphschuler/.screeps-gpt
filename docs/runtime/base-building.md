# Automatic Base Building

This document describes the automatic base building system that dynamically places structures in owned rooms.

## Overview

The automatic base building system uses a **bunker pattern** approach to plan and create construction sites for structures based on the room's Controller Level (RCL). The system integrates with the existing builder creep role to automatically construct the planned structures.

## Architecture

### Components

1. **BasePlanner** (`src/runtime/planning/BasePlanner.ts`)
   - Calculates optimal anchor point for the base using spawn position or distance transform
   - Defines bunker layout with fixed offsets from anchor
   - Determines which structures to build based on current RCL
   - Filters out invalid positions (walls, edges)

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

## Bunker Layout Pattern

The bunker uses a compact layout with structures placed at fixed offsets from an anchor point (typically the spawn):

### RCL 2

- 5 Extensions
- 1 Container

### RCL 3

- 10 Extensions (5 from RCL 2 + 5 new)
- 1 Tower
- 1 Container (from RCL 2)

### RCL 4

- 20 Extensions (10 from RCL 3 + 10 new)
- 1 Storage
- 1 Tower (from RCL 3)
- 1 Container (from RCL 2)

## Anchor Point Selection

The BasePlanner selects an anchor point using this priority:

1. **Existing Spawn**: If a spawn exists, use its position as the anchor
2. **Distance Transform**: If no spawn exists, find the position furthest from walls using a simplified distance transform algorithm

The distance transform algorithm:

- Initializes a 2D array with wall tiles set to 0, open tiles to 255
- Performs a single-pass approximation to calculate distance from walls
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

## CPU Efficiency

To prevent CPU spikes, the system:

- Creates a maximum of 1 construction site per tick by default (configurable)
- Only runs planning when RCL changes
- Caches anchor point after first calculation
- Stops processing early if site limit is reached

## Future Enhancements

Potential improvements for the base building system:

1. **Extended RCL Support**: Add layouts for RCL 5-8
2. **Road Planning**: Automatically plan roads from sources to spawn/controller
3. **Dynamic Layouts**: Adapt layout based on room terrain and source positions
4. **Multi-Room Support**: Coordinate building across multiple rooms
5. **Rampart Planning**: Add defensive rampart positions
6. **Lab Layouts**: Optimize lab positioning for reactions

## Testing

The system includes comprehensive unit tests:

- `tests/unit/basePlanner.test.ts` (13 tests)
- `tests/unit/constructionManager.test.ts` (11 tests)

Tests cover:

- Anchor point calculation
- Structure planning by RCL
- Position validation
- Construction site creation
- State management
- Error handling

## References

- [Screeps Wiki: Automatic Base Building](https://wiki.screepspl.us/Automatic_base_building/)
- [Automating Base Planning in Screeps](https://sy-harabi.github.io/Automating-base-planning-in-screeps/)
