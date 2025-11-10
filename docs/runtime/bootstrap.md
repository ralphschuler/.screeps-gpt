# Bootstrap Phase

The bootstrap phase is an automated first-room resource optimization system that ensures optimal energy collection efficiency during initial room establishment.

## Overview

When starting a new room or recovering from respawn, the AI automatically enters **bootstrap mode** to prioritize harvester spawning and energy infrastructure development. This phase focuses on:

- Maximum harvester spawning (80%+ of creep population)
- Rapid energy collection from sources
- Quick progression to controller level 2
- Stable spawn energy supply

## Activation Criteria

Bootstrap phase activates automatically when:

1. **First run**: No bootstrap tracking exists in Memory
2. **Low controller level**: Controller level is below target (default: 2)
3. **Minimal infrastructure**: Room lacks stable energy production

## Operation

### Role Distribution

During bootstrap phase, role minimums are adjusted:

| Role      | Normal Minimum | Bootstrap Minimum | Change |
| --------- | -------------- | ----------------- | ------ |
| Harvester | 4              | 6                 | +50%   |
| Upgrader  | 3              | 1                 | -67%   |
| Builder   | 2              | 0                 | -100%  |

This distribution ensures **80%+ harvesters** during the critical early game period.

### Behavior Priorities

1. **Energy collection**: Harvesters saturate energy sources quickly
2. **Spawn supply**: Priority delivery to spawns and extensions
3. **Controller upgrade**: Harvesters upgrade controller when spawn energy is full
4. **Minimal building**: Delayed until stable energy flow is established

## Completion Criteria

Bootstrap phase exits when **any** of the following conditions are met:

### Criteria 1: Controller Level (Primary)

- Controller reaches target level (default: **level 2**)
- Indicates sufficient progress and infrastructure development

### Criteria 2: Stable Infrastructure (Secondary)

All of the following must be true:

- Minimum harvester count reached (default: **4 harvesters**)
- Stable energy available (default: **300 energy**)
- Energy capacity indicates extensions are built

## Configuration

Bootstrap behavior can be customized via `BootstrapConfig`:

```typescript
interface BootstrapConfig {
  /** Controller level required to exit bootstrap phase (default: 2) */
  targetControllerLevel?: number;

  /** Minimum harvester count required to exit bootstrap (default: 4) */
  minHarvesterCount?: number;

  /** Minimum energy available to consider room stable (default: 300) */
  minEnergyAvailable?: number;
}
```

### Example: Custom Configuration

```typescript
const kernel = new Kernel({
  bootstrapManager: new BootstrapPhaseManager({
    targetControllerLevel: 3, // Extend bootstrap until level 3
    minHarvesterCount: 6, // Require 6 harvesters for stability
    minEnergyAvailable: 500 // Require 500 energy buffer
  })
});
```

## Memory Tracking

Bootstrap state is tracked in `Memory.bootstrap`:

```typescript
interface Memory {
  bootstrap?: {
    isActive: boolean; // Current bootstrap status
    startedAt?: number; // Tick when bootstrap started
    completedAt?: number; // Tick when bootstrap completed
  };
}
```

### Persistence

- Bootstrap completion is **permanent** per room
- Once completed, bootstrap will not reactivate
- Memory persists across code reloads and global resets

## Integration Points

### Kernel Integration

The `Kernel` checks bootstrap status each tick:

```typescript
// Check and manage bootstrap phase
const bootstrapStatus = this.bootstrapManager.checkBootstrapStatus(game, memory);
if (bootstrapStatus.shouldTransition && bootstrapStatus.reason) {
  this.bootstrapManager.completeBootstrap(game, memory, bootstrapStatus.reason);
}

// Pass bootstrap flag to behavior controller
const behaviorSummary = this.behavior.execute(game, memory, roleCounts, bootstrapStatus.isActive);
```

### BehaviorController Integration

The `BehaviorController` adjusts spawn priorities based on bootstrap flag:

```typescript
private ensureRoleMinimums(
  game: GameContext,
  memory: Memory,
  roleCounts: Record<string, number>,
  spawned: string[],
  isBootstrapPhase: boolean
): void {
  // Adjust role minimums for bootstrap phase
  const bootstrapMinimums = isBootstrapPhase
    ? { harvester: 6, upgrader: 1, builder: 0 }
    : {};

  // Apply bootstrap or normal minimums
  for (const [role, definition] of Object.entries(ROLE_DEFINITIONS)) {
    const targetMinimum = bootstrapMinimums[role] ?? definition.minimum;
    // ... spawn logic
  }
}
```

## Expected Behavior

### Early Game Timeline

| Tick Range | Bootstrap Status | Expected Behavior                         |
| ---------- | ---------------- | ----------------------------------------- |
| 0-50       | Active           | Spawn 6 harvesters rapidly                |
| 50-200     | Active           | Saturate energy sources, build extensions |
| 200-300    | Active           | Approach controller level 2               |
| 300+       | Completed        | Transition to normal role distribution    |

### Success Metrics

Successful bootstrap phase should achieve:

- **Faster controller progression**: Level 2 reached in ~300-400 ticks
- **Higher energy efficiency**: 80%+ collection rate from sources
- **Smooth transition**: Minimal downtime when switching to normal operations

## Monitoring

### Console Logging

Bootstrap phase transitions are logged:

```
[Bootstrap] Bootstrap phase activated - prioritizing harvester spawning
[Bootstrap] Bootstrap phase completed after 250 ticks. Reason: Controller reached level 2. Transitioning to normal operations.
```

### Evaluation System

The evaluation system can be extended to track bootstrap metrics:

- Bootstrap duration (ticks from start to completion)
- Energy collection efficiency during bootstrap
- Time to controller level 2 comparison

## Testing

Bootstrap phase behavior is validated with comprehensive unit tests:

```typescript
describe("BootstrapPhaseManager", () => {
  it("should activate bootstrap for new room with low controller level", () => {
    const manager = new BootstrapPhaseManager();
    const game = createGameContext({ time: 100, controllerLevel: 1 });
    const memory = {} as Memory;

    const status = manager.checkBootstrapStatus(game, memory);
    expect(status.isActive).toBe(true);
  });

  it("should complete bootstrap when controller reaches target level", () => {
    // ... test implementation
  });
});
```

Run bootstrap tests:

```bash
npm run test:unit -- bootstrapPhaseManager.test.ts
```

## Troubleshooting

### Bootstrap Never Activates

**Symptoms**: New room does not enter bootstrap mode

**Causes**:

- Controller already at or above target level
- Memory already has bootstrap completion flag set
- Room has no controller or controller not owned

**Solutions**:

1. Verify controller level is below target: `Memory.bootstrap = undefined`
2. Reset bootstrap tracking: `delete Memory.bootstrap`
3. Check room ownership: `room.controller?.my === true`

### Bootstrap Never Completes

**Symptoms**: Bootstrap remains active for extended period

**Causes**:

- Insufficient harvesters being spawned
- Energy sources not being saturated
- Configuration thresholds too high

**Solutions**:

1. Check harvester spawn rate: Monitor `Memory.roles.harvester`
2. Verify energy collection: Check spawn energy levels
3. Adjust configuration: Lower `targetControllerLevel` or `minHarvesterCount`
4. Review spawn availability: Ensure spawns not blocked

### Transition Instability

**Symptoms**: Performance drop after bootstrap completion

**Causes**:

- Too aggressive transition criteria
- Insufficient energy buffer before transition
- Upgrader/builder minimums too low for sustained operation

**Solutions**:

1. Increase `minEnergyAvailable` threshold
2. Ensure extensions are built before transition
3. Verify normal role minimums are appropriate for room size

## Related Documentation

- [Creep Roles](./strategy/creep-roles.md) - Role behavior documentation
- [Task System](./strategy/task-management.md) - Task-based alternative to role system
- [Memory Management](./memory-management.md) - Memory structure and persistence
- [Base Building](./base-building.md) - Construction planning and infrastructure

## Version History

- **v0.43.3**: Bootstrap phase implementation
  - Automated first-room resource optimization
  - Harvester prioritization during early game
  - Controller level and stability-based completion criteria
