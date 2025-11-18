# Operational Runbooks

**Purpose**: Quick-reference guides for common operational tasks and emergency procedures.  
**Audience**: Developers, operators, and autonomous agents managing the .screeps-gpt bot.  
**Last Updated**: 2025-11-18

## Table of Contents

1. [Emergency Procedures](#emergency-procedures)
2. [Deployment Procedures](#deployment-procedures)
3. [Monitoring and Alerts](#monitoring-and-alerts)
4. [Troubleshooting Guide](#troubleshooting-guide)
5. [Bootstrap Phase Troubleshooting](#bootstrap-phase-troubleshooting)
6. [Performance Investigation](#performance-investigation)
7. [Data Recovery](#data-recovery)

## Emergency Procedures

### Bot Not Spawning Creeps

**Symptoms**: Spawn idle, no creeps in room, energy available

**Quick Fix**:

1. Check Memory corruption: `Memory.creeps` and `Memory.rooms`
2. Verify spawn queue: Console command `JSON.stringify(Game.spawns[Object.keys(Game.spawns)[0]].spawning)`
3. Check CPU bucket: If <500, bot may be throttling operations
4. Review console logs for error messages

**Root Causes**:

- Memory.creeps not initialized
- SpawnManager disabled or erroring
- CPU bucket depletion
- Invalid spawn body configuration

**Resolution**:

```javascript
// Console command to force memory reset
Memory.creeps = {};
Memory.rooms = {};
Memory.stats = {};
```

**Prevention**:

- MemoryManager defensive initialization
- Regular memory cleanup
- CPU monitoring and alerting

### Stats Collection Failure

**Symptoms**: Monitoring dashboard shows no data, PTR alerts not working

**Quick Fix**:

1. Check Memory.stats initialization
2. Verify StatsCollector is running in kernel
3. Check for TypeScript interface conflicts
4. Review console for stats collection errors

**Root Causes**:

- Memory.stats interface conflicts (resolved in v0.83.7)
- StatsCollector disabled in configuration
- Memory object corruption

**Resolution**:

```javascript
// Console command to reinitialize stats
if (!Memory.stats) {
  Memory.stats = {};
}
```

**Prevention**:

- Defensive memory initialization (implemented in #722)
- Redundant validation pathways (#724)
- Regular stats collection health checks

### CPU Bucket Depletion

**Symptoms**: CPU bucket <500, operations throttled, creeps idle

**Quick Fix**:

1. Disable expensive operations temporarily
2. Check profiler for CPU hotspots
3. Reduce creep count if necessary
4. Enable safe mode if under attack

**Root Causes**:

- Pathfinding spam (no path caching)
- Combat operations consuming CPU
- Inefficient task evaluation
- Too many creeps for current CPU limit

**Resolution Steps**:

1. Identify CPU hotspot via profiler: `Game.profiler.output()`
2. Temporarily disable expensive managers (labs, factories)
3. Implement CPU bucket-aware scheduling (#793)
4. Wait for bucket to recover (>5000)

**Prevention**:

- CPU bucket-aware task scheduler (#793)
- Performance baselines and monitoring (#820)
- Path caching implementation
- Regular profiler analysis

### Memory Corruption

**Symptoms**: Undefined errors, creep behavior anomalies, kernel crashes

**Quick Fix**:

1. Identify corrupted memory segment
2. Reset specific segment: `delete Memory.rooms['W1N1']`
3. If widespread: Force memory reset (see Bot Not Spawning Creeps)
4. Redeploy if corruption persists

**Root Causes**:

- Unsafe type assertions
- Missing defensive initialization
- Race conditions in memory writes

**Prevention**:

- Runtime type validation with Zod (#690)
- Defensive memory initialization everywhere
- Comprehensive error handling

### Deployment Failure

**Symptoms**: GitHub Actions deploy workflow fails, bot not updated

**Quick Fix**:

1. Check deploy workflow logs in GitHub Actions
2. Verify Screeps API credentials (secrets)
3. Check build output validity (MIN_SIZE validation)
4. Manual deploy if needed: `bun run deploy`

**Root Causes**:

- Invalid Screeps API credentials
- Build output too small (bundler failure)
- Network issues with screeps.com API
- Invalid deployment configuration

**Resolution**:

1. Verify secrets: `SCREEPS_TOKEN`, `SCREEPS_USERNAME`, `SCREEPS_BRANCH`
2. Check build artifacts: `ls -lh dist/main.js` (should be >50KB)
3. Test API connection: `bun run deploy --dry-run` (when available)
4. Review deployment logs for specific errors

**Prevention**:

- Automated build validation (MIN_SIZE check implemented)
- Regular credential rotation
- Retry logic in deploy workflow
- Deployment health checks

## Deployment Procedures

### Standard Deployment

**When**: Merging changes to main branch (automated)

**Process**:

1. PR merged to main → `post-merge-release.yml` triggers
2. Version bumped and tagged automatically
3. CHANGELOG updated with version
4. `deploy.yml` workflow triggered on version tag
5. Build executed with profiler enabled
6. Bundle deployed to Screeps (main branch)
7. Deployment verification via monitoring

**Manual Override**:

```bash
# Build locally
bun run build

# Deploy manually
bun run deploy
```

**Validation**:

- Check console for initialization logs
- Monitor CPU usage (should be <10 for first few ticks)
- Verify creep spawning starts within 5-10 ticks
- Check PTR monitoring for health metrics

### Emergency Rollback

**When**: Critical bug in production, immediate rollback needed

**Process**:

1. Identify last known good version in CHANGELOG
2. Checkout that version: `git checkout v0.X.Y`
3. Build: `bun run build`
4. Deploy: `bun run deploy`
5. Monitor for stability
6. Create hotfix branch if needed

**Prevention**:

- Comprehensive regression tests
- PTR validation before production
- Feature flags for risky changes
- Incremental rollout strategy

### PTR Testing

**Purpose**: Validate changes in test environment before production

**Process**:

1. Build with test configuration: `bun run build`
2. Deploy to PTR branch: `SCREEPS_BRANCH=ptr bun run deploy`
3. Monitor PTR telemetry via `screeps-monitoring.yml`
4. Run automated validation tests
5. Review strategic analysis reports
6. If successful, deploy to production

**Validation Checklist**:

- [ ] Bot initializes without errors
- [ ] Creep spawning works correctly
- [ ] Energy collection operational
- [ ] Controller upgrading functional
- [ ] No CPU bucket depletion
- [ ] Stats collection working
- [ ] No memory leaks over 1000 ticks

## Monitoring and Alerts

### Health Check Dashboard

**Location**: GitHub Actions → screeps-monitoring.yml workflow

**Key Metrics**:

- **Tick and CPU**: Current tick, CPU usage, CPU bucket level
- **GCL Progress**: Global Control Level and progress
- **Room Status**: Controlled rooms, RCL levels
- **Creep Count**: Total creeps, by role
- **Resources**: Energy stored, resource inventory
- **Spawn Status**: Spawn utilization, idle time

**Alert Triggers**:

- CPU bucket <1000 (warning), <500 (critical)
- No creeps spawned in 100 ticks
- Energy storage <1000 at RCL 3+
- Controller downgrade timer <5000
- Memory.stats collection failure

### Strategic Analysis

**Location**: GitHub Actions → copilot-strategic-planner.yml

**Analysis Areas**:

- Resource efficiency trends
- Phase progression status
- Task completion patterns
- Anomaly detection
- Improvement recommendations

**Review Frequency**: Every 30 minutes (configurable)

### Performance Monitoring

**Profiler Data**:

- Function-level CPU usage
- Manager execution times
- Critical path analysis
- Bottleneck identification

**Access**:

```javascript
// In Screeps console
Game.profiler.output();
```

**Collection**: Automated via `screeps-monitoring.yml` → `ensure-profiler-running.ts`

## Troubleshooting Guide

### Common Issues

#### Issue: "Cannot read property 'X' of undefined"

**Cause**: Missing defensive initialization

**Solution**:

```typescript
// Add null checks
if (!Memory.stats) {
  Memory.stats = {};
}
```

#### Issue: High CPU Usage

**Diagnosis**:

1. Check profiler output: `Game.profiler.output()`
2. Identify top CPU consumers
3. Review recent changes for performance regressions

**Common Culprits**:

- Pathfinding without caching
- Inefficient loops (filter → map → reduce chains)
- Excessive creep.find() calls
- Complex task evaluation

**Solutions**:

- Implement path caching
- Use for...of instead of array methods
- Cache find() results per tick
- Simplify task evaluation logic

#### Issue: Creeps Standing Idle

**Cause**: Task assignment failure or role behavior error

**Diagnosis**:

1. Check creep memory: `JSON.stringify(Game.creeps['CreepName'].memory)`
2. Verify task queue: `Memory.rooms['W1N1'].tasks`
3. Check for error logs mentioning the creep

**Solutions**:

- Reset creep memory: `delete Memory.creeps['CreepName']`
- Verify task targets exist
- Check task validation logic
- Review BehaviorController for errors

#### Issue: Spawn Not Building Correct Creeps

**Cause**: SpawnManager body generation error

**Diagnosis**:

1. Check spawn queue configuration
2. Verify energy availability matches body cost
3. Review body generation logic

**Solutions**:

- Verify energy calculation includes extensions
- Check for invalid body part combinations
- Review spawn priority configuration

### Debug Commands

**Memory Inspection**:

```javascript
// View all memory
JSON.stringify(Memory, null, 2);

// View specific room
JSON.stringify(Memory.rooms["W1N1"], null, 2);

// View creeps
Object.keys(Memory.creeps);
```

**Kernel Status**:

```javascript
// View kernel managers
Object.keys(Game).filter(k => k.includes("Manager"));

// Check CPU usage
Game.cpu.getUsed();
Game.cpu.bucket;
```

**Force Operations**:

```javascript
// Force spawn
Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], "test");

// Force task creation
if (!Memory.rooms["W1N1"].tasks) Memory.rooms["W1N1"].tasks = [];
Memory.rooms["W1N1"].tasks.push({
  type: "harvest",
  priority: 5,
  target: "sourceId",
  assignedTo: null
});
```

## Bootstrap Phase Troubleshooting

The bootstrap phase system manages critical early-game transitions. For comprehensive documentation, see [Bootstrap Phases Guide](../runtime/bootstrap-phases.md).

### Quick Diagnostics

**Check Bootstrap Status**:

```javascript
// Is bootstrap active?
Memory.bootstrap?.isActive;

// How long has bootstrap been running?
Game.time - Memory.bootstrap?.startedAt;

// What phase is the room in?
Memory.rooms["W1N1"]?.phase;
```

### Common Bootstrap Issues

#### Bootstrap Stuck at RCL 1

**Symptoms**: Bootstrap active for >1000 ticks, RCL not progressing

**Quick Checks**:

```javascript
const room = Game.rooms["W1N1"];
console.log(`Energy: ${room.energyCapacityAvailable}/300`);
console.log(
  `Extensions: ${
    room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_EXTENSION
    }).length
  }/2`
);
console.log(`Harvesters: ${_.filter(Game.creeps, c => c.memory.role === "harvester").length}/6`);
```

**Solutions**:

1. Verify harvesters are spawning (should reach 6 during bootstrap)
2. Check extension construction sites exist
3. Ensure upgrader is actively upgrading controller
4. If stuck, force bootstrap completion: `Memory.bootstrap.isActive = false; Memory.bootstrap.completedAt = Game.time;`

#### Too Few Creeps During Bootstrap

**Symptoms**: Only 1-2 harvesters spawned, energy gathering insufficient

**Root Cause**: Bootstrap role minimums not being applied to spawn queue

**Solution**:

```javascript
// Emergency harvester spawn
const spawn = Game.spawns["Spawn1"];
spawn.spawnCreep([WORK, CARRY, MOVE], `harvester_${Game.time}`, { memory: { role: "harvester" } });
```

#### Phase 2 Transition but No Storage

**Symptoms**: RCL 4+ reached, storage built, but `storageBuilt` flag false

**Requirement**: Storage must have >10k energy to be marked operational

**Solution**:

```javascript
// Check storage energy
const storage = Game.rooms["W1N1"].storage;
console.log(`Storage: ${storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0}/10000`);

// Force storage detection if threshold met
if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) {
  Memory.rooms["W1N1"].storageBuilt = true;
}
```

#### Roads Not Planning at RCL 2

**Symptoms**: RCL 2 reached, containers built, no road construction sites

**Prerequisites**:

- RCL 2+
- Containers within range 2 of sources
- `roadsPlanned` flag false

**Solution**:

```javascript
// Reset road planning flag to retrigger
Memory.rooms["W1N1"].roadsPlanned = false;
// Road planning will trigger on next kernel cycle
```

### Manual Bootstrap Override

**Force Bootstrap Completion** (when prerequisites met):

```javascript
Memory.bootstrap.isActive = false;
Memory.bootstrap.completedAt = Game.time;
console.log("Bootstrap manually completed");
```

**Reset Bootstrap** (start from beginning):

```javascript
delete Memory.bootstrap;
console.log("Bootstrap reset - will reinitialize next tick");
```

**Force Phase Transition**:

```javascript
const roomName = "W1N1";
Memory.rooms[roomName].phase = "phase2";
Memory.rooms[roomName].rclLevelDetected = Game.rooms[roomName].controller.level;
Memory.rooms[roomName].phaseActivatedAt = Game.time;
```

### Bootstrap Performance Targets

- **Bootstrap Duration**: <1000 ticks (Phase 0 → Bootstrap Complete)
- **RCL 1→2 Progression**: <800 ticks
- **Creep Count by Tick 300**: 6 harvesters, 1 upgrader
- **Energy Rate**: +10 energy/tick average

If targets not met, investigate:

1. Harvester spawn priority
2. Source accessibility (pathing issues)
3. Extension construction timing
4. CPU bucket depletion

For detailed troubleshooting procedures, see [Bootstrap Phases Guide](../runtime/bootstrap-phases.md#troubleshooting).

## Performance Investigation

### When to Investigate

**Triggers**:

- CPU usage >20% higher than baseline
- CPU bucket declining over time
- Tick execution time >5ms consistently
- Creep count not scaling with RCL

### Investigation Process

1. **Collect Baseline Data**
   - Current CPU: `Game.cpu.getUsed()`
   - Profiler output: `Game.profiler.output()`
   - Creep count, room count, RCL

2. **Identify Hotspots**
   - Top 5 functions by CPU time
   - Unexpected CPU consumers
   - Frequent but cheap operations (add up)

3. **Reproduce Locally**
   - Use e2e tests with mockup
   - Add performance tests
   - Profile specific scenarios

4. **Optimize**
   - Target highest impact items first
   - Measure before/after improvement
   - Add regression tests

5. **Validate**
   - Deploy to PTR
   - Monitor for 1000+ ticks
   - Verify performance improvement
   - Check for regressions

### Performance Checklist

- [ ] Path caching implemented for frequent paths
- [ ] Find operations cached per tick
- [ ] Room scans minimized (once per N ticks)
- [ ] Expensive operations deferred when bucket low
- [ ] Profiler identifies no single function >20% CPU
- [ ] CPU scales linearly with room/creep count

## Data Recovery

### Backup Strategy

**What's Backed Up**:

- Code: Git repository (GitHub)
- Configuration: Repository files
- Build artifacts: GitHub Actions artifacts
- Reports: `reports/` directory in repository

**What's NOT Backed Up**:

- Screeps Memory object (transient game state)
- Runtime creep memory (game manages this)
- Historical telemetry (unless exported)

### Recovery Scenarios

#### Lost Memory Data

**Impact**: Creeps forget tasks, rooms forget plans

**Recovery**:

1. Memory will reinitialize on next tick (MemoryManager)
2. Creeps will be reassigned tasks
3. Room planning will recalculate
4. No manual intervention needed

**Data Loss**: Current tick task assignments, temporary caches

#### Repository Corruption

**Impact**: Cannot build or deploy

**Recovery**:

1. Clone fresh from GitHub
2. Verify main branch integrity
3. Rebuild: `bun install && bun run build`
4. Redeploy: `bun run deploy`

#### Lost Profiler Data

**Impact**: Cannot analyze performance

**Recovery**:

1. Ensure profiler running: `bun run tsx packages/utilities/scripts/ensure-profiler-running.ts`
2. Wait for data collection (30 min monitoring cycle)
3. Download from `reports/profiler/latest.json`

### Disaster Recovery

**Scenario**: Complete Screeps account data loss

**Recovery Steps**:

1. **Code**: Clone from GitHub (no loss)
2. **Deployment**: Redeploy from main branch
3. **Configuration**: Check `.screeps.json` or secrets
4. **Game State**: Start from RCL 1 (game state not recoverable)

**Prevention**:

- Keep credentials secure and backed up
- Document configuration in repository
- Regular code commits to GitHub
- Multiple branches for rollback capability

## Related Documentation

- [Bootstrap Phases Guide](../runtime/bootstrap-phases.md) - Comprehensive bootstrap phase documentation
- [Technical Debt Roadmap](../strategy/technical-debt-roadmap.md)
- [Troubleshooting Telemetry](troubleshooting-telemetry.md)
- [Monitoring Baselines](monitoring-baselines.md)
- [Strategic Roadmap](../strategy/roadmap.md)
- [AGENTS.md](../../AGENTS.md) - Agent operational guidelines

## Contacts and Escalation

**Repository Maintainer**: @ralphschuler (GitHub)

**Escalation Path**:

1. Check this runbook for known issues
2. Search closed issues on GitHub
3. Review CHANGELOG for related changes
4. Create new issue with detailed context
5. Tag with appropriate labels (type/bug, priority/\*)

**Response Times**:

- Critical (bot down): Automated investigation via CI
- High (degraded performance): Within 24 hours
- Medium (non-blocking issues): Within 3-5 days
- Low (improvements): Triaged to backlog
