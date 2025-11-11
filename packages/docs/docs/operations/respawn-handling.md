# Respawn Handling

## Overview

The autonomous Screeps AI includes automatic detection and handling of respawn scenarios. When all spawns are lost (either through hostile action, self-destruction, or other game events), the system must restart in a new location to continue play.

## Detection Mechanism

The `RespawnManager` class monitors the game state on every tick and detects two critical conditions:

1. **Spawn Loss**: All spawns have been destroyed
2. **Complete Loss**: All spawns AND all creeps have been destroyed

## Memory State

When a respawn condition is detected, the system stores state in `Memory.respawn`:

```typescript
interface RespawnState {
  needsRespawn: boolean; // True when all spawns are lost
  lastSpawnLostTick?: number; // Game tick when spawns were first detected as lost
  respawnRequested: boolean; // True when immediate respawn is needed (no creeps either)
}
```

## Detection Flow

1. **Every Tick**: The kernel runs `RespawnManager.checkRespawnNeeded()` before other operations
2. **First Detection**: When spawns are first detected as lost:
   - Sets `needsRespawn = true`
   - Records the current tick in `lastSpawnLostTick`
   - Logs a CRITICAL warning with creep count
3. **Complete Loss Detection**: If spawns are lost AND no creeps remain:
   - Sets `respawnRequested = true`
   - Logs an URGENT warning
4. **Periodic Reminders**: Every 100 ticks, logs a reminder message
5. **Recovery**: When spawns are detected again:
   - Clears all respawn state
   - Logs recovery message
   - Resumes normal operations

## System Integration

### Kernel Behavior

When `needsRespawn` is true, the kernel:

- Skips normal creep and spawn processing
- Still tracks performance metrics
- Still runs system evaluation
- Includes respawn status in evaluation findings

### System Evaluator

The `SystemEvaluator` adds a **CRITICAL** finding when respawn is needed:

- **With Creeps**: Warns that reinforcements cannot be spawned
- **Without Creeps**: Flags as URGENT - immediate action required

The finding includes:

- Clear title: "Respawn required - all spawns lost"
- Detailed situation description
- Actionable recommendation to trigger respawn

## External Automation

The repository includes automated respawn handling through GitHub Actions:

### Screeps Spawn Monitor Workflow

The `screeps-spawn-monitor.yml` workflow runs every 30 minutes and:

1. **Checks spawn status** via the Screeps API (`/api/user/world-status`)
2. **Detects spawn loss** (status: "lost" or "empty")
3. **Automatically triggers respawn** when all spawns are destroyed
4. **Selects optimal room** using the Screeps `worldStartRoom` API
5. **Places spawn intelligently** by analyzing room terrain
6. **Sends notifications** for critical events (spawn loss, respawn, failures)

This workflow uses the `screeps-autospawner` composite action (`.github/actions/screeps-autospawner/`), which:

- Early exits if the bot is already active (no unnecessary API calls)
- Performs full automatic respawn (trigger + room selection + spawn placement)
- Handles "empty" status (respawn triggered but spawn not yet placed)
- Provides comprehensive error handling and logging

### Manual API Call

For manual intervention or custom automation:

```javascript
// Using screeps-api package
const api = require("screeps-api")();
await api.auth(email, password);

// Trigger respawn in a specific room
await api.respawn({
  room: "W1N1", // Target room name
  branch: "main" // Code branch to deploy
});
```

### Deployment Integration

The deployment workflow (`deploy.yml`) also runs the autospawner after successful deployments to ensure the bot is active immediately after code updates.

## Testing

The respawn functionality is covered by:

- **Unit Tests**: `tests/unit/respawnManager.test.ts`
  - Detection logic
  - State transitions
  - Periodic reminders
  - Recovery scenarios
- **E2E Tests**: `tests/e2e/respawnScenario.test.ts`
  - Full kernel integration
  - Evaluation reporting
  - Normal operation vs respawn mode

## Monitoring

Monitor for respawn conditions through:

1. **Console Logs**: Watch for `[respawn] CRITICAL` messages
2. **Memory State**: Check `Memory.respawn.needsRespawn` flag
3. **System Reports**: Review `memory.systemReport.report.findings` for respawn entries
4. **Severity**: Look for findings with `severity: "critical"` and title containing "respawn"

## Future Enhancements

Potential improvements to the respawn system:

1. ✅ **Automatic Room Selection**: Implemented via `worldStartRoom` API in the autospawner
2. ✅ **API Integration**: Fully automated respawn triggering via scheduled workflow
3. ✅ **Notification System**: Push notifications sent for spawn loss and respawn events
4. ✅ **Intelligent Spawn Placement**: Terrain analysis finds optimal spawn locations
5. **Graceful Transition**: Save critical state before respawn for continuity
6. **Historical Tracking**: Record respawn events for analysis
7. **Multi-shard Support**: Extend monitoring to cover multiple game shards
8. **Advanced Room Scoring**: Compare multiple candidate rooms before selecting respawn location

## Related Files

- Implementation: `src/runtime/respawn/RespawnManager.ts`
- Integration: `src/runtime/bootstrap/kernel.ts`
- Evaluation: `src/runtime/evaluation/SystemEvaluator.ts`
- Types: `types.d.ts` (Memory.respawn interface)
- Tests: `tests/unit/respawnManager.test.ts`, `tests/e2e/respawnScenario.test.ts`

## Related Documentation

- [Memory Management](../runtime/operations/memory-management.md) - Memory state during respawn
- [Performance Monitoring](../runtime/operations/performance-monitoring.md) - System evaluation during respawn
- [Scaling Strategies](../runtime/strategy/scaling-strategies.md) - Post-respawn recovery strategies
