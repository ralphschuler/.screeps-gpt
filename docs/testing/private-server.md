# Private Screeps Server Testing Infrastructure

Comprehensive guide to performance testing using private Screeps server.

## Overview

The private Screeps server testing infrastructure enables automated bot performance benchmarking in competitive simulation environments. Tests validate bot improvements, detect performance regressions, and measure competitive capabilities against AI opponents.

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│  Performance Test Suite (tests/performance/)            │
│  - Bot deployment automation                            │
│  - Competitive simulation orchestration                 │
│  - Metrics collection and analysis                      │
└─────────────────┬───────────────────────────────────────┘
                  │
                  v
┌─────────────────────────────────────────────────────────┐
│  Private Screeps Server (Docker)                        │
│  - screepers/screeps-launcher base image                │
│  - MongoDB for game state persistence                   │
│  - Redis for server cache                               │
│  - Speedrun mode for fast simulation                    │
└─────────────────┬───────────────────────────────────────┘
                  │
                  v
┌─────────────────────────────────────────────────────────┐
│  Bot Opponents (screepsmod-bots)                        │
│  - overmind (aggressive expansion)                      │
│  - tooangel (balanced strategy)                         │
│  - choreographer (defensive play)                       │
│  - simplebot (basic harvesting)                         │
└─────────────────────────────────────────────────────────┘
```

### Docker Infrastructure

Three interconnected services:

1. **MongoDB** - Game state and player data storage
2. **Redis** - Server cache and session management
3. **Screeps Server** - Game engine with performance testing mods

See `docker-compose.test.yml` for complete configuration.

## Server Mods

The test server includes specialized mods for performance testing:

### Core Testing Mods

- **screepsmod-admin-utils** - Administrative control and user management
- **screepsmod-bots** - Deploy and manage AI opponent bots
- **@admon-dev/screepsmod-speedrun** - Fast simulation mode (no tick delay)
- **@brisberg/screepsmod-lockstep** - Step-by-step debugging capability

### Simulation Enhancement Mods

- **screepsmod-dynamicmarket** - Realistic market simulation
- **screepsmod-features** - Advanced game features
- **screepsmod-portals** - Inter-room portal mechanics
- **screepsmod-gcltocpu** - Dynamic CPU allocation

See `packages/pserver/config.yml` for complete mod list and configuration.

## Running Performance Tests

### Prerequisites

- Docker and Docker Compose installed
- At least 4GB RAM available
- Bot code built (`npm run build`)

### Local Testing

**Step 1: Start Private Server**

```bash
docker-compose -f docker-compose.test.yml up -d screeps-test-server
```

**Step 2: Wait for Server Ready**

```bash
# Check health status
docker-compose -f docker-compose.test.yml ps

# View logs
docker-compose -f docker-compose.test.yml logs -f screeps-test-server
```

**Step 3: Run Performance Tests**

```bash
# Run via npm script
npm run test:performance

# Or run via Docker
npm run docker:test:performance
```

**Step 4: Stop Server**

```bash
docker-compose -f docker-compose.test.yml down
```

### CI/CD Integration

Performance tests run automatically in GitHub Actions:

**Trigger Conditions:**
- Pull requests modifying `packages/bot/src/runtime/**`
- Manual workflow dispatch via Actions UI

**Workflow:** `.github/workflows/performance-test.yml`

The workflow:
1. Builds bot code
2. Starts private Screeps server
3. Runs performance test suite
4. Generates performance report
5. Comments results on PR

## Performance Metrics

### Tracked Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| **Average CPU** | CPU consumption per tick | < 20 CPU/tick |
| **Energy Efficiency** | Energy harvested vs. consumed | > 0.80 ratio |
| **Controller Level** | Room control progress | ≥ 3 within 10k ticks |
| **Survival Time** | Ticks survived in simulation | > 8000 ticks |
| **Victory Rate** | Win vs. loss against opponents | > 70% win rate |

### Baseline Comparison

Current run metrics are compared against baseline stored in `reports/performance/baseline.json`.

**Regression Detection:**
- CPU usage increase > 10%
- Energy efficiency decrease > 10%
- Controller level decrease
- Victory rate decrease > 15%

## Test Configuration

### Environment Variables

```bash
# Server connection
export SCREEPS_SERVER=http://localhost:21025

# Authentication
export SCREEPS_TEST_USERNAME=screeps-gpt
export SCREEPS_TEST_PASSWORD=test-password

# Test parameters (optional)
export PERFORMANCE_MAX_TICKS=10000
export PERFORMANCE_CHECK_INTERVAL=100
```

### Test Parameters

Modify in `tests/performance/bot-benchmark.test.ts`:

```typescript
const testConfig = {
  maxTicks: 10000,        // Maximum simulation ticks
  checkInterval: 100,     // State check frequency
  speedrunMode: true,     // Fast simulation
};
```

## Bot Opponents

The test server deploys AI bots from the screepsmod-bots ecosystem:

### Available Opponents

1. **Overmind** (`screeps-bot-overmind`)
   - Aggressive expansion strategy
   - Advanced room planning
   - High CPU utilization

2. **TooAngel** (`screeps-bot-tooangel`)
   - Balanced resource management
   - Defensive positioning
   - Moderate complexity

3. **Choreographer** (`screeps-bot-choreographer`)
   - Defensive-focused play
   - Efficient harvesting
   - Conservative expansion

4. **SimpleBot** (`@screeps/simplebot`)
   - Basic harvesting logic
   - Minimal complexity
   - Baseline opponent

### Opponent Configuration

Edit `packages/pserver/bots.yml` to configure opponent placement and resources:

```yaml
bots:
  - username: overmind
    botName: overmind
    position: 22,13,W21N23
    cpu: 200
    gcl: 1
```

## Speedrun Mode

Speedrun mode enables fast simulation by removing tick delays:

**Benefits:**
- Tests complete in minutes instead of hours
- Rapid iteration on performance improvements
- Efficient CI/CD integration

**Activation:**

```javascript
// Via console command
Game.speedrunMode = true;

// Or in test configuration
await api.console('Game.speedrunMode = true');
```

**Performance Impact:**
- Normal mode: ~2.5 ticks/second
- Speedrun mode: ~100+ ticks/second (hardware dependent)

## Updating Baseline Metrics

After verified performance improvements:

**Step 1: Run Tests**

```bash
npm run test:performance
```

**Step 2: Review Results**

```bash
cat reports/performance/latest.json
```

**Step 3: Update Baseline** (if improved)

```bash
# Backup current baseline
cp reports/performance/baseline.json reports/performance/baseline.v0.77.0.json

# Update to new baseline
cp reports/performance/latest.json reports/performance/baseline.json

# Commit changes
git add reports/performance/baseline.json
git commit -m "chore: update performance baseline after optimization"
```

## Troubleshooting

### Server Won't Start

**Symptom:** `screeps-test-server` container exits immediately

**Solutions:**
- Check Docker logs: `docker-compose -f docker-compose.test.yml logs`
- Verify port 21025 not in use: `lsof -i :21025`
- Ensure MongoDB and Redis healthy: `docker-compose -f docker-compose.test.yml ps`

### Tests Timing Out

**Symptom:** Tests exceed 10-minute timeout

**Solutions:**
- Increase `maxTicks` if simulation needs more time
- Verify speedrun mode enabled
- Check server resource allocation (CPU/RAM)
- Review bot code for infinite loops or CPU spikes

### Metrics Not Collected

**Symptom:** Performance metrics return defaults/zeros

**Solutions:**
- Verify bot deployed successfully
- Check API authentication
- Ensure server mods loaded correctly
- Review console output for errors

### Docker Resource Issues

**Symptom:** Containers slow or crashing

**Solutions:**
- Allocate more Docker RAM (≥4GB recommended)
- Reduce concurrent tests
- Clean up old containers: `docker system prune`
- Monitor resource usage: `docker stats`

## Advanced Usage

### Custom Simulation Scenarios

Create custom test scenarios by modifying server configuration:

```yaml
# packages/pserver/config.yml
serverConfig:
  constants:
    ENERGY_REGEN_TIME: 300    # Adjust resource regeneration
    CREEP_LIFE_TIME: 1500     # Modify creep lifespan
```

### Multi-Room Testing

Test bot performance across multiple rooms:

```typescript
// Add rooms to simulation
await world.addRoom('W21N23');
await world.addRoom('W22N23');

// Deploy bot in multiple locations
await deployBot(api, 'screeps-gpt', botCode, ['W21N23', 'W22N23']);
```

### Performance Profiling

Enable detailed profiling for performance analysis:

```bash
# Build with profiler enabled
PROFILER_ENABLED=true npm run build

# Run tests with profiling
npm run test:performance

# Review profiler output
cat reports/profiler/latest.json
```

## Related Documentation

- [Testing Strategy](../development/testing-strategy.md)
- [CI/CD Workflows](../automation/workflows.md)
- [Bot Architecture](../runtime/architecture.md)
- [Performance Optimization](../development/performance-optimization.md)

## External Resources

- [Screeps Launcher](https://github.com/screepers/screeps-launcher) - Private server Docker image
- [screepsmod-bots](https://www.npmjs.com/package/screepsmod-bots) - Bot deployment mod
- [Speedrun Mod](https://www.npmjs.com/package/@admon-dev/screepsmod-speedrun) - Fast simulation
- [Screeps API](https://docs.screeps.com/api/) - Official game API documentation
