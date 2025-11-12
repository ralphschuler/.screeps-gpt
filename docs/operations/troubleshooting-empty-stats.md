# Troubleshooting Empty Stats Collection

## Problem: Stats API Returns Empty Data

When the Screeps Stats API returns `{"ok": 1, "stats": {}}`, this indicates that `Memory.stats` is not being populated by the bot. This document helps diagnose whether this is a bot lifecycle failure or a stats collection bug.

## Diagnosis Steps

### 1. Check Bot Aliveness (PRIMARY)

The bot aliveness check is the definitive indicator of bot execution state:

```bash
npx tsx scripts/check-bot-aliveness.ts
```

**Interpretation:**

- **Exit code 0** (aliveness: "active") → Bot IS executing, this is a stats collection bug
- **Exit code 1** (aliveness: "respawn_needed" or "spawn_placement_needed") → Bot genuinely needs intervention
- **Exit code 2** (aliveness: "unknown") → API error, check credentials and connectivity

**Output Location:** `reports/copilot/bot-aliveness.json`

### 2. Cross-Reference Spawn Monitor

Check the latest spawn monitor workflow run:

```bash
gh run list --workflow="Screeps Spawn Monitor" --limit 5
```

If spawn monitor shows SUCCESS, the bot is definitely active.

### 3. Check Stats Collection Code

If bot is active but stats are empty, verify the `StatsCollector` is being called:

**Code Location:** [`src/runtime/metrics/StatsCollector.ts`](../../src/runtime/metrics/StatsCollector.ts)

**Kernel Integration:** [`src/runtime/bootstrap/kernel.ts`](../../src/runtime/bootstrap/kernel.ts)

The kernel calls `statsCollector.collect()` on ALL execution paths, including:

- Emergency CPU aborts
- Respawn checks
- Memory corruption recovery
- Normal tick execution

### 4. Verify Memory.stats Structure

If bot is running, check the console directly:

```javascript
// In Screeps console
JSON.stringify(Memory.stats);
```

Expected output should contain:

```json
{
  "time": <game tick>,
  "cpu": { "used": <number>, "limit": <number>, "bucket": <number> },
  "creeps": { "count": <number> },
  "rooms": { "count": <number>, "<roomName>": { ... } }
}
```

## Common Root Causes

### Bot is Active But Stats Empty

**Root Cause:** Stats collection bug in bot code

**Symptoms:**

- Spawn monitor: SUCCESS
- Aliveness check: "active"
- Stats API: empty

**Solution:**

1. Check if `StatsCollector.collect()` is being called (add console logs)
2. Verify `Memory.stats` is not being overwritten
3. Check for exceptions in stats collection code
4. Ensure game tick is advancing (check `Game.time`)

**Example Fix:**

```typescript
// Add diagnostic logging in kernel.ts
console.log("[Kernel] Stats collection started");
this.statsCollector.collect(game, memory, snapshot);
console.log("[Kernel] Memory.stats:", JSON.stringify(Memory.stats));
```

### Bot Lost All Spawns

**Root Cause:** Bot respawned or lost territory

**Symptoms:**

- Spawn monitor: May fail or show respawn action
- Aliveness check: "respawn_needed" or "spawn_placement_needed"
- Stats API: empty (expected - no game activity)

**Solution:**

1. Manual respawn via Screeps UI
2. Or wait for spawn monitor to auto-respawn
3. Monitor spawn placement status

### API Authentication Issues

**Root Cause:** Invalid or expired Screeps token

**Symptoms:**

- Aliveness check: "unknown" with API error
- Stats fetch: HTTP 401/403 errors

**Solution:**

1. Verify `SCREEPS_TOKEN` in secrets
2. Check token hasn't expired
3. Regenerate token at https://screeps.com/a/#!/account/auth-tokens

## Monitoring Integration

The resilient telemetry script ([`scripts/fetch-resilient-telemetry.ts`](../../scripts/fetch-resilient-telemetry.ts)) automatically:

1. Checks bot aliveness FIRST
2. Attempts Stats API collection
3. Falls back to console telemetry if needed
4. Creates diagnostic snapshots with aliveness context

**Output includes:**

- `bot_aliveness`: "active", "needs_spawn", or "unknown"
- `bot_status`: Raw world-status from API
- Recommendation based on bot state

## Prevention

### Automated Monitoring

The monitoring workflow ([`screeps-monitoring.yml`](../../.github/workflows/screeps-monitoring.yml)) now distinguishes:

- **Stats collection failures** (bot active, stats empty) → Create bug issue
- **Bot lifecycle failures** (bot lost spawns) → Create critical intervention issue

### Manual Validation After Deployment

After deploying bot changes:

1. Wait 5 minutes for first tick execution
2. Check bot aliveness: `npx tsx scripts/check-bot-aliveness.ts`
3. Verify stats: `npx tsx scripts/fetch-screeps-stats.mjs`
4. Check console: `Memory.stats` should be populated

### Stats Collection Test

Add a unit test to validate stats collection:

```typescript
import { StatsCollector } from "@runtime/metrics/StatsCollector";

it("should populate Memory.stats with required fields", () => {
  const collector = new StatsCollector();
  const game = createMockGame();
  const memory = {} as Memory;
  const snapshot = createMockSnapshot();

  collector.collect(game, memory, snapshot);

  expect(memory.stats).toBeDefined();
  expect(memory.stats.time).toBe(game.time);
  expect(memory.stats.cpu).toBeDefined();
  expect(memory.stats.creeps).toBeDefined();
  expect(memory.stats.rooms).toBeDefined();
});
```

## Related Issues

- Issue #559 - Bot lifecycle failure vs stats collection bug
- Issue #550 - PTR telemetry blackout regression
- Issue #560 - Automated bot aliveness heartbeat (prevention)

## References

- [Stats Monitoring Documentation](./stats-monitoring.md)
- [Stats Collection Implementation](./stats-collection.md)
- [Respawn Handling](./respawn-handling.md)
- [Monitoring Alerts Playbook](./monitoring-alerts-playbook.md)
