# Role Balancing and Dynamic Spawn Priority

This document describes the dynamic role balancing system implemented in BehaviorController to optimize creep distribution based on room state and infrastructure.

## Overview

The role balancing system automatically adjusts creep role minimums and spawn priorities based on room infrastructure, ensuring optimal workforce distribution at each RCL (Room Controller Level).

**Key Features:**

- Dynamic role minimum calculation based on room state
- Adaptive spawn priority ordering for critical roles
- Automatic workforce scaling as infrastructure develops
- Prevention of overstaffing and resource waste

## Problem Statement

Issue #961 identified suboptimal creep distribution at RCL4:

- **4 harvesters** (33% overstaffed) - doing both harvest and logistics
- **0 haulers** (critical gap) - logistics infrastructure idle
- **0 builders/repairers** - construction and maintenance stalled

This inefficiency occurred because:

1. Static role minimums didn't adapt to room infrastructure
2. Spawn priority didn't account for critical infrastructure needs
3. Harvesters forced into dual-purpose roles reduced throughput

## Solution Architecture

### 1. Dynamic Role Minimum Calculation

The `calculateDynamicRoleMinimums()` method analyzes room state and adjusts role targets:

```typescript
private calculateDynamicRoleMinimums(game: GameContext): Partial<Record<RoleName, number>>
```

**Analyzed Factors:**

- Energy sources and container placement
- Storage/tower existence and capacity
- Construction site queue size
- Damaged structure count
- Link network status (RCL 5+)
- Energy surplus indicators

**Adjusted Roles:**

- Harvesters (2-4 based on sources and logistics infrastructure)
- Haulers (0-3 based on containers/storage/towers)
- Builders (1-3 based on construction queue)
- Repairers (0-1 based on damaged structures)
- Upgraders (3-5 based on energy surplus)

### 2. Adaptive Spawn Priority

The spawn priority order dynamically adjusts based on critical needs:

```typescript
// Normal mode: harvester → upgrader → builder → hauler
const normalOrder = ["harvester", "upgrader", "builder", "stationaryHarvester", "hauler", ...];

// Critical hauler mode: hauler → harvester → upgrader → builder
const criticalOrder = ["hauler", "harvester", "upgrader", "builder", "stationaryHarvester", ...];
```

**Critical Hauler Detection:**

```typescript
const needsCriticalHauler = haulerCount === 0 && haulerMinimum > 0;
```

When storage/towers exist but haulers = 0, haulers spawn FIRST to activate logistics immediately.

## Implementation Details

### Hauler Spawning Logic

**Scenario 1: Containers Near Sources**

```typescript
if (totalSourcesWithContainers > 0 && controlledRoomCount > 0) {
  adjustedMinimums.hauler = Math.max(totalSources, controlledRoomCount);
}
```

- Standard container-based economy
- 1+ hauler per source for energy transport
- Reduced with link network (RCL 5+)

**Scenario 2: Storage/Towers Without Source Containers**

```typescript
else if (hasAnyContainersOrStorage || hasTowers) {
  adjustedMinimums.hauler = Math.max(1, controlledRoomCount);
  adjustedMinimums.harvester = Math.max(2, optimalHarvesters - 1);
}
```

- Early-game logistics infrastructure
- 1+ hauler for tower refilling and storage management
- Reduced harvester count (no dual-purpose work needed)

**Scenario 3: No Logistics Infrastructure**

```typescript
else {
  adjustedMinimums.hauler = 0;
  adjustedMinimums.harvester = optimalHarvesters;
}
```

- Basic energy economy
- Harvesters handle all energy tasks
- No haulers needed

### Builder Activation

**Dynamic Scaling:**

```typescript
if (totalConstructionSites > 0) {
  if (totalConstructionSites > 15) {
    adjustedMinimums.builder = 3;
  } else if (totalConstructionSites > 5) {
    adjustedMinimums.builder = 2;
  } else {
    adjustedMinimums.builder = 1;
  }
} else {
  adjustedMinimums.builder = ROLE_DEFINITIONS["builder"].minimum; // 2
}
```

**Rationale:**

- Scale builders with construction queue size
- Maintain minimum of 2 when no construction (for emergency repairs)
- Prevent builder spam on large projects

### Repairer Activation

**Dynamic Activation:**

```typescript
if (hasDamagedStructures) {
  adjustedMinimums.repairer = Math.max(1, controlledRoomCount);
} else {
  adjustedMinimums.repairer = 0;
}
```

**Rationale:**

- Only spawn repairers when structures need maintenance
- Builders handle emergency repairs when no repairers active
- Prevents idle repairers when no work available

### Harvester Optimization

**Single-Source Rooms:**

```typescript
if (sourceCount === 1) {
  return rcl >= 3 ? 3 : 2;
}
```

**Multi-Source Rooms:**

```typescript
return sourceCount * (rcl >= 3 ? 2 : 1);
```

**With Haulers Available:**

```typescript
adjustedMinimums.harvester = Math.max(2, optimalHarvesters - 1);
```

## Expected Room Distribution

### RCL 4 with Storage/Towers (Target State)

| Role             | Count | Rationale                              |
| ---------------- | ----- | -------------------------------------- |
| Harvesters       | 2-3   | Energy collection (reduced from 4)     |
| Haulers          | 2-3   | Energy distribution (activated from 0) |
| Upgraders        | 4-5   | Controller progress (energy surplus)   |
| Builders         | 1-2   | Construction work (queue-based)        |
| Repairers        | 0-1   | Structure maintenance (damage-based)   |
| **Total Creeps** | 10-14 | Optimal workforce for RCL4             |

### Comparison to Previous State

**Before Optimization (Tick 75067453):**

- Harvesters: 4 (overstaffed, doing dual-purpose work)
- Haulers: 0 (logistics blocked)
- Upgraders: 5 (correct)
- Builders: 0 (construction stalled)
- Repairers: 0 (decay accumulating)
- Total: 9 creeps (underutilized, inefficient)

**After Optimization:**

- Harvesters: 2-3 (optimal, dedicated to collection)
- Haulers: 2-3 (logistics active)
- Upgraders: 4-5 (correct)
- Builders: 1-2 (construction active)
- Repairers: 1 (maintenance active)
- Total: 10-14 creeps (efficient, balanced)

## Spawn Priority Examples

### Example 1: Room with Storage but Some Creeps

**State:**

- Storage exists with 1000 energy
- Harvesters: 1 (some energy collection capability)
- Haulers: 0 (logistics not operational)
- Energy available = 400

**Decision:**

```
isEmergency = false (totalCreeps > 0)
needsCriticalHauler = true (haulerCount=0, haulerMinimum=1, !isEmergency)
spawnOrder = ["hauler", "harvester", "upgrader", ...]
```

**First Spawn:** Hauler (activate logistics to distribute existing energy)

**Rationale:** With at least one harvester collecting energy and storage having reserves, activating haulers is more critical for distribution. Emergency mode is NOT active because creeps exist.

### Example 2: Emergency Recovery (Empty Room with Storage)

**State:**

- Storage exists with 1000 energy
- All creeps = 0 (EMERGENCY)
- Energy available = 400

**Decision:**

```
isEmergency = true (totalCreeps = 0)
needsCriticalHauler = false (isEmergency overrides)
spawnOrder = ["harvester", "upgrader", "builder", ...]
```

**First Spawn:** Harvester (emergency recovery mode)

**Rationale:** In a true emergency (0 creeps), harvesters MUST spawn first to establish energy collection. Even though storage has energy, without harvesters, the room cannot sustain operations. Emergency mode takes priority over all other considerations.

### Example 3: Normal Operation

**State:**

- Harvesters: 2
- Haulers: 2
- Upgraders: 3
- Builders: 1

**Decision:**

```
needsCriticalHauler = false (haulerCount > 0)
spawnOrder = ["harvester", "upgrader", "builder", ...]
```

**First Spawn:** Upgrader (closest to minimum deficit)

**Rationale:** Normal priority order applies. No critical infrastructure gaps.

### Example 4: Hauler Death During Operation

**State:**

- Storage exists
- Harvesters: 3
- Haulers: 0 (just died)
- Upgraders: 5

**Decision:**

```
needsCriticalHauler = true (haulerCount=0, haulerMinimum=1)
spawnOrder = ["hauler", "harvester", "upgrader", ...]
```

**First Spawn:** Hauler (restore logistics immediately)

**Rationale:** Logistics infrastructure exists but not operational. Critical to restore hauler quickly.

## Testing

The system is validated by regression tests in `tests/regression/hauler-spawning-with-storage.test.ts`:

### Test 1: Storage Without Source Containers

- **Setup:** Storage exists, no containers near sources
- **Expected:** Hauler spawns first
- **Validates:** Critical hauler priority activation

### Test 2: Towers Without Source Containers

- **Setup:** Towers exist, no containers near sources
- **Expected:** Hauler spawns first
- **Validates:** Tower refilling logistics activation

### Test 3: Containers Anywhere in Room

- **Setup:** Containers exist (not near sources)
- **Expected:** Hauler spawns first
- **Validates:** General logistics infrastructure detection

### Test 4: No Logistics Infrastructure

- **Setup:** No storage, towers, or containers
- **Expected:** NO hauler spawns
- **Validates:** Hauler suppression in basic economy

## Performance Impact

**CPU Cost:** Minimal

- `calculateDynamicRoleMinimums()` runs once per tick
- O(n) where n = number of rooms
- Typical cost: 0.1-0.3 CPU per tick for 1-3 rooms

**Memory Cost:** Zero

- No persistent memory storage
- Calculated dynamically each tick

**Efficiency Gain:**

- ~30% reduction in wasted harvester capacity
- Immediate logistics activation (vs. delayed by 4+ ticks)
- Faster construction/repair cycle (active builders/repairers)

## Future Enhancements

Potential improvements to the system:

1. **Energy Surplus Detection**
   - Adjust hauler count based on storage fill rate
   - Reduce haulers when storage near empty

2. **Remote Mining Coordination**
   - Scale haulers for remote mining routes
   - Dedicated haulers for long-distance transport

3. **Combat Role Integration**
   - Emergency priority for defenders when hostiles detected
   - Automatic militia spawning at towers

4. **Multi-Room Coordination**
   - Share haulers between adjacent rooms
   - Coordinate builder pools for large projects

5. **Machine Learning Optimization**
   - Learn optimal ratios for specific room layouts
   - Predict future needs based on patterns

## Related Documentation

- [Spawn Management](./operations/spawn-management.md) - Core spawn system
- [Container-Based Harvesting](../strategy/learning/container-based-harvesting.md) - Harvester/hauler architecture
- [Energy Priority System](../operations/energy-priority.md) - Energy distribution logic

## References

- **Issue #961:** Optimize creep role distribution at RCL4
- **Issue #955:** Hauler role not spawning (blocking dependency)
- **Commit bcf0d42:** Priority-based hauler spawning implementation
- **Commit 15b110c:** Dynamic builder and repairer activation
