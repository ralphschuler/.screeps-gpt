# Death Spiral Prevention

This document describes the death spiral failure mode and the safeguards in place to prevent it.

## What is a Death Spiral?

A death spiral occurs when the bot loses all creeps and cannot recover because:

1. **No energy income**: Without harvesters, energy doesn't flow from sources
2. **No spawn capability**: Without energy, spawns can't create new creeps  
3. **System deadlock**: No creeps → no energy → no spawns → no creeps

The result is a bot that sits idle with 0 creeps for extended periods (days) despite having functional spawns and available energy sources.

## Root Causes

### Primary: Energy Logistics Failure (Issue #1564, #1575)

The stationary harvester state machine was broken - it only had one state (`harvesting`) and never transitioned to `depositing`. While the controller code attempted to transfer energy, the state machine didn't properly track state transitions, leading to:

- Harvesters mining energy but not depositing it properly
- Containers staying empty or energy being lost
- Haulers having nothing to collect
- Spawns starving for energy

**Fix**: The stationary harvester state machine now has proper states (`harvesting`, `depositing`) and transitions (`ENERGY_FULL`, `ENERGY_EMPTY`, `CONTAINER_FULL`).

### Secondary: Emergency Spawn Not Triggering

Previous issues (#1472, #1349, #1327, #1282, #1240, #1218) addressed emergency spawn logic, but the root cause was the energy flow problem described above.

## Prevention Safeguards

### Layer 1: Pre-Tick Emergency Guard (main.ts)

When `Object.keys(Game.creeps).length === 0`, the `RoleControllerManager.ensureRoleMinimums()` triggers emergency spawn mode:

```typescript
if (isEmergency) {
  this.logger.log?.(`[EMERGENCY] Total workforce collapse detected - forcing minimal spawn`);
  const result = this.attemptEmergencyHarvesterSpawn(game, spawned, roleCounts, "EMERGENCY", "emergency");
  // ...
}
```

### Layer 2: Minimal Body Composition (BodyComposer.ts)

Emergency spawns use the smallest viable body:

- Minimum body: `[WORK, CARRY, MOVE]`
- Cost: 200 energy (spawn minimum)
- Allows recovery from very low energy states

### Layer 3: Harvester Priority Check

When no harvesters exist but other creeps do, harvester spawning is prioritized:

```typescript
if (harvesterCount === 0 && totalCreeps > 0) {
  this.logger.log?.(`[CRITICAL] No harvesters alive - forcing harvester priority spawn`);
  // ...
}
```

### Layer 4: Proper Energy Flow (Stationary Harvester Fix)

The stationary harvester state machine now properly tracks:

1. **harvesting** state: Mining energy from source
2. **depositing** state: Transferring energy to container
3. **Parallel operation**: When adjacent to both source and container, harvest and deposit simultaneously

## Monitoring

### Signs of Impending Death Spiral

1. **Creep count dropping**: Watch for declining workforce
2. **Container energy at 0**: Energy not flowing from harvesters
3. **Spawns idle with energy available**: Tasks not being discovered
4. **CPU very low** (< 1): Nothing is happening

### Alerts

The monitoring system tracks:

- `Memory.stats.creeps.count` - Total creep count
- `Memory.stats.rooms.{roomName}.energyAvailable` - Spawn energy
- Container energy levels

## Recovery Procedure

If a death spiral occurs:

1. **Wait for emergency spawn**: System should auto-recover within 50 ticks
2. **Check energy**: Ensure spawn has at least 200 energy
3. **Check spawn**: Ensure spawn is not busy/damaged
4. **Manual intervention**: If auto-recovery fails:
   - Use console: `Game.spawns['Spawn1'].spawnCreep([WORK, CARRY, MOVE], 'emergency-harvester')`
   - Verify creep is created and harvesting

## Related Issues

- #1564 - RECURRING death spiral (this fix)
- #1575 - Stationary harvester state machine broken
- #1472 - Emergency spawn logic improvements
- #1349, #1327, #1282, #1240, #1218 - Previous death spiral incidents

## Related Documentation

- [Spawn Recovery Automation](./spawn-recovery-automation.md)
- [Respawn Handling](./respawn-handling.md)
- [Behavior Migration Guide](./behavior-migration-guide.md)
