# PTR Task System Testing Guide

## Overview

This guide provides instructions for deploying and testing the priority-based task management system on the Screeps Public Test Realm (PTR). The task system must be validated in a live Screeps environment before enabling in production.

## Prerequisites

- Access to Screeps PTR server
- PTR API token configured
- Task system documentation reviewed (`docs/runtime/task-system.md`)

## Phase 2: PTR Validation Testing

### Step 1: Configure Environment

**Option A: Environment Variable**

```bash
export TASK_SYSTEM_ENABLED=true
export SCREEPS_TOKEN=<your-ptr-token>
export SCREEPS_HOST=https://screeps.com/ptr
```

**Option B: Memory Flag (In-Game Console)**

```javascript
Memory.experimentalFeatures = {
  taskSystem: true
};
```

### Step 2: Deploy to PTR

```bash
# Deploy with task system enabled
TASK_SYSTEM_ENABLED=true SCREEPS_HOST=https://screeps.com/ptr npm run deploy

# Or use the deploy script with PTR host
npm run deploy
```

**Verify Deployment:**

Check the in-game console for task system activity:

```
[TaskManager] CPU threshold reached (78.45/80.00), skipping 5 creep tasks
```

### Step 3: Initial Observation (First Hour)

**Monitor CPU Usage:**

```javascript
// In-game console - track CPU usage
const trackCPU = () => {
  const cpuUsed = Game.cpu.getUsed();
  const cpuLimit = Game.cpu.limit;
  const percentage = ((cpuUsed / cpuLimit) * 100).toFixed(1);
  console.log(`CPU: ${cpuUsed.toFixed(2)}/${cpuLimit} (${percentage}%)`);
};

// Run every 10 ticks
if (Game.time % 10 === 0) trackCPU();
```

**Check Task Execution:**

```javascript
// View task system metrics
const rooms = Object.values(Game.rooms).filter(r => r.controller?.my);
rooms.forEach(room => {
  const creeps = room.find(FIND_MY_CREEPS);
  const withTasks = creeps.filter(c => c.memory.taskId).length;
  const idle = creeps.length - withTasks;
  console.log(`${room.name}: ${withTasks} busy, ${idle} idle`);
});
```

**Expected Behavior:**

- CPU usage stays under 80% threshold (default safety margin)
- Creeps assigned tasks (check `creep.memory.taskId`)
- Task types logged: `HarvestAction`, `BuildAction`, `UpgradeAction`, etc.
- No script timeout errors

### Step 4: Short-Term Validation (6 Hours)

**Monitor RCL Progression:**

```javascript
// Track controller upgrade rate
const trackRCL = () => {
  Object.values(Game.rooms).forEach(room => {
    if (room.controller?.my) {
      const progress = room.controller.progress || 0;
      const total = room.controller.progressTotal || 1;
      const percentage = ((progress / total) * 100).toFixed(1);
      console.log(`${room.name} RCL ${room.controller.level}: ${percentage}%`);
    }
  });
};
```

**Check Creep Utilization:**

```javascript
// Calculate creep efficiency
const checkUtilization = () => {
  const creeps = Object.values(Game.creeps);
  const busy = creeps.filter(c => c.memory.taskId).length;
  const idle = creeps.length - busy;
  const utilization = ((busy / creeps.length) * 100).toFixed(1);
  console.log(`Utilization: ${utilization}% (${busy}/${creeps.length})`);
  if (idle > 0) {
    console.log(`⚠️ ${idle} idle creeps detected`);
  }
};
```

**Key Metrics to Record:**

- Average CPU usage per tick
- Peak CPU usage
- RCL progression rate (progress/hour)
- Creep spawn rate (spawns/hour)
- Idle creep count
- Task skipped count (from CPU threshold warnings)

### Step 5: Long-Term Validation (24+ Hours)

**Automated Monitoring:**

The `screeps-monitoring.yml` workflow will automatically collect stats from PTR if configured. Enable PTR monitoring:

```yaml
# .github/workflows/screeps-monitoring.yml
env:
  SCREEPS_HOST: https://screeps.com/ptr
  SCREEPS_STATS_TOKEN: ${{ secrets.SCREEPS_PTR_TOKEN }}
```

**Performance Comparison:**

Compare against baseline metrics from legacy role-based system:

| Metric          | Legacy System | Task System | Delta |
| --------------- | ------------- | ----------- | ----- |
| Avg CPU/tick    | X.XX          | X.XX        | ±X%   |
| Peak CPU        | X.XX          | X.XX        | ±X%   |
| RCL Progress/hr | X             | X           | ±X    |
| Spawns/hr       | X             | X           | ±X    |
| Idle Creeps     | X             | X           | ±X    |

**Validation Criteria:**

✅ **Pass Requirements:**

- No script timeouts for 24+ hours
- CPU usage stays under configured threshold
- RCL progression rate within ±10% of baseline
- Creep spawn rate within ±10% of baseline
- Idle creep rate < 10%

❌ **Fail Conditions:**

- Script timeouts occur
- CPU consistently exceeds threshold
- RCL progression rate drops > 10%
- Idle creep rate exceeds 20%
- Task assignment failures

### Step 6: Edge Case Testing

**Test Scenarios:**

1. **No Sources Available:**

   ```javascript
   // Temporarily block all sources (in-game)
   // Verify: Task system generates no harvest tasks
   // Verify: Creeps don't get stuck
   ```

2. **All Tasks Complete:**

   ```javascript
   // Remove all construction sites
   // Verify: Upgrade tasks dominate
   // Verify: No task generation errors
   ```

3. **High Creep Count:**

   ```javascript
   // Spawn 20+ creeps (if GCL allows)
   // Verify: CPU stays under threshold
   // Verify: Task assignment scales properly
   ```

4. **CPU Spike:**
   ```javascript
   // Trigger expensive operation
   // Verify: Task system stops execution
   // Verify: Warning logged
   ```

### Step 7: Rollback Procedure

If validation fails, immediately disable the task system:

**Option A: Memory Flag (Fastest)**

```javascript
Memory.experimentalFeatures = {
  taskSystem: false
};
```

**Option B: Redeploy**

```bash
TASK_SYSTEM_ENABLED=false SCREEPS_HOST=https://screeps.com/ptr npm run deploy
```

**Clean Up:**

```javascript
// Clear task IDs from creep memory
Object.values(Game.creeps).forEach(creep => {
  delete creep.memory.taskId;
});
```

## Data Collection

### CPU Metrics

```javascript
// Collect CPU data over time
if (!Memory.stats) Memory.stats = { cpuSamples: [] };

const sample = {
  tick: Game.time,
  used: Game.cpu.getUsed(),
  limit: Game.cpu.limit,
  bucket: Game.cpu.bucket
};

Memory.stats.cpuSamples.push(sample);

// Keep last 500 samples (rolling window)
if (Memory.stats.cpuSamples.length > 500) {
  Memory.stats.cpuSamples.shift();
}
```

### Task System Metrics

```javascript
// Track task system performance
if (!Memory.taskSystemStats) Memory.taskSystemStats = {};

const stats = {
  tick: Game.time,
  tasksGenerated: 0,
  tasksAssigned: 0,
  tasksCompleted: 0,
  creepUtilization: 0
};

// Calculate from in-game data
const creeps = Object.values(Game.creeps);
stats.creepUtilization = creeps.filter(c => c.memory.taskId).length / creeps.length;

Memory.taskSystemStats[Game.time] = stats;
```

### Export Data

```javascript
// Export metrics for analysis
const exportMetrics = () => {
  const metrics = {
    cpuSamples: Memory.stats.cpuSamples,
    taskSystemStats: Memory.taskSystemStats,
    roomStats: Object.values(Game.rooms)
      .filter(r => r.controller?.my)
      .map(r => ({
        name: r.name,
        level: r.controller.level,
        progress: r.controller.progress,
        progressTotal: r.controller.progressTotal
      }))
  };

  console.log(JSON.stringify(metrics));
};
```

## Troubleshooting

### Issue: High CPU Usage

**Symptoms:** CPU consistently above threshold, tasks frequently skipped

**Diagnosis:**

```javascript
// Check task generation overhead
const cpuBefore = Game.cpu.getUsed();
// Run task generation manually
const cpuAfter = Game.cpu.getUsed();
console.log(`Task generation: ${(cpuAfter - cpuBefore).toFixed(2)} CPU`);
```

**Solutions:**

- Lower `cpuSafetyMargin` to 0.7
- Reduce task generation frequency
- Limit pending tasks per room

### Issue: Idle Creeps

**Symptoms:** Creeps without `taskId`, standing still

**Diagnosis:**

```javascript
// Check available tasks vs idle creeps
const rooms = Object.values(Game.rooms).filter(r => r.controller?.my);
rooms.forEach(room => {
  const sources = room.find(FIND_SOURCES_ACTIVE);
  const sites = room.find(FIND_CONSTRUCTION_SITES);
  const idleCreeps = room.find(FIND_MY_CREEPS).filter(c => !c.memory.taskId);

  console.log(`${room.name}:`);
  console.log(`  Sources: ${sources.length}, Sites: ${sites.length}`);
  console.log(`  Idle creeps: ${idleCreeps.length}`);
});
```

**Solutions:**

- Verify task generation is running
- Check creep prerequisites (WORK/CARRY parts)
- Ensure tasks aren't expiring too quickly

### Issue: Script Timeouts

**Symptoms:** "Script execution timed out" errors

**Diagnosis:**

```javascript
// Check for runaway loops
const cpuLimit = Game.cpu.limit;
const cpuUsed = Game.cpu.getUsed();
console.log(`CPU: ${cpuUsed}/${cpuLimit} (${((cpuUsed / cpuLimit) * 100).toFixed(1)}%)`);
```

**Solutions:**

- **Immediately rollback** to legacy system
- Lower `cpuSafetyMargin` to 0.6
- Review task generation complexity
- Report issue with metrics

## Reporting Results

After 24+ hours of testing, create a summary report:

```markdown
## PTR Task System Validation Report

**Test Duration:** <start-time> to <end-time> (24+ hours)

**Configuration:**

- Task System: Enabled
- CPU Safety Margin: 0.8
- Max CPU Per Creep: 1.5

**Metrics:**
| Metric | Value | Baseline | Delta |
|--------|-------|----------|-------|
| Avg CPU/tick | X.XX | X.XX | ±X% |
| Peak CPU | X.XX | X.XX | ±X% |
| Script Timeouts | X | 0 | +X |
| RCL Progress/hr | X | X | ±X% |
| Creep Spawns/hr | X | X | ±X% |
| Idle Creep Rate | X% | X% | ±X% |

**Observations:**

- <Key finding 1>
- <Key finding 2>
- <Key finding 3>

**Recommendation:**

- [ ] ✅ Pass: Proceed to production rollout
- [ ] ❌ Fail: Additional tuning required
- [ ] ⚠️ Conditional: Pass with caveats
```

## Next Steps

If PTR validation passes:

1. **Document Findings:** Update `docs/runtime/task-system.md` with PTR results
2. **Plan Production Rollout:** Follow Phase 3 in `docs/runtime/task-system.md`
3. **Enable Monitoring:** Configure alerts for production deployment
4. **Gradual Enablement:** Start with single room, expand incrementally

## Related Documentation

- [Task System Architecture](./task-system.md) - Full system documentation
- [Enabling Task System](./strategy/enabling-task-system.md) - Configuration guide
- [CPU Timeout Prevention](./operations/cpu-timeout-prevention.md) - CPU management
