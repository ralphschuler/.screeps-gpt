# Strategy Testing and Validation

This document describes methodologies for testing AI strategy changes, validating behavior, and measuring effectiveness before deployment.

## Overview

Testing Screeps AI behavior requires a combination of unit tests, simulation tests, and real-world validation. This document outlines best practices for ensuring strategy changes improve performance without introducing regressions.

## Testing Hierarchy

### Level 1: Unit Tests

**Purpose**: Verify individual components work correctly in isolation

**Location**: `tests/unit/`

**Tools**:

- Vitest test framework
- Mock Screeps globals
- Isolated component testing

**Example Test Structure**:

```typescript
// tests/unit/behaviorController.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { BehaviorController } from "@runtime/behavior/BehaviorController";

describe("BehaviorController", () => {
  it("should spawn harvester when below minimum", () => {
    const controller = new BehaviorController();
    const game = createMockGame({ creeps: {}, spawns: { Spawn1: mockSpawn() } });
    const memory = createMockMemory();

    const result = controller.execute(game, memory, {});

    expect(result.spawnedCreeps.length).toBeGreaterThan(0);
    expect(result.spawnedCreeps[0]).toMatch(/^harvester-/);
  });
});
```

**Coverage Requirements**:

- Critical decision logic: 100% coverage
- Edge cases: 90%+ coverage
- Happy paths: 100% coverage

**Run Command**:

```bash
bun run test:unit
```

### Level 2: End-to-End Tests

**Purpose**: Verify kernel orchestration and component integration

**Location**: `tests/e2e/`

**Tools**:

- Vitest test framework
- Mock entire game environment
- Multi-tick simulation

**Example Test Structure**:

```typescript
// tests/e2e/kernel.test.ts
describe("Kernel integration", () => {
  it("should maintain economy over 100 ticks", () => {
    const kernel = new Kernel();
    const game = createGameSimulation();
    const memory = createMemory();

    for (let tick = 0; tick < 100; tick++) {
      game.time = tick;
      kernel.run(game, memory);
    }

    expect(Object.keys(game.creeps).length).toBeGreaterThan(2);
    expect(game.spawns.Spawn1.store.energy).toBeGreaterThan(0);
  });
});
```

**Coverage Requirements**:

- Full tick execution: 100% coverage
- Multi-tick scenarios: Key scenarios tested
- State transitions: All transitions verified

**Run Command**:

```bash
bun run test:e2e
```

### Level 3: Mockup Tests

**Purpose**: High-fidelity simulation using Screeps server mockup

**Location**: `tests/mockup/`

**Tools**:

- `screeps-server-mockup` (actual Screeps engine)
- Real game rules and mechanics
- Private server environment

**Example Test Structure**:

```typescript
// tests/mockup/economy.test.ts
import { ScreepsMockup } from "screeps-server-mockup";

describe("Economy simulation", () => {
  it("should reach RCL 2 within 5000 ticks", async () => {
    const server = new ScreepsMockup();
    await server.world.addRoom("W0N0");
    await server.world.setTerrain("W0N0", generateTerrain());

    // Deploy AI code
    await server.world.addBot({ username: "test-bot", room: "W0N0", code: deployedCode });

    // Run simulation
    await server.tick(5000);

    const room = await server.world.roomObjects("W0N0");
    expect(room.controller.level).toBeGreaterThanOrEqual(2);
  });
});
```

**Coverage Requirements**:

- Core gameplay loops: Major milestones tested
- RCL progression: Each level validated
- Failure recovery: Respawn and disaster scenarios

**Run Command**:

```bash
bun run test:mockup
```

### Level 4: Regression Tests

**Purpose**: Prevent previously fixed bugs from reoccurring

**Location**: `tests/regression/`

**Structure**:

- One test file per bug
- References issue number
- Includes reproduction case

**Example Test Structure**:

```typescript
// tests/regression/issue-123-harvester-stuck.test.ts
describe("Issue #123: Harvesters getting stuck", () => {
  it("should not get stuck when source depleted", () => {
    const game = createGameWithDepletedSource();
    const controller = new BehaviorController();

    // Execute multiple ticks
    for (let i = 0; i < 10; i++) {
      controller.execute(game, Memory, {});
    }

    // Verify creep moved to other source
    const harvester = Object.values(game.creeps)[0];
    expect(harvester.pos).not.toEqual(depletedSourcePos);
  });
});
```

**Run Command**:

```bash
bun run test:regression
```

## Strategy Validation Methodology

### Pre-Deployment Validation

**Step 1: Define Success Criteria**

Before implementing any strategy change, document:

- **Goal**: What are you trying to improve?
- **Metrics**: How will you measure success?
- **Baseline**: What is the current performance?
- **Target**: What is the desired performance?

**Example**:

```markdown
Goal: Improve harvester efficiency by reducing travel time
Metrics: Energy delivered per tick, CPU per harvester
Baseline: 1.09 energy/tick, 0.45 CPU/creep
Target: 1.25 energy/tick, 0.40 CPU/creep
```

**Step 2: Implement and Test**

1. Write unit tests for new logic
2. Run full test suite: `npm test`
3. Ensure all tests pass
4. Review test coverage: `bun run test:coverage`

**Step 3: Simulate Performance**

1. Create mockup test for strategy
2. Run 1000+ tick simulation
3. Collect performance metrics
4. Compare against baseline

**Step 4: Code Review**

1. Check CPU impact (profile new code)
2. Review memory usage changes
3. Verify no breaking changes
4. Validate edge case handling

### Post-Deployment Validation

**Step 1: Monitor Initial Performance (First 1000 ticks)**

Watch for:

- CPU bucket trends
- Spawn throughput
- Creep population stability
- Controller upgrade rate

**Console Monitoring**:

```javascript
// Track key metrics
console.log(`Tick: ${Game.time}`);
console.log(`CPU: ${Game.cpu.getUsed().toFixed(2)} / ${Game.cpu.limit}`);
console.log(`Bucket: ${Game.cpu.bucket}`);
console.log(`Creeps: ${Object.keys(Game.creeps).length}`);
console.log(`Energy: ${Game.spawns.Spawn1.store.energy}`);
```

**Step 2: Compare Against Baseline (After 5000 ticks)**

Collect metrics:

- Average CPU/tick
- Average energy/tick
- RCL progression rate
- Bucket stability

**Step 3: Identify Regressions**

Check for:

- CPU increase >10%
- Energy decrease >10%
- Spawning delays
- Stuck creeps
- Memory leaks

**Step 4: Rollback if Necessary**

If regressions detected:

1. Document failure mode
2. Revert to previous version
3. Create regression test
4. Fix and re-test

## Behavioral Validation Checklist

### Task Switching Validation

**Harvester Role**:

- [ ] Transitions HARVEST → DELIVER when full
- [ ] Transitions DELIVER → HARVEST when empty
- [ ] Transitions DELIVER → UPGRADE when no targets
- [ ] Transitions UPGRADE → HARVEST when empty
- [ ] Never gets stuck in invalid state

**Upgrader Role**:

- [ ] Transitions RECHARGE → UPGRADE when full
- [ ] Transitions UPGRADE → RECHARGE when empty
- [ ] Never idles with empty energy
- [ ] Never idles with full energy

### Spawn Logic Validation

- [ ] Spawns harvesters when below minimum
- [ ] Spawns upgraders when below minimum
- [ ] Respects energy availability
- [ ] Handles busy spawns gracefully
- [ ] Generates unique creep names
- [ ] Initializes memory correctly

### Pathfinding Validation

- [ ] Finds valid paths to targets
- [ ] Reuses paths for configured ticks
- [ ] Handles blocked paths gracefully
- [ ] Respects range parameters
- [ ] Doesn't recalculate unnecessarily

### Memory Validation

- [ ] Prunes dead creep memories
- [ ] Updates role counts accurately
- [ ] Persists critical state
- [ ] Doesn't leak memory
- [ ] Recovers from corruption

## Performance Benchmarking

### Benchmark Collection

**Manual Benchmarking** (in console):

```javascript
// Run for 100 ticks, collect metrics
Memory.benchmark = [];
for (let i = 0; i < 100; i++) {
  const start = Game.cpu.getUsed();
  // ... tick logic ...
  const end = Game.cpu.getUsed();
  Memory.benchmark.push({
    tick: Game.time,
    cpu: end - start,
    creeps: Object.keys(Game.creeps).length,
    energy: Game.spawns.Spawn1.store.energy
  });
}

// Calculate averages
const avgCpu = Memory.benchmark.reduce((sum, b) => sum + b.cpu, 0) / 100;
const avgCreeps = Memory.benchmark.reduce((sum, b) => sum + b.creeps, 0) / 100;
console.log(`Avg CPU: ${avgCpu.toFixed(2)}, Avg Creeps: ${avgCreeps.toFixed(1)}`);
```

**Automated Benchmarking** (in tests):

```typescript
function benchmark(strategy: () => void, ticks: number) {
  const metrics = { cpu: 0, time: 0 };
  const start = performance.now();

  for (let i = 0; i < ticks; i++) {
    const cpuStart = Game.cpu.getUsed();
    strategy();
    metrics.cpu += Game.cpu.getUsed() - cpuStart;
  }

  metrics.time = performance.now() - start;
  return {
    avgCpu: metrics.cpu / ticks,
    totalTime: metrics.time
  };
}

// Usage
const baseline = benchmark(baselineStrategy, 1000);
const optimized = benchmark(optimizedStrategy, 1000);
const improvement = ((baseline.avgCpu - optimized.avgCpu) / baseline.avgCpu) * 100;
console.log(`Improvement: ${improvement.toFixed(1)}%`);
```

### Key Performance Indicators (KPIs)

**Efficiency Metrics**:

- Energy per tick (higher = better)
- CPU per creep (lower = better)
- Spawn uptime % (higher = better)
- Idle time % (lower = better)

**Stability Metrics**:

- CPU bucket trend (stable = better)
- Memory size (stable = better)
- Population variance (lower = better)
- Error rate (lower = better)

**Progress Metrics**:

- RCL progression rate (higher = better)
- GCL progression rate (higher = better)
- Room expansion rate (context-dependent)

## A/B Testing Strategies

### Parallel Testing (Private Server)

**Setup**:

1. Deploy baseline strategy to Bot A
2. Deploy new strategy to Bot B
3. Run in identical rooms
4. Compare metrics after N ticks

**Comparison Points**:

- RCL progression (time to level up)
- Final creep count
- Average CPU usage
- Resource efficiency

### Sequential Testing (Live Server)

**Setup**:

1. Collect baseline metrics (1000+ ticks)
2. Deploy new strategy
3. Collect new metrics (1000+ ticks)
4. Compare normalized results

**Normalization Required**:

- Account for RCL differences
- Normalize for room conditions
- Control for external factors (attacks, etc.)

## Continuous Integration Testing

### Pre-Merge Validation

**GitHub Actions Guard Workflows** (`.github/workflows/guard-*.yml`):

Individual guard workflows validate different aspects of PRs:

```yaml
# guard-test-unit.yml
- name: Unit tests
  run: bun run test:unit

# guard-test-e2e.yml  
- name: E2E tests
  run: bun run test:e2e

# guard-coverage.yml
- name: Check test coverage
  run: bun run test:coverage

# guard-build.yml
- name: Build AI
  run: bun run build

# guard-lint.yml
- name: Lint
  run: bun run lint

# guard-format.yml
- name: Format check
  run: bun run format:check
```

**Quality Gates**:

Results are aggregated by `quality-gate-summary.yml`:

- All tests must pass (unit, e2e, regression)
- Build succeeds
- No linting errors
- Code is properly formatted
- YAML syntax is valid

### Post-Merge Validation

**Deployment Pipeline** (`.github/workflows/deploy.yml`):

1. Build passes
2. Tests pass
3. Deploy to private server (optional)
4. Monitor for regressions
5. Deploy to live server

## Testing Best Practices

### DO:

- ✓ Write tests before fixing bugs
- ✓ Test edge cases and failure modes
- ✓ Mock external dependencies
- ✓ Use descriptive test names
- ✓ Keep tests focused and isolated
- ✓ Maintain >85% code coverage

### DON'T:

- ✗ Skip tests for "simple" changes
- ✗ Test implementation details
- ✗ Write tests that depend on execution order
- ✗ Use real Screeps server for unit tests
- ✗ Commit failing tests
- ✗ Remove tests without understanding impact

### MONITOR:

- ⚠ Test execution time (keep fast)
- ⚠ Flaky tests (fix or remove)
- ⚠ Coverage trends (prevent decay)
- ⚠ Test complexity (keep simple)

## Related Documentation

- [Safe Refactoring](./safe-refactoring.md) - How to modify code safely
- [Improvement Metrics](./improvement-metrics.md) - Measuring strategy effectiveness
- [Creep Roles](../strategy/creep-roles.md) - Expected behavior for validation
- [Performance Monitoring](../operations/performance-monitoring.md) - Runtime metrics collection
