# Screeps Server Mockup Tests

This directory contains tick-based tests using [screeps-server-mockup](https://github.com/screepers/screeps-server-mockup).

## Overview

The Screeps Server Mockup allows for deterministic, tick-by-tick testing of Screeps AI code. Unlike traditional unit tests that mock individual components, these tests run code in a simulated Screeps server environment, enabling:

- **Tick-based testing**: Run code for specific numbers of ticks and inspect state between ticks
- **Deterministic behavior**: Tests produce consistent results across runs
- **Full game simulation**: Access to real Screeps game objects (rooms, creeps, structures)
- **Custom world setup**: Create specific room layouts, terrain, and initial conditions

## Running Tests

```bash
bun run test:mockup
```

## Test Structure

- `setup.ts` - Helper functions for initializing test servers and creating bot modules
- `*.mockup.test.ts` - Test files using the mockup server

## Example Usage

```typescript
import { createTestServer, createBotModule, cleanupServer } from "./setup";

const server = await createTestServer();

const modules = createBotModule(`
  module.exports.loop = function() {
    console.log('Tick:', Game.time);
    Memory.lastTick = Game.time;
  };
`);

const bot = await server.world.addBot({
  username: "test-bot",
  room: "W0N1",
  x: 25,
  y: 25,
  modules
});

await server.start();

// Run 5 ticks
for (let i = 0; i < 5; i++) {
  await server.tick();
}

const memory = await bot.memory;
console.log("Last tick:", memory.lastTick);

cleanupServer(server);
```

## Known Limitations

### isolated-vm Build Issues

The `screeps-server-mockup` package depends on `isolated-vm`, which uses native Node.js addons that require compilation. On some platforms and Node.js versions, `isolated-vm` may fail to build due to:

- Incompatibility with older node-gyp versions
- C++ compiler version mismatches
- Python 2 vs Python 3 requirements in older node-gyp

If you encounter build errors, try:

1. Ensure you have Python 3 installed
2. Set the Python path: `export npm_config_python=python3`
3. Install build tools for your platform
4. Update node-gyp: `npm install -g node-gyp@latest`

### Testing Full Kernel

Currently, testing the full production kernel (from `src/runtime/bootstrap/kernel.ts`) within the mockup environment may require bundling or module resolution adjustments, as the isolated-vm environment has different module resolution semantics than the test environment.

For comprehensive kernel testing, the existing e2e tests in `tests/e2e/` provide good coverage using mocked game objects.

## Best Practices

1. **Clean up servers**: Always use the `cleanupServer()` helper in `afterEach` hooks
2. **Set timeouts**: Mockup tests involve server initialization; use appropriate timeouts (e.g., 30s)
3. **Keep tests focused**: Test specific behaviors over a small number of ticks
4. **Use memory for assertions**: Store state in Memory and check it after ticks complete
5. **Test incrementally**: Start with simple code, then build complexity

## References

- [screeps-server-mockup GitHub](https://github.com/screepers/screeps-server-mockup)
- [Screeps API Documentation](https://docs.screeps.com/api/)
