# Wall and Rampart Upgrade Strategy

## Overview

The Wall Upgrade Manager implements a staged upgrade system for walls and ramparts that ensures balanced defense progression tied to controller level (RCL). This prevents over-repair of individual structures and ensures even distribution of hit points across all defensive structures.

## Key Features

- **Stage-based progression**: Hit point targets tied to room controller level
- **Even distribution**: All walls reach current stage threshold before advancing
- **Efficient energy usage**: Prevents wasting energy on excessive wall repairs
- **Tower integration**: Towers respect stage-based caps when repairing
- **Builder/Repairer integration**: Creeps follow stage-based repair strategy

## Architecture

### WallUpgradeManager

Located in `packages/bot/src/runtime/defense/WallUpgradeManager.ts`, this manager is the core of the staged upgrade system.

**Key Methods:**

- `getTargetHits(room)` - Returns target hit points for current RCL
- `getCurrentStage(room)` - Returns active upgrade stage configuration
- `allWallsUpgraded(room)` - Checks if all walls meet current stage target
- `getWeakestWall(room)` - Finds weakest wall needing upgrade
- `getWallsNeedingRepair(room)` - Returns sorted list of walls below target
- `shouldRepairStructure(structure, room)` - Validates if repair is needed
- `getUpgradeProgress(room)` - Returns progress statistics

## Upgrade Stages

The system defines 7 upgrade stages from RCL 2 to RCL 8:

| RCL | Target Hits | Description                  |
| --- | ----------- | ---------------------------- |
| 2   | 10,000      | Basic defense for early game |
| 3   | 50,000      | Early fortification          |
| 4   | 100,000     | Intermediate defense         |
| 5   | 500,000     | Mid-game fortification       |
| 6   | 1,000,000   | Advanced defense             |
| 7   | 3,000,000   | High-level fortification     |
| 8   | 10,000,000  | Maximum defense              |

### Configuration

Stages are defined in `DEFAULT_WALL_UPGRADE_STAGES`:

```typescript
export const DEFAULT_WALL_UPGRADE_STAGES: WallUpgradeStage[] = [
  { controllerLevel: 2, targetHits: 10_000, repairThreshold: 0.5 },
  { controllerLevel: 3, targetHits: 50_000, repairThreshold: 0.6 },
  { controllerLevel: 4, targetHits: 100_000, repairThreshold: 0.7 },
  { controllerLevel: 5, targetHits: 500_000, repairThreshold: 0.75 },
  { controllerLevel: 6, targetHits: 1_000_000, repairThreshold: 0.8 },
  { controllerLevel: 7, targetHits: 3_000_000, repairThreshold: 0.85 },
  { controllerLevel: 8, targetHits: 10_000_000, repairThreshold: 0.9 }
];
```

Custom stages can be provided when instantiating the manager:

```typescript
const customStages = [
  { controllerLevel: 2, targetHits: 20_000, repairThreshold: 0.5 },
  { controllerLevel: 4, targetHits: 200_000, repairThreshold: 0.7 }
];
const manager = new WallUpgradeManager(customStages);
```

## Integration Points

### TowerManager Integration

The `TowerManager` uses `WallUpgradeManager` to determine repair priorities:

```typescript
// In TowerManager.ts
private readonly wallUpgradeManager: WallUpgradeManager;

public run(room: RoomLike): Record<TowerAction, number> {
  const targetHits = this.wallUpgradeManager.getTargetHits(room);
  const damagedStructures = room.find(FIND_STRUCTURES, {
    filter: (s: Structure) => {
      // Apply stage-based caps to walls and ramparts
      if (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) {
        return s.hits < targetHits;
      }
      // Other structures: repair to threshold percentage
      const healthPercent = s.hits / s.hitsMax;
      return healthPercent < this.repairThreshold;
    }
  });
  // ... repair logic
}
```

### Builder Role Integration

Builder creeps respect stage-based caps when repairing:

```typescript
// In BehaviorController.ts - runBuilder()
const targetHits = wallUpgradeManager?.getTargetHits(creep.room) ?? 0;
const repairTargets = creep.room.find(FIND_STRUCTURES, {
  filter: (structure: AnyStructure) => {
    if (structure.structureType === STRUCTURE_WALL) {
      return structure.hits < targetHits;
    }
    if (structure.structureType === STRUCTURE_RAMPART) {
      return structure.hits < targetHits;
    }
    return structure.hits < structure.hitsMax;
  }
});
```

### Repairer Role Integration

Dedicated repairer creeps follow the same strategy:

```typescript
// In BehaviorController.ts - runRepairer()
const targetHits = wallUpgradeManager?.getTargetHits(creep.room) ?? 0;
const repairTargets = creep.room.find(FIND_STRUCTURES, {
  filter: (structure: AnyStructure) => {
    // Infrastructure gets priority (roads, containers)
    if (structure.structureType === STRUCTURE_ROAD || structure.structureType === STRUCTURE_CONTAINER) {
      return structure.hits < structure.hitsMax;
    }

    // Walls and ramparts respect stage-based caps
    if (structure.structureType === STRUCTURE_WALL) {
      return structure.hits < targetHits;
    }
    if (structure.structureType === STRUCTURE_RAMPART) {
      return structure.hits < targetHits;
    }

    return structure.hits < structure.hitsMax;
  }
});
```

## Repair Prioritization

The system ensures even distribution through prioritization:

1. **Towers** repair weakest structures first (sorted by hits ascending)
2. **Builders** find closest damaged structure within stage caps
3. **Repairers** prioritize infrastructure (roads, containers) then defensive structures
4. All repair operations respect the current RCL stage target

### Weakest-First Strategy

```typescript
// Get walls needing repair, sorted weakest first
const wallsNeedingRepair = wallUpgradeManager.getWallsNeedingRepair(room);
// Returns: [wall with 30K hits, wall with 50K hits, wall with 80K hits]

// Get single weakest wall
const weakestWall = wallUpgradeManager.getWeakestWall(room);
// Returns: wall with 30K hits
```

## Progress Tracking

Monitor upgrade progress using the progress API:

```typescript
const progress = wallUpgradeManager.getUpgradeProgress(room);
console.log(`Target: ${progress.targetHits}`);
console.log(`Min hits: ${progress.minHits}`);
console.log(`Max hits: ${progress.maxHits}`);
console.log(`Average: ${progress.averageHits}`);
console.log(`Walls: ${progress.wallCount}`);
console.log(`Complete: ${progress.upgradeComplete}`);
```

Example output for RCL 4 room:

```
Target: 100000
Min hits: 30000
Max hits: 85000
Average: 62000
Walls: 12
Complete: false
```

## RCL Progression Behavior

As controller level increases, the system automatically adjusts:

### Example Scenario

**RCL 3 → RCL 4 Transition:**

1. At RCL 3, target is 50,000 hits
2. All walls upgraded to 50,000 hits
3. Room controller reaches level 4
4. Target automatically increases to 100,000 hits
5. All walls now below target and need repair
6. Towers and creeps resume repairs to new target

This ensures defenses scale with room progression without manual intervention.

## Benefits

### Balanced Defense

- No weak points in perimeter
- All walls upgraded proportionally
- Consistent defense across the room

### Energy Efficiency

- No wasted energy on excessive repairs
- Energy directed to walls that need it most
- Repairs prioritized by strategic value

### Automated Scaling

- Defense automatically scales with RCL
- No manual configuration required
- Smooth progression from early to late game

### Strategic Resource Allocation

- Energy spent on defense matches room capability
- Higher RCL = more energy available = higher targets
- Prevents early-game energy drain on walls

## Testing

The system includes comprehensive unit tests covering:

- Stage configuration and custom stages
- Target hit calculation for all RCL levels
- Weakest wall identification
- Repair prioritization
- Progress tracking
- RCL progression scenarios

Run tests with:

```bash
npm run test:unit tests/unit/wallUpgradeManager.test.ts
npm run test:unit tests/unit/towerManager.test.ts
```

## Future Enhancements

Potential improvements for consideration:

1. **Dynamic stage adjustment** - Adjust targets based on threat level
2. **Room-specific overrides** - Custom targets per room
3. **Emergency repair mode** - Bypass stage caps during active defense
4. **Repair rate limiting** - Prevent CPU spikes from mass repairs
5. **Visual feedback** - Display upgrade progress in room visuals

## Related Systems

- **Tower Management** (`TowerManager.ts`) - Defense automation
- **Builder Role** (`BehaviorController.ts`) - Construction and maintenance
- **Repairer Role** (`BehaviorController.ts`) - Dedicated repair operations
- **Energy Management** - Energy allocation for repairs

## Troubleshooting

### Walls not upgrading

**Check:**

1. Is there energy available for repairs?
2. Are builders/repairers alive and working?
3. Are towers functional and powered?
4. Run `getUpgradeProgress()` to check current status

### Uneven wall distribution

**Check:**

1. Are repair targets sorted by hits (weakest first)?
2. Is `getWeakestWall()` being used correctly?
3. Are multiple creeps targeting the same wall?

### Performance issues

**Check:**

1. How many walls are being repaired per tick?
2. Is CPU usage within limits?
3. Consider adding repair rate limiting
4. Profile `WallUpgradeManager` calls

## References

- [WallUpgradeManager.ts](../../../packages/bot/src/runtime/defense/WallUpgradeManager.ts)
- [TowerManager.ts](../../../packages/bot/src/runtime/defense/TowerManager.ts)
- [BehaviorController.ts](../../../packages/bot/src/runtime/behavior/BehaviorController.ts)
- [Screeps Documentation - Structures](https://docs.screeps.com/api/#StructureWall)
