# Dynamic Min/Max Workforce Scaling System

This document describes the dynamic workforce scaling system that maintains minimum workforce levels while scaling up to maximum caps based on task demand and flag commands.

## Overview

The dynamic workforce scaling system provides flexible spawn control by:

1. **Maintaining minimum workforce** - Always keeping at least the configured minimum creeps for each role
2. **Scaling with task demand** - Increasing workforce when pending tasks accumulate
3. **Enforcing maximum caps** - Never exceeding role maximums to prevent over-spawning
4. **Responding to flag commands** - Spawning combat roles when attack/defend flags are placed

## Configuration

### RoleConfig Interface

Each role controller defines workforce constraints through the `RoleConfig` interface:

```typescript
interface RoleConfig<TMemory extends CreepMemory = CreepMemory> {
  /** Minimum number of creeps of this role that should be maintained */
  minimum: number;
  /** Maximum number of creeps of this role allowed (default: 10 if not specified) */
  maximum?: number;
  /** Number of tasks per creep for scaling calculations (default: 4) */
  scalingFactor?: number;
  /** Default body parts for this role */
  body: BodyPartConstant[];
  /** Factory function to create initial memory for a new creep */
  createMemory: () => TMemory;
  /** Current version of this role's logic (for migration purposes) */
  version: number;
}
```

### Default Role Configurations

| Role | Minimum | Maximum | Scaling Factor | Use Case |
|------|---------|---------|----------------|----------|
| harvester | 4 | 6 | 4 | Energy collection |
| upgrader | 3 | 8 | 4 | Controller upgrading |
| builder | 2 | 5 | 4 | Construction |
| hauler | 0 | 4 | 4 | Energy transport |
| repairer | 0 | 3 | 4 | Structure repair |
| stationaryHarvester | 0 | 4 | 1 | Fixed position mining |
| attacker | 0 | 8 | 1 | Combat - attack |
| healer | 0 | 4 | 1 | Combat - healing |
| dismantler | 0 | 4 | 1 | Structure removal |
| claimer | 0 | 2 | 1 | Room claiming |
| scout | 0 | 2 | 1 | Room scouting |
| remoteUpgrader | 0 | 8 | 2 | Remote room upgrading |
| remoteHauler | 0 | 8 | 2 | Remote energy transport |
| remoteBuilder | 0 | 8 | 2 | Remote construction |

## Task-Based Scaling

The spawn system calculates dynamic workforce needs based on pending tasks:

```typescript
// For each role:
const pendingTasks = taskQueue.getTasksForRole(role).length;
const tasksPerCreep = config.scalingFactor || 4;
const demandBasedTarget = Math.ceil(pendingTasks / tasksPerCreep);
const targetMinimum = Math.max(config.minimum, Math.min(demandBasedTarget, config.maximum));
```

### Example Scenarios

**Scenario 1: Normal Operation**
- Builder minimum: 2
- Builder maximum: 5
- Pending build tasks: 4
- Scaling factor: 4
- Calculated target: max(2, min(ceil(4/4), 5)) = max(2, min(1, 5)) = 2
- Result: 2 builders (minimum)

**Scenario 2: High Workload**
- Builder minimum: 2
- Builder maximum: 5
- Pending build tasks: 20
- Scaling factor: 4
- Calculated target: max(2, min(ceil(20/4), 5)) = max(2, min(5, 5)) = 5
- Result: 5 builders (at maximum)

**Scenario 3: Very High Workload**
- Builder minimum: 2
- Builder maximum: 5
- Pending build tasks: 100
- Scaling factor: 4
- Calculated target: max(2, min(ceil(100/4), 5)) = max(2, min(25, 5)) = 5
- Result: 5 builders (capped at maximum)

## Flag Command Integration

Attack flags and other flag commands dynamically increase workforce targets:

### Attack Flag Processing

When attack flags are placed:

1. `FlagCommandInterpreter` parses flag colors and stores commands in `Memory.combat.attackQueue`
2. `RoleControllerManager` checks for pending attack requests
3. Attacker target minimum is increased based on flag count
4. Attackers spawn up to the configured maximum

```typescript
// Attack flag handling in spawn loop
if (role === "attacker" && needsAttackers) {
  let neededAttackers = 0;
  for (const attackRequest of pendingAttacks) {
    const assigned = assignedAttackersByTarget.get(attackRequest.targetRoom) ?? 0;
    neededAttackers += Math.max(0, ATTACKERS_PER_ATTACK_FLAG - assigned);
  }
  targetMinimum = Math.max(targetMinimum, Math.min(neededAttackers, roleMaximum));
}
```

**Constants:**
- `ATTACKERS_PER_ATTACK_FLAG = 2` - Attackers spawned per attack flag

### Other Flag Commands

| Flag Color | Command Type | Role Affected |
|------------|--------------|---------------|
| Red | ATTACK | attacker |
| Blue | CLAIM | claimer |
| Green | REMOTE_MINE | remoteHauler |
| Purple | DEFEND | attacker, healer |
| White | SCOUT | scout |

## Maximum Enforcement

The spawn loop enforces maximum constraints before spawning:

```typescript
// Enforce maximum constraint: never exceed role maximum
if (current >= roleMaximum) {
  continue; // Already at max capacity for this role
}

if (current >= targetMinimum) {
  continue; // Already satisfied minimum requirement
}

// Proceed with spawning...
```

## Spawn Priority Order

Roles are spawned in priority order. The system maintains established priorities while respecting min/max constraints:

### Normal Mode Priority
1. harvester
2. upgrader
3. builder
4. stationaryHarvester
5. hauler
6. repairer
7. remoteUpgrader
8. remoteHauler
9. remoteBuilder
10. scout
11. attacker
12. healer
13. dismantler
14. claimer

### Combat Mode Priority
When room is under attack:
1. harvester
2. attacker
3. healer
4. repairer
5. hauler
6. builder
7. (remaining roles)

## Expected Behavior

### Low Task Load
- Workforce stays at minimum for each role
- Energy is conserved for other uses
- Efficient creep lifecycle

### High Task Load
- Workforce scales up toward maximum
- Tasks are completed faster
- Automatic scale-down as tasks complete (creeps die naturally)

### Combat Situations
- Attackers/healers spawn up to configured maximums
- Upgrader minimum reduced to free energy for combat
- Repairer minimum increased for structure maintenance

## Resource Management

The system provides several resource management benefits:

1. **Prevents over-spawning**: Maximum caps ensure creep counts stay reasonable
2. **Maintains baseline operation**: Minimum guarantees keep essential roles filled
3. **Efficient energy use**: Spawn only when needed based on actual workload
4. **Automatic recovery**: Workforce returns to minimum as workload decreases

## Testing

The system is validated by regression tests in:
- `tests/regression/dynamic-workforce-scaling.test.ts`
- `tests/regression/role-controller-manager-spawning.test.ts`

### Key Test Scenarios

1. **Min/max configuration** - Validates role controllers have proper limits
2. **Minimum enforcement** - Spawning occurs when below minimum
3. **Maximum enforcement** - No spawning when at maximum
4. **Task-based scaling** - Workforce increases with pending tasks
5. **Attack flag integration** - Attack flags trigger attacker spawning
6. **Priority order** - Harvesters always spawn first

## Related Documentation

- [Role Balancing](./role-balancing.md) - Dynamic role minimum calculation
- [Flag Commands](./flag-commands.md) - Flag command system
- [Task Queue System](./task-queue-system.md) - Task management
- [Spawn Management](./operations/spawn-management.md) - Core spawn system

## References

- **Issue #1484**: Dynamic min/max workforce scaling system implementation
- **PR**: feat(runtime): implement dynamic min/max workforce scaling system
