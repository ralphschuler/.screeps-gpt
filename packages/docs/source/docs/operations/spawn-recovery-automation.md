---
title: Spawn Recovery Automation
date: 2025-11-24T19:25:00.000Z
---

# Autonomous Spawn Recovery System

## Overview

The Screeps bot implements a comprehensive autonomous spawn recovery system to handle spawn loss incidents without manual intervention. This system includes automatic detection, respawn triggering, spawn placement, and circuit breaker protection.

## Architecture

### Components

1. **Bot Aliveness Check** (`check-bot-aliveness.ts`)
   - Monitors bot lifecycle state via Memory.stats and console API
   - Distinguishes between active, respawn_needed, spawn_placement_needed, and unknown states
   - Runs as part of scheduled monitoring workflow

2. **Autospawn Script** (`screeps-autospawn.ts`)
   - Handles automatic respawn triggering and spawn placement
   - Integrates with Screeps API for world status and spawn placement
   - Implements intelligent room selection and terrain analysis

3. **Circuit Breaker** (`spawn-recovery-tracker.ts`)
   - Prevents infinite spawn placement loops
   - Limits automatic recovery to 3 attempts per 24-hour window
   - Tracks all recovery attempts with detailed audit trail

4. **Spawn Monitor Workflow** (`.github/workflows/screeps-spawn-monitor.yml`)
   - Runs every 30 minutes via scheduled cron
   - Orchestrates detection → recovery → notification flow
   - Escalates to GitHub issues when circuit breaker activates

## Recovery Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Scheduled Check (every 30 minutes)                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Check Circuit Breaker                                    │
│    • Are we within 3 attempts per 24h limit?                │
│    • Is circuit breaker active from previous failures?      │
└────────────────────┬────────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
     [BLOCKED]             [ALLOWED]
          │                     │
          ▼                     ▼
┌──────────────────┐  ┌─────────────────────────────────────┐
│ Escalate to      │  │ 2. Check World Status               │
│ GitHub Issue     │  │    • API: /api/user/world-status    │
│ Circuit Breaker  │  │    • Status: normal/lost/empty      │
│ Manual Required  │  └────────────┬────────────────────────┘
└──────────────────┘               │
                        ┌──────────┴──────────┐
                        │                     │
                   [NORMAL]              [LOST/EMPTY]
                        │                     │
                        ▼                     ▼
              ┌────────────────┐   ┌─────────────────────────┐
              │ No Action      │   │ 3. Perform Recovery     │
              │ Bot Active     │   │    • Trigger respawn    │
              └────────────────┘   │    • Select room        │
                                   │    • Analyze terrain    │
                                   │    • Place spawn        │
                                   └──────────┬──────────────┘
                                              │
                                   ┌──────────┴──────────┐
                                   │                     │
                              [SUCCESS]            [FAILURE]
                                   │                     │
                                   ▼                     ▼
                        ┌─────────────────┐   ┌──────────────────┐
                        │ Record Success  │   │ Record Failure   │
                        │ Reset Breaker   │   │ Increment Count  │
                        │ Send Success    │   │ Check Threshold  │
                        │ Notification    │   │ Send Alert       │
                        └─────────────────┘   └──────────────────┘
```

## Circuit Breaker Logic

### Purpose

Prevents infinite loops caused by:
- Persistent API failures
- Invalid spawn placement coordinates
- Server-side issues preventing spawn placement
- Configuration errors

### Behavior

**Threshold**: 3 failed attempts within 24-hour rolling window

**Activation Conditions**:
- 3 consecutive failed spawn placement attempts
- 3 failed attempts within 24 hours (not necessarily consecutive)

**When Active**:
- All automatic spawn recovery attempts blocked
- Escalation issue created in GitHub repository
- Manual intervention required
- Circuit breaker remains active for 24 hours

**Deactivation**:
- Automatic: Successful spawn placement resets circuit breaker
- Manual: `yarn tsx packages/utilities/scripts/reset-circuit-breaker.ts`
- Timeout: 24 hours after activation

## Monitoring and Logging

### Attempt Tracking

All spawn recovery attempts are logged to `reports/spawn-recovery/`:

**State File** (`recovery-state.json`):
```json
{
  "attempts": [
    {
      "timestamp": "2025-11-24T19:25:00.000Z",
      "tick": 1000,
      "status": "lost",
      "action": "respawned",
      "roomName": "E45S25",
      "shardName": "shard3",
      "source": "spawn_monitor"
    }
  ],
  "lastSuccessfulRecovery": "2025-11-24T19:25:00.000Z",
  "circuitBreakerActive": false
}
```

**Individual Attempt Files** (`attempt-{timestamp}.json`):
- One file per attempt for audit trail
- Includes full context: status, action, room, shard, error details

### Recovery Statistics

Query current recovery stats:
```typescript
import { getRecoveryStats } from "@utilities/scripts/spawn-recovery-tracker";

const stats = await getRecoveryStats();
console.log(`Total attempts: ${stats.totalAttempts}`);
console.log(`Recent attempts: ${stats.recentAttempts}`);
console.log(`Circuit breaker: ${stats.circuitBreakerActive}`);
```

## Manual Intervention Procedures

### When Circuit Breaker Activates

1. **Immediate Response**:
   - Check escalation issue created by workflow
   - Log into Screeps web interface: https://screeps.com
   - Manually place spawn in suitable room

2. **Investigation**:
   - Review spawn recovery logs: `reports/spawn-recovery/`
   - Check recent workflow runs for failure patterns
   - Identify root cause (API issues, terrain problems, etc.)

3. **Resolution**:
   - Fix underlying issue if identified
   - Reset circuit breaker: `yarn tsx packages/utilities/scripts/reset-circuit-breaker.ts`
   - Monitor next scheduled check for successful recovery

### Manual Spawn Placement

If automatic placement fails repeatedly:

1. **Select Room**:
   - Log into https://screeps.com
   - Navigate to respawn/world start screen
   - Review candidate rooms (consider energy sources, terrain, neighbors)

2. **Place Spawn**:
   - Choose central location with accessible energy sources
   - Avoid walls and edges
   - Confirm placement

3. **Verify Bot Operation**:
   - Wait 5-10 minutes for bot initialization
   - Check Memory.stats for creep spawning
   - Monitor workflow for successful status detection

### Reset Circuit Breaker

After manual spawn placement:

```bash
yarn tsx packages/utilities/scripts/reset-circuit-breaker.ts
```

**Important**: Only reset after confirming:
- Spawn has been manually placed
- Bot is operational and spawning creeps
- Root cause has been identified and addressed (if possible)

## Notification System

### Push Notifications

Sent for all critical events:

**Spawn Loss Detected** (Priority 5):
- Bot lost all spawns
- Automatic respawn initiated

**Spawn Placed** (Priority 4):
- Automatic spawn placement successful
- Bot should initialize within 60 minutes

**Circuit Breaker Active** (Priority 5):
- Too many failed attempts
- Manual intervention required

**Recovery Failure** (Priority 5):
- Automatic recovery failed
- Check logs and escalation issue

### GitHub Issues

**Escalation Issue Created When**:
- Circuit breaker activates
- Issue remains open until manual resolution
- Updates added for each subsequent blocked attempt

**Issue Content**:
- Circuit breaker expiry timestamp
- Workflow run links
- Manual intervention procedures
- Reset instructions

## Testing

### Unit Tests

**Location**: `tests/regression/spawn-recovery-circuit-breaker.test.ts`

**Coverage**:
- Attempt recording and tracking
- Circuit breaker threshold logic
- Manual reset functionality
- Statistics calculation
- Audit trail generation

**Run Tests**:
```bash
yarn test:regression spawn-recovery-circuit-breaker
```

### Integration Testing

**Manual Testing in PTR**:

1. Trigger respawn manually in PTR environment
2. Observe automatic detection and recovery
3. Verify spawn placement in suitable room
4. Confirm bot initialization

**Circuit Breaker Testing**:

1. Trigger circuit breaker with 3 failed attempts (simulation required)
2. Verify workflow creates escalation issue
3. Test manual reset procedure
4. Confirm next attempt allowed after reset

## Operational Metrics

### Key Performance Indicators

**Mean Time to Recovery (MTTR)**:
- Target: < 15 minutes
- Measured from spawn loss detection to bot initialization
- Includes: detection interval (30min max) + recovery time (5-10min)

**Recovery Success Rate**:
- Target: > 95%
- Successful automatic recoveries / Total spawn loss incidents
- Excludes circuit breaker activations

**Circuit Breaker Activation Rate**:
- Target: < 5% of incidents
- Indicates persistent issues requiring investigation

### Monitoring Dashboard

View recovery statistics:
```bash
yarn tsx packages/utilities/scripts/spawn-recovery-tracker.ts --stats
```

## Maintenance

### Log Cleanup

Old attempts automatically cleaned up (> 30 days):
```bash
yarn tsx packages/utilities/scripts/spawn-recovery-tracker.ts --cleanup
```

Cleanup runs automatically in scheduled maintenance workflows.

### State Management

**State File Location**: `reports/spawn-recovery/recovery-state.json`

**Backup**: Included in repository reports (not committed to git)

**Reset**: Delete state file to clear all history (use with caution)

## Future Enhancements

### Phase 2 Improvements

1. **Multi-Shard Support**:
   - Track recovery per shard
   - Shard-specific circuit breakers
   - Cross-shard spawn placement strategies

2. **Advanced Room Scoring**:
   - Compare multiple candidate rooms
   - Score based on: sources, minerals, neighbors, sector
   - Select optimal room automatically

3. **Predictive Detection**:
   - Detect imminent spawn loss (low health, hostile activity)
   - Preemptive spawn placement before total loss

4. **Recovery Orchestration**:
   - Coordinate recovery across multiple shards
   - Prioritize shard recovery based on strategic value

## Related Documentation

- [Respawn Handling](./respawn-handling.md) - Runtime respawn detection
- [Bot Aliveness Monitoring](../../automation/bot-aliveness-monitoring.md) - Detection mechanisms
- [Workflow Architecture](../../automation/overview.md) - Automation infrastructure

## Troubleshooting

### Common Issues

**Issue**: Circuit breaker activates frequently
- **Cause**: Underlying API or configuration problem
- **Solution**: Investigate recent failure patterns, check API status, verify credentials

**Issue**: Spawn placed in poor location
- **Cause**: Terrain analysis heuristic limitations
- **Solution**: Manual placement, enhance room scoring algorithm

**Issue**: Bot doesn't initialize after spawn placement
- **Cause**: Code deployment issues, runtime errors
- **Solution**: Check deployment logs, verify code on server, review runtime errors

**Issue**: False positive spawn loss detection
- **Cause**: Stats collection bugs, API timeouts
- **Solution**: Review aliveness check logic, check Memory.stats consistency

## Support

For issues with autonomous spawn recovery:

1. Check escalation issues in GitHub repository
2. Review spawn recovery logs: `reports/spawn-recovery/`
3. Verify workflow execution: `.github/workflows/screeps-spawn-monitor.yml`
4. Create issue with label `automation` and `priority/critical`
