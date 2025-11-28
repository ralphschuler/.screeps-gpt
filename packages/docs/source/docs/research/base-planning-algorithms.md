# Base Planning Algorithms Research

This document summarizes research findings on automated base planning algorithms for Screeps, drawing from community resources and best practices.

## Overview

Automated base planning in Screeps dramatically improves efficiency, defensibility, and growth of rooms. A robust automated planner leverages algorithms to optimize layout for resource flow, protection, and structure adjacency.

## Research Sources

### 1. Sy-Harabi's Automated Base Planning Guide

**URL**: https://sy-harabi.github.io/Automating-base-planning-in-screeps/

**Key Insights**:

- **Anchor-Based Planning**: Select a central anchor point for the entire base layout, typically using distance transform to find optimal open space
- **Terrain Analysis**: Run terrain analysis before placing structures to identify walls, swamps, and open areas
- **RCL Progression**: Update layout plans as Room Controller Level increases
- **Modular Design**: Use stamps/bunkers that can be placed at an anchor and expanded

### 2. ScreepsPlus Wiki: Automatic Base Building

**URL**: https://wiki.screepspl.us/Automatic_base_building/

**Key Algorithms**:

- **Distance Transform**: Calculates open areas by scoring every tile based on distance from walls
- **Flood Fill**: Verifies areas are enclosed and defines zones for extension clusters
- **Minimum Cut / CostMatrix**: Optimizes rampart placement using minimum cut algorithms

**Layout Strategies**:

1. **Bunker Layout**: Tightly packed predefined structure layout within a controlled area
2. **Stamp/Tile-set Layout**: Smaller modular patterns placed flexibly around the room
3. **Dynamic Generation**: Real-time structure placement based on current terrain

### 3. Screeps-Tutorials Base Planning Algorithms

**Repository**: https://github.com/Screeps-Tutorials/Screeps-Tutorials/tree/Master/basePlanningAlgorithms

**Algorithms Covered**:

- Optimal spawn placement
- Extension clustering strategies
- Tower coverage optimization
- Road network efficiency

### 4. Video Tutorial: Automated Base Planning

**URL**: https://www.youtube.com/watch?v=YcruUDbqa7E

**Topics**:

- Visual walkthrough of base planning strategies
- Code examples for bunker planning
- Modular extension placement techniques

## Layout Strategies

### 1. Bunker Layout (Compact, High-Defense)

**Characteristics**:

- Single predefined layout centered around spawn
- All structures within rampart protection range
- Efficient for energy logistics (short creep paths)
- Requires large open area (approximately 11x11 minimum)

**Chess/Checkerboard Pattern**:

- Structures placed at positions where dx + dy is even
- Creates alternating walkable and structure tiles
- All tiles adjacent to spawn remain walkable
- Prevents spawning blockage

**Implementation**:

```typescript
// Positions relative to anchor (spawn)
const bunkerLayout = [
  { type: "spawn", dx: 0, dy: 0, rcl: 1 },
  { type: "extension", dx: 2, dy: 0, rcl: 2 },
  { type: "extension", dx: 0, dy: 2, rcl: 2 }
  // ... more positions
];
```

### 2. Stamp Layout (Modular, Expandable)

**Characteristics**:

- Collection of smaller, reusable patterns (stamps)
- Placed flexibly around the room
- Better adaptation to irregular terrain
- Higher computational complexity

**Common Stamps**:

- **Extension Cluster** (3x3): 5 extensions in cross pattern
- **Lab Cluster** (3x5): 10 labs in compact arrangement
- **Tower Triangle**: 3 towers for optimal coverage

**Stamp Types**:

1. **Fast Filler**: High-throughput extension arrangement near spawns
2. **Extension Flower**: 5-extension pattern with road access
3. **Lab Diamond**: 10-lab arrangement for reactions

### 3. Organic Layout (Terrain-Adaptive)

**Characteristics**:

- Dynamic structure placement based on terrain analysis
- Maximizes use of available space
- Adapts to room-specific features
- Most flexible but complex to implement

**Approach**:

1. Identify buildable tiles using terrain analysis
2. Score positions based on multiple factors
3. Place structures in priority order
4. Adjust for terrain constraints

## Structure Limits by RCL

| Structure    | RCL 1 | RCL 2 | RCL 3 | RCL 4 | RCL 5 | RCL 6 | RCL 7 | RCL 8 |
| ------------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| Spawn        | 1     | 1     | 1     | 1     | 1     | 1     | 2     | 3     |
| Extension    | 0     | 5     | 10    | 20    | 30    | 40    | 50    | 60    |
| Tower        | 0     | 0     | 1     | 1     | 2     | 2     | 3     | 6     |
| Storage      | 0     | 0     | 0     | 1     | 1     | 1     | 1     | 1     |
| Link         | 0     | 0     | 0     | 0     | 2     | 3     | 4     | 6     |
| Terminal     | 0     | 0     | 0     | 0     | 0     | 1     | 1     | 1     |
| Lab          | 0     | 0     | 0     | 0     | 0     | 3     | 6     | 10    |
| Factory      | 0     | 0     | 0     | 0     | 0     | 0     | 1     | 1     |
| Observer     | 0     | 0     | 0     | 0     | 0     | 0     | 0     | 1     |
| Power Spawn  | 0     | 0     | 0     | 0     | 0     | 0     | 0     | 1     |
| Nuker        | 0     | 0     | 0     | 0     | 0     | 0     | 0     | 1     |
| Extractor    | 0     | 0     | 0     | 0     | 0     | 1     | 1     | 1     |
| Container    | 5     | 5     | 5     | 5     | 5     | 5     | 5     | 5     |
| Road         | ∞     | ∞     | ∞     | ∞     | ∞     | ∞     | ∞     | ∞     |
| Rampart      | 0     | ∞     | ∞     | ∞     | ∞     | ∞     | ∞     | ∞     |
| Constructed Wall | 0 | 0    | ∞     | ∞     | ∞     | ∞     | ∞     | ∞     |

## Core Algorithms

### Distance Transform

Used to find optimal anchor positions by calculating distance from walls:

```typescript
function distanceTransform(terrain: RoomTerrain): number[][] {
  const field: number[][] = [];

  // Initialize: walls = 0, open = 255
  for (let x = 0; x < 50; x++) {
    field[x] = [];
    for (let y = 0; y < 50; y++) {
      field[x][y] = terrain.get(x, y) === TERRAIN_MASK_WALL ? 0 : 255;
    }
  }

  // Forward pass
  for (let x = 1; x < 49; x++) {
    for (let y = 1; y < 49; y++) {
      if (field[x][y] > 0) {
        field[x][y] = Math.min(
          field[x][y],
          field[x - 1][y] + 1,
          field[x][y - 1] + 1,
          field[x - 1][y - 1] + 1
        );
      }
    }
  }

  // Backward pass (for full accuracy)
  for (let x = 48; x > 0; x--) {
    for (let y = 48; y > 0; y--) {
      if (field[x][y] > 0) {
        field[x][y] = Math.min(
          field[x][y],
          field[x + 1][y] + 1,
          field[x][y + 1] + 1,
          field[x + 1][y + 1] + 1
        );
      }
    }
  }

  return field;
}
```

### Flood Fill for Zone Detection

```typescript
function floodFill(
  terrain: RoomTerrain,
  startX: number,
  startY: number,
  visited: Set<string>
): { x: number; y: number }[] {
  const zone: { x: number; y: number }[] = [];
  const queue = [{ x: startX, y: startY }];

  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    const key = `${x},${y}`;

    if (visited.has(key)) continue;
    if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
    if (x < 1 || x > 48 || y < 1 || y > 48) continue;

    visited.add(key);
    zone.push({ x, y });

    queue.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
  }

  return zone;
}
```

### Tower Coverage Scoring

```typescript
function scoreTowerPosition(x: number, y: number, room: Room): number {
  let score = 0;

  // Score based on coverage of entry points
  const exits = room.find(FIND_EXIT);
  for (const exit of exits) {
    const range = Math.max(Math.abs(x - exit.x), Math.abs(y - exit.y));
    if (range <= 20) {
      // Tower effective range is 20
      score += 21 - range; // Higher score for closer to exits
    }
  }

  return score;
}
```

## Implementation Recommendations

### For This Repository

Based on the existing `BasePlanner` infrastructure:

1. **Extend Bunker Layout**: Add RCL 6-8 structures to existing bunker pattern
2. **Add Stamp Strategy**: Implement modular stamp-based layout as alternative
3. **Add Visualization**: Integrate Room.visual for debugging layouts
4. **Performance**: Cache layouts in Memory, lazy evaluation for distant rooms

### Best Practices

- **Cache layout decisions**: Don't recalculate every tick
- **Integrate with RCL upgrades**: Adjust plan as RCL rises
- **Dynamic ramparts**: Place defensive ramparts around key structures
- **Pathfinding integration**: Locate spawns close to sources for energy efficiency
- **Validation**: Check CONTROLLER_STRUCTURES limits before placing

## Tools and Resources

- **Screeps Tools Building Planner**: https://github.com/admon84/screeps-tools
- **ScreepsPlus Wiki**: https://wiki.screepspl.us/
- **Overmind Bot**: https://github.com/bencbartlett/Overmind (sophisticated layout algorithms)
- **The International Bot**: https://github.com/The-International-Screeps-Bot/The-International-Open-Source

## References

1. Sy-Harabi's Automated Base Planning Guide: https://sy-harabi.github.io/Automating-base-planning-in-screeps/
2. ScreepsPlus Wiki - Automatic Base Building: https://wiki.screepspl.us/Automatic_base_building/
3. Screeps Official Documentation - Control: https://docs.screeps.com/control.html
4. Screeps-Tutorials Repository: https://github.com/Screeps-Tutorials/Screeps-Tutorials
5. YouTube Tutorial: https://www.youtube.com/watch?v=YcruUDbqa7E

---

_Research conducted: 2025-11-28_
_Applied to: Issue #1495 - Refactor room planner with advanced base layout algorithms_
