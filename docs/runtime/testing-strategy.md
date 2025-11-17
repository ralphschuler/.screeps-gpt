# Testing Strategy

**Purpose**: Comprehensive testing approach for .screeps-gpt autonomous AI bot  
**Last Updated**: 2025-11-17  
**Related**: [Technical Debt Roadmap](../strategy/technical-debt-roadmap.md)

## Overview

The .screeps-gpt bot employs a multi-layered testing strategy to ensure reliability, performance, and maintainability across autonomous development cycles.

### Testing Goals

1. **Confidence in Changes**: Validate changes don't break existing functionality
2. **Regression Prevention**: Catch bugs before they reach production
3. **Documentation**: Tests serve as living documentation of behavior
4. **Autonomous Development**: Enable AI-driven changes with safety nets
5. **Performance Validation**: Ensure changes don't degrade performance

### Current State

**Test Suite Statistics** (as of 2025-11-17):

- **Total Test Files**: 146 files
- **Total Tests**: 1,020 tests
- **Test Pass Rate**: 100% (1,020/1,020 passing)
- **Coverage**: Good overall, gaps in critical components

**Test Types**:

- Unit Tests: `tests/unit/` (78 files)
- E2E Tests: `tests/e2e/` (simulation-based)
- Regression Tests: `tests/regression/` (bug prevention)
- Mockup Tests: `tests/mockup/` (tick-based integration)
- Performance Tests: `tests/performance/` (CPU benchmarks)

## Testing Pyramid

```
                    /\
                   /  \         E2E Tests (PTR validation)
                  /____\
                 /      \       Integration Tests (mockup)
                /        \
               /__________\     Regression Tests (bug scenarios)
              /            \
             /              \   Unit Tests (component isolation)
            /________________\
```

### Layer 1: Unit Tests (Foundation)

**Purpose**: Test individual components in isolation

**Scope**:

- Individual manager classes
- Utility functions
- Data structures and algorithms
- Type validation logic

**Characteristics**:

- Fast execution (<100ms per test)
- No external dependencies
- Comprehensive coverage (>85% for critical components)
- Mocked game objects

**Example Test** (`tests/unit/memory-manager.test.ts`):

```typescript
describe("MemoryManager", () => {
  beforeEach(() => {
    // Setup
    global.Memory = {};
  });

  it("should initialize Memory.stats defensively", () => {
    MemoryManager.ensureStatsStructure();

    expect(Memory.stats).toBeDefined();
    expect(Memory.stats.cpu).toBeDefined();
    expect(Memory.stats.gcl).toBeDefined();
  });
});
```

**Coverage Targets**:

- Critical components: >90% (Kernel, BehaviorController, StatsCollector)
- Standard components: >80% (Managers, utilities)
- Supporting code: >70% (Helpers, constants)

### Layer 2: Regression Tests (Bug Prevention)

**Purpose**: Prevent previously fixed bugs from reoccurring

**Scope**:

- Specific bug scenarios documented in issues
- Edge cases discovered during development
- Production incidents

**Characteristics**:

- Test-first approach (failing test before fix)
- Linked to GitHub issues
- Documented with root cause in test comments
- Permanent test suite members

**Process**:

1. Bug reported/discovered
2. Create failing regression test
3. Implement fix
4. Verify test passes
5. Document in CHANGELOG
6. Link test to issue

**Example Test** (`tests/regression/memory-stats-interface.test.ts`):

```typescript
describe("Memory.stats Interface Regression", () => {
  // Regression test for #711, #684
  // Root cause: TypeScript interface conflict
  it("should not have interface conflicts", () => {
    // This test would fail if profiler typings conflict
    Memory.stats = { cpu: {} };
    expect(Memory.stats.cpu).toBeDefined();
  });
});
```

**Current Regression Tests**: Cover key historical bugs (stats collection, spawn priority, hauler activation, etc.)

### Layer 3: Integration Tests (Mockup)

**Purpose**: Test components working together in realistic scenarios

**Scope**:

- Kernel orchestration
- Manager interactions
- Multi-tick behaviors
- Cross-component coordination

**Characteristics**:

- Use `screeps-server-mockup` for tick simulation
- Slower execution (1-10 seconds per test)
- Realistic game state
- Validates integration points

**Example Test** (`tests/mockup/kernel-full-tick.test.ts`):

```typescript
describe("Kernel Full Tick Integration", () => {
  it("should execute complete game loop", async () => {
    const server = new ScreepsServer();
    await server.start();

    // Simulate 100 ticks
    for (let i = 0; i < 100; i++) {
      await server.tick();
    }

    // Validate expected state
    const memory = await server.world.load();
    expect(memory.stats).toBeDefined();
    expect(memory.stats.cpu).toBeDefined();

    await server.stop();
  });
});
```

**Priority Integration Tests**:

- [ ] Kernel full-tick execution (#634)
- [ ] Multi-room coordination
- [ ] Task system end-to-end
- [ ] Emergency respawn recovery

### Layer 4: E2E Tests (PTR Validation)

**Purpose**: Validate bot behavior in production-like environment

**Scope**:

- Full bot deployment to PTR
- Real game server interaction
- Multi-tick sustained operation
- Performance validation

**Characteristics**:

- Slowest execution (minutes to hours)
- Real Screeps environment
- Automated via CI/CD
- Scheduled periodic validation

**PTR Test Scenarios**:

- Bootstrap (RCL 1-2): Energy collection, spawn management
- Early game (RCL 3-4): Container harvesting, storage setup
- Mid game (RCL 5-6): Link network, tower defense
- Late game (RCL 7-8): Terminal, labs, factory

**Validation Metrics**:

- Energy surplus (>10/tick at RCL 3+)
- CPU usage (<5 at RCL 1-2, <10 at RCL 3-4, <20 at RCL 5+)
- Spawn uptime (>90%)
- No CPU bucket depletion
- Stats collection operational

## Critical Component Testing

### Priority 1: Kernel and Core Systems

**Components**:

- `src/runtime/bootstrap/kernel.ts` - Main game loop
- `src/runtime/memory/MemoryManager.ts` - Memory initialization
- `src/runtime/metrics/StatsCollector.ts` - Metrics collection

**Test Coverage Target**: >95%

**Test Scenarios**:

- Kernel initialization
- Manager orchestration order
- Error isolation between managers
- CPU budget allocation
- Memory cleanup and validation

**Missing Tests** (To Add):

- [ ] Kernel error recovery
- [ ] Manager execution timeout handling
- [ ] CPU pressure scenarios

### Priority 2: Behavior and Spawning

**Components**:

- `src/runtime/behavior/BehaviorController.ts` - Creep roles and spawning
- `src/runtime/tasks/TaskManager.ts` - Task assignment

**Test Coverage Target**: >90%

**Test Scenarios**:

- Creep role assignment
- Spawn priority calculation
- Body part generation
- Emergency cold boot recovery

**Missing Tests** (#694):

- [ ] BehaviorController unit tests (15-20 tests)
- [ ] Role transition scenarios
- [ ] Spawn queue edge cases
- [ ] Task assignment algorithm validation

### Priority 3: Respawn and Recovery

**Components**:

- `src/runtime/respawn/RespawnManager.ts` - Respawn detection and recovery

**Test Coverage Target**: >90%

**Test Scenarios**:

- Respawn detection
- Memory reinitialization
- State recovery
- Graceful degradation

**Missing Tests** (#694):

- [ ] RespawnManager unit tests (10-15 tests)
- [ ] Multi-room respawn scenarios
- [ ] Partial memory corruption recovery
- [ ] Race condition handling

### Priority 4: Infrastructure Managers

**Components**:

- `src/runtime/infrastructure/BasePlanner.ts` - Construction planning
- `src/runtime/energy/LinkManager.ts` - Energy distribution
- `src/runtime/defense/TowerManager.ts` - Defense and repair

**Test Coverage Target**: >85%

**Test Scenarios**:

- Construction site selection
- Link network optimization
- Tower targeting priorities
- Resource allocation

**Current State**: Good coverage for most scenarios

## Test Development Guidelines

### Writing Effective Tests

**DO**:

- ✅ Test behavior, not implementation
- ✅ Use descriptive test names
- ✅ Include comments for complex scenarios
- ✅ Mock external dependencies
- ✅ Test edge cases and error conditions
- ✅ Keep tests independent and isolated
- ✅ Link regression tests to issues

**DON'T**:

- ❌ Test private implementation details
- ❌ Create brittle tests that break on refactoring
- ❌ Use magic numbers without explanation
- ❌ Skip cleanup (afterEach hooks)
- ❌ Write tests that depend on execution order
- ❌ Leave commented-out tests

### Test Structure

```typescript
describe("ComponentName", () => {
  // Setup
  beforeEach(() => {
    // Initialize test environment
    setupMockGameObjects();
  });

  // Teardown
  afterEach(() => {
    // Clean up
    resetGlobalState();
  });

  describe("methodName", () => {
    it("should do expected behavior in normal case", () => {
      // Arrange
      const input = createTestInput();

      // Act
      const result = component.method(input);

      // Assert
      expect(result).toBe(expected);
    });

    it("should handle edge case gracefully", () => {
      // Arrange: Edge case setup
      // Act: Execute with edge case
      // Assert: Verify graceful handling
    });

    it("should throw/log error for invalid input", () => {
      // Arrange: Invalid input
      // Act: Execute
      // Assert: Error handling
    });
  });
});
```

### Mocking Game Objects

**Use Test Helpers** (`tests/helpers/`):

```typescript
import { mockCreep, mockRoom, mockSpawn } from "../helpers/mocks";

it("should spawn creep when energy available", () => {
  const room = mockRoom({ energyAvailable: 300 });
  const spawn = mockSpawn({ room });

  SpawnManager.run(room);

  expect(spawn.spawnCreep).toHaveBeenCalled();
});
```

**Mock Screeps Globals**:

```typescript
beforeEach(() => {
  global.Game = {
    time: 1000,
    cpu: { getUsed: () => 5.0, bucket: 10000 },
    spawns: {},
    creeps: {},
    rooms: {}
  };

  global.Memory = {
    creeps: {},
    rooms: {},
    stats: {}
  };
});
```

## Running Tests

### Local Development

```bash
# Run all unit tests
bun run test:unit

# Run specific test file
bun run test:unit tests/unit/memory-manager.test.ts

# Run with coverage
bun run test:coverage

# Run in watch mode (for development)
bun run test:unit --watch
```

### CI/CD Integration

**Guard Workflows**:

- `guard-test-unit.yml` - Unit tests on every PR
- `guard-test-regression.yml` - Regression tests on every PR
- `guard-test-e2e.yml` - E2E tests on every PR
- `guard-coverage.yml` - Coverage report on every PR

**Quality Gate**:

- All tests must pass
- Coverage must not decrease
- No new test failures

### PTR Validation

```bash
# Deploy to PTR
SCREEPS_BRANCH=ptr bun run deploy

# Monitor PTR (automated)
# See .github/workflows/screeps-monitoring.yml
```

## Performance Testing

### CPU Profiling

**Purpose**: Identify performance regressions and optimization opportunities

**Tools**:

- Built-in profiler (function-level CPU tracking)
- Performance test suite (`tests/performance/`)
- Benchmarking utilities

**Baseline Establishment** (#820):

```typescript
describe("Performance Baselines", () => {
  it("kernel execution should be under 5 CPU", () => {
    const cpuStart = Game.cpu.getUsed();
    kernel.loop();
    const cpuUsed = Game.cpu.getUsed() - cpuStart;

    expect(cpuUsed).toBeLessThan(5);
  });
});
```

**Monitoring**:

- Automated via screeps-monitoring.yml
- Profiler data collected every 30 minutes
- Alert on >20% performance degradation

### Load Testing

**Scenarios**:

- High creep count (50+ creeps)
- Multiple rooms (4+ rooms)
- Combat situations (defense, attacks)
- Complex pathfinding (congested areas)

**Validation**:

- CPU bucket should not deplete
- Tick execution under 10ms
- Memory usage stable

## Test Maintenance

### Regular Reviews

**Weekly**:

- Review failed tests in CI
- Address flaky tests
- Update mocks for API changes

**Monthly**:

- Review test coverage gaps
- Add missing critical tests
- Refactor brittle tests
- Update documentation

### Deprecation Strategy

**When removing features**:

1. Mark tests as deprecated
2. Document in test comments
3. Keep for 1-2 releases
4. Remove with CHANGELOG entry

### Test Debt Tracking

**Identify Test Debt**:

- Missing tests for critical components (#694, #634)
- Inadequate edge case coverage
- Flaky or brittle tests
- Outdated test scenarios

**Prioritize by Impact**:

1. Critical components without tests (HIGH)
2. Common bug scenarios without regression tests (HIGH)
3. Edge cases in stable components (MEDIUM)
4. Nice-to-have coverage improvements (LOW)

## Continuous Improvement

### Metrics to Track

**Test Health**:

- Pass rate over time (target: >99%)
- Flaky test rate (target: <1%)
- Test execution time (target: <2 minutes for unit tests)
- Coverage trends (target: increasing)

**Development Velocity**:

- Time to write tests for new features
- Time to fix failing tests
- Regression detection effectiveness

### Feedback Loops

**From Tests to Code**:

- Tests reveal unclear APIs → Improve API design
- Tests are hard to write → Improve modularity
- Tests are brittle → Improve abstraction

**From Production to Tests**:

- Production bugs → Add regression tests
- Performance issues → Add performance tests
- Edge cases discovered → Add edge case tests

## Related Documentation

- [Technical Debt Roadmap](../strategy/technical-debt-roadmap.md) - Testing priorities
- [Operational Runbooks](../operations/runbooks.md) - Testing procedures
- [ADR-001: Manager Architecture](../strategy/decisions/adr-001-manager-based-architecture.md) - Testability
- [AGENTS.md](../../AGENTS.md) - Testing in autonomous development

## References

- Vitest Documentation: https://vitest.dev/
- Testing Best Practices: https://testingjavascript.com/
- Screeps Server Mockup: https://github.com/screepers/screeps-server-mockup
