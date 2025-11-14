# Creep Lifecycle Management

This document describes the lifecycle management features for creeps, including energy dropping behavior for dying creeps to minimize resource waste.

## Dying Creep Energy Dropping

### Overview

When creeps approach the end of their lifecycle (low `ticksToLive`), they automatically drop all carried energy at their current position. This prevents energy from being destroyed when the creep despawns, making it available for other creeps to collect and use.

### Configuration

The dying creep behavior is controlled via Memory configuration:

```typescript
Memory.dyingCreepBehavior = {
  enabled: true, // Enable/disable energy dropping (default: true)
  ttlThreshold: 50 // TTL threshold in ticks (default: 50)
};
```

**Parameters:**

- `enabled` (boolean, default: `true`): When `true`, dying creeps will drop energy. Set to `false` to disable this behavior.
- `ttlThreshold` (number, default: `50`): The number of ticks remaining before a creep is considered "dying". When a creep's `ticksToLive` falls below this value, it will drop its energy.

### Behavior Details

**Dying Creep Detection:**

1. On each tick, the BehaviorController checks each creep's `ticksToLive`
2. If `ticksToLive < ttlThreshold` and the creep carries energy, it triggers the drop behavior
3. The creep drops all carried energy at its current position
4. Visual feedback: The creep displays a "💀" emoji

**Integration Points:**

- Works with both task-based and role-based execution systems
- Executes before role/task assignment (dying creeps skip normal behavior)
- Compatible with all creep roles (harvester, upgrader, builder, etc.)

**Energy Recovery:**

- Dropped energy appears as a `Resource` object on the ground
- Other creeps (haulers, upgraders, builders) can pick up the dropped energy
- Energy remains available until picked up or decays naturally (very slow decay for energy)

### Performance Impact

**CPU Efficiency:**

- Single threshold check per creep per tick (~0.01 CPU per creep)
- Dying creeps skip normal role execution, saving CPU
- Total overhead: <0.5% of CPU budget in typical scenarios

### Use Cases

**Normal Operation:**

```typescript
// Default configuration - enabled with 50 tick threshold
// No manual setup required, works out of the box
```

**Extended Threshold for Remote Miners:**

```typescript
// Give remote miners more time to return home
Memory.dyingCreepBehavior = {
  enabled: true,
  ttlThreshold: 100 // Drop energy at 100 ticks remaining
};
```

**Disable for Specific Scenarios:**

```typescript
// Disable energy dropping temporarily
Memory.dyingCreepBehavior = {
  enabled: false
};
```

### Visual Indicators

Dying creeps display visual feedback:

- 💀 emoji when dropping energy
- Can be monitored in game for debugging

### Testing

The feature includes comprehensive test coverage:

**Unit Tests** (`tests/unit/creepHelpers.test.ts`):

- Dying detection with various TTL values
- Energy drop success/failure scenarios
- Custom threshold handling
- Edge cases (TTL = 0, no energy, etc.)

**Integration Tests** (`tests/unit/behaviorController.test.ts`):

- Role-based system integration
- Task-based system integration
- Configuration handling (enabled/disabled)
- Custom threshold from Memory
- Skip role execution for dying creeps

### Implementation Details

**Source Files:**

- `packages/bot/src/runtime/behavior/creepHelpers.ts`: Core helper functions
  - `isCreepDying(creep, threshold)`: Checks if creep is dying
  - `handleDyingCreepEnergyDrop(creep)`: Handles energy drop logic
- `packages/bot/src/runtime/behavior/BehaviorController.ts`: Integration point
  - Pre-execution checks in both `executeWithTaskSystem()` and `executeWithRoleSystem()`

**Memory Schema:**

- Configuration stored in `Memory.dyingCreepBehavior`
- See `types.d.ts` for TypeScript interface definition

### Best Practices

1. **Keep Default Settings**: The default threshold of 50 ticks works well for most scenarios
2. **Monitor Energy Loss**: Track dropped energy pickup rates to ensure haulers are efficient
3. **Adjust for Remote Operations**: Increase threshold for creeps operating far from spawn
4. **Coordinate with Haulers**: Ensure hauler coverage is adequate to collect dropped energy
5. **Emergency Energy Supply**: Dropped energy provides emergency resources during creep die-offs

### Related Features

- **Hauler System**: Collects dropped energy from dying creeps
- **Energy Priority Manager**: Coordinates energy distribution and pickup
- **Task System**: Manages energy pickup tasks for idle creeps
- **Creep Communication**: Visual indicators for dying state

### Future Enhancements

Potential improvements (not yet implemented):

- Per-role threshold configuration
- Smart drop location (move to spawn/storage before dropping)
- Emergency creep replacement triggers
- Analytics for energy waste reduction metrics

### Troubleshooting

**Energy Not Being Dropped:**

1. Check `Memory.dyingCreepBehavior.enabled` is `true`
2. Verify `ticksToLive` is below threshold
3. Ensure creep has energy to drop
4. Check console for error messages

**Energy Not Being Collected:**

1. Verify haulers are spawned and active
2. Check hauler task priorities
3. Ensure energy drop location is accessible
4. Monitor CPU budget (haulers may be skipped if CPU limited)

**Unexpected Behavior:**

1. Review configuration in Memory
2. Check for custom threshold overrides
3. Verify task system is enabled correctly
4. Run unit tests to validate implementation

## Related Documentation

- [Energy Management](./energy-management.md)
- [Task System](./task-system.md)
- [Creep Communication](./creep-communication.md)
- [Memory Management](./memory-management.md)
