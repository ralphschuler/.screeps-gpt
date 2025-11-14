# Performance Tests

Automated bot performance benchmarking using private Screeps server.

## Overview

This test suite validates bot performance in competitive simulation environments. Tests deploy the bot alongside AI opponents and measure survival time, CPU efficiency, and strategic effectiveness.

## Requirements

- Docker and Docker Compose
- Built bot code (`bun run build` or `npm run build`)
- At least 4GB RAM available for containers

## Running Tests

### Local Development

```bash
# Start private Screeps server
docker-compose -f docker-compose.test.yml up -d screeps-test-server

# Wait for server to be ready (check health)
docker-compose -f docker-compose.test.yml ps

# Run performance tests
npm run test:performance

# Stop server
docker-compose -f docker-compose.test.yml down
```

### CI/CD

Performance tests run automatically on:

- Pull requests modifying `packages/bot/src/runtime/**`
- Manual workflow dispatch

See `.github/workflows/performance-test.yml` for details.

## Test Structure

- **bot-benchmark.test.ts** - Main competitive simulation tests
  - Victory/defeat detection
  - Survival time tracking
  - CPU efficiency measurement
  - Baseline comparison

## Performance Metrics

Tracked metrics include:

- **Average CPU Usage** - CPU consumption per tick
- **Energy Efficiency** - Energy harvested vs. consumed
- **Controller Level** - Room control progress
- **Survival Time** - Ticks survived in simulation
- **Victory Rate** - Win/loss against opponents

## Baseline Management

Baseline metrics are stored in `reports/performance/baseline.json`.

To update baseline after verified improvements:

```bash
# Run tests and capture new metrics
npm run test:performance

# Review results
cat reports/performance/latest.json

# Update baseline if improved
cp reports/performance/latest.json reports/performance/baseline.json
git add reports/performance/baseline.json
git commit -m "chore: update performance baseline"
```

## Configuration

Environment variables:

- `SCREEPS_SERVER` - Server URL (default: `http://localhost:21025`)
- `SCREEPS_TEST_USERNAME` - Bot username (default: `screeps-gpt`)
- `SCREEPS_TEST_PASSWORD` - Bot password (default: `test-password`)

## Troubleshooting

### Server Not Starting

```bash
# Check Docker logs
docker-compose -f docker-compose.test.yml logs screeps-test-server

# Verify dependencies are healthy
docker-compose -f docker-compose.test.yml ps
```

### Tests Timing Out

- Increase `maxTicks` in test configuration
- Check server resource allocation
- Verify speedrun mode is enabled

### Metrics Not Collected

- Ensure bot code is deployed successfully
- Check API authentication
- Verify server mods are loaded correctly

## Related Documentation

- [Private Server Setup](../../docs/testing/private-server.md)
- [Testing Strategy](../../docs/development/testing-strategy.md)
- [CI/CD Workflows](../../docs/automation/workflows.md)
