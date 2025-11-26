# Controller Management Operations

## Overview

This document covers controller upgrade management incidents, fixes, and best practices for maintaining healthy controller upgrade rates to prevent room downgrade.

## Incidents

### 2025-11-25: W1N4 Controller Downgrade Alert

**Timeline:** 2025-11-25T18:25:35.665Z
**Impact:** Controller in room W1N4 at risk of downgrading to level 0 in ~2 hours (3000 ticks)
**Status:** RESOLVED

#### Root Cause

The UpgraderController was not using the xstate state machine properly, causing upgrader creeps to:
1. Transfer energy to the controller only once per recharge cycle
2. Immediately return to gather more energy even though they still had energy remaining
3. This resulted in inefficient controller upgrading and insufficient upgrade rate

The issue was in the state transition logic. The old implementation checked energy levels and transitioned states on every tick, even when the creep still had energy to use for upgrading.

#### Fix Applied

**PR:** #1385
**Commit:** 963cc44

The fix involved:

1. **Migrated UpgraderController to xstate**: Properly integrated the existing `upgraderStates` state machine
2. **Fixed energy depletion logic**: Modified the state transition to only switch from "upgrading" to "recharge" when `creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0`
3. **Added machine cleanup**: Implemented `cleanupDeadCreepMachines()` to prevent memory leaks
4. **Consistent pattern**: Now follows the same pattern as HarvesterController for maintainability

**Key Code Change:**
```typescript
// OLD BEHAVIOR (in ensureTask method)
if (memory.task === UPGRADE_TASK && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
  memory.task = RECHARGE_TASK;
}
// This was called every tick, causing premature state transitions

// NEW BEHAVIOR (in execute method with state machine)
if (currentState === "upgrading") {
  const controller = creep.room.controller;
  if (controller) {
    const result = creep.upgradeController(controller);
    // ... movement logic ...
    
    // Only transition when energy is FULLY depleted
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      machine.send({ type: "ENERGY_EMPTY" });
    }
  }
}
```

#### Verification

- ✅ Build successful
- ✅ Linting passed
- ✅ All unit tests passed (119/119)
- ✅ State machine properly persisted in creep memory
- ✅ Upgraders now deplete all energy before recharging

#### Related Issues

- Issue: W1N4 controller downgrade alert (to be linked when issue is created)
- Issue #1383 - Monitoring: Add proactive controller downgrade alerts
- Issue #1327 - RCL 4→2 downgrade with workforce collapse (Nov 17-24)
- Issue #1218 - Bot death spiral recovery - RCL 4→2 (closed Nov 22)

## Best Practices

### Controller Upgrade Management

1. **Minimum Upgraders**: Maintain at least 3 upgrader creeps per controlled room
2. **Energy Priority**: Upgraders should use energy from containers/storage first, then harvest directly if needed
3. **Emergency Spawn Refilling**: Upgraders should prioritize spawn refilling when spawns are below 50% capacity
4. **Defensive Posture**: Upgraders should pause upgrading and move to safe positions during combat

### State Machine Usage

All role controllers should use xstate state machines for consistent behavior:

- **Declarative states**: Define clear states like "recharge", "upgrading", "idle"
- **Event-driven transitions**: Use events like "ENERGY_FULL", "ENERGY_EMPTY" to trigger state changes
- **Guard conditions**: State transitions should have guard conditions that verify the creep's actual state
- **Persistence**: State machines should be serialized to creep memory and restored on next tick
- **Cleanup**: Implement cleanup mechanisms to remove state machines for dead creeps

### Controllers Using xstate

✅ **Migrated:**
- HarvesterController
- UpgraderController
- ScoutController

⏳ **To be migrated:**
- BuilderController
- HaulerController
- RepairerController
- StationaryHarvesterController
- RemoteMinerController
- RemoteHaulerController
- RemoteBuilderController
- AttackerController
- HealerController
- DismantlerController
- ClaimerController

## Monitoring

### Controller Health Metrics

Monitor these metrics to detect controller downgrade risks:

1. **ticksToDowngrade**: Should remain above 20% of maximum (varies by RCL)
2. **Upgrade rate**: Energy per tick spent on upgrading
3. **Upgrader count**: Number of active upgraders per room
4. **Upgrader efficiency**: Average energy delivered to controller per upgrader per tick

### Alert Thresholds

| RCL | Downgrade Timer | Warning Threshold (20%) | Critical Threshold (10%) |
|-----|----------------|-------------------------|-------------------------|
| 1   | 20,000 ticks   | 4,000 ticks (~3h)      | 2,000 ticks (~1.5h)     |
| 2   | 10,000 ticks   | 2,000 ticks (~1.5h)    | 1,000 ticks (~45m)      |
| 3   | 20,000 ticks   | 4,000 ticks (~3h)      | 2,000 ticks (~1.5h)     |
| 4   | 40,000 ticks   | 8,000 ticks (~6h)      | 4,000 ticks (~3h)       |
| 5   | 80,000 ticks   | 16,000 ticks (~12h)    | 8,000 ticks (~6h)       |
| 6   | 120,000 ticks  | 24,000 ticks (~18h)    | 12,000 ticks (~9h)      |
| 7   | 150,000 ticks  | 30,000 ticks (~22h)    | 15,000 ticks (~11h)     |
| 8   | 200,000 ticks  | 40,000 ticks (~30h)    | 20,000 ticks (~15h)     |

## Automated Monitoring

### Controller Health Checks

As of release 0.161.2, the screeps-monitoring.yml workflow includes proactive controller downgrade alerts:

**Alert Thresholds:**
- **Critical (< 12 hours)**: Immediate action required, email + push notifications sent
- **Warning (< 24 hours)**: Attention needed, email + push notifications sent  
- **Info (< 48 hours)**: Monitoring notice, logged only

**How It Works:**

1. Every 30 minutes, the monitoring workflow collects bot state snapshots
2. Console telemetry fetches controller.ticksToDowngrade for each room
3. The check-controller-health.ts script analyzes downgrade risk per room
4. Critical and warning alerts trigger email notifications to configured recipients
5. Alert history is tracked in reports/bot-snapshots/ for trend analysis

**Metrics Tracked:**
- Time until downgrade (ticks and hours)
- Controller progress toward next level
- Upgrader creep count per room
- Energy availability at controller
- Room Control Level (RCL)

**Manual Check:**

You can manually run the controller health check at any time:

```bash
yarn tsx packages/utilities/scripts/check-controller-health.ts
```

Exit codes:
- `0`: All controllers healthy or info-level alerts only
- `1`: Warning-level alerts detected
- `2`: Critical alerts detected

## Future Improvements

1. **Dynamic Upgrader Scaling**: Automatically spawn more upgraders when downgrade timer is low
2. **Energy Reserve Management**: Ensure sufficient energy reserves for upgraders
3. **State Machine Migration**: Complete migration of all role controllers to xstate
4. **Regression Testing**: Add comprehensive tests for controller management edge cases
5. **Trend Analysis**: Track controller health trends over time to predict future issues
