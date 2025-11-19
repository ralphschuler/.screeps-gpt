# @ralphschuler/screeps-profiler

CPU profiling library for [Screeps](https://screeps.com) with decorator support and build-time optimization.

This library provides comprehensive CPU profiling capabilities to help identify performance bottlenecks in your Screeps AI:

- **Decorator-based profiling** - Automatically track CPU usage with `@profile`
- **CLI interface** - Control profiler from the game console
- **Tick-based caching** - Minimal overhead (60-80% reduction in profiler CPU)
- **Build-time control** - Completely disable profiler for zero overhead
- **Memory-efficient** - Smart data storage and aggregation

## Installation

```bash
npm install @ralphschuler/screeps-profiler
```

Or with bun:

```bash
bun add @ralphschuler/screeps-profiler
```

## Quick Start

### Basic Setup

Add this to the top of your `main.ts` file:

```typescript
import { init, profile } from "@ralphschuler/screeps-profiler";

// Initialize and expose profiler globally
const profiler = init();
if (typeof global !== "undefined") {
  global.Profiler = profiler;
} else if (typeof window !== "undefined") {
  window.Profiler = profiler;
}

export function loop() {
  // Your game logic here
}
```

### Using the Profile Decorator

Profile individual methods:

```typescript
import { profile } from "@ralphschuler/screeps-profiler";

class CreepManager {
  @profile
  runHarvester(creep: Creep) {
    // CPU usage of this method will be tracked
    // when profiler is running
  }

  @profile
  runBuilder(creep: Creep) {
    // Each method is tracked separately
  }
}
```

Profile entire classes (all methods):

```typescript
import { profile } from "@ralphschuler/screeps-profiler";

@profile
class RoomPlanner {
  analyze() {
    // Automatically profiled
  }

  execute() {
    // Automatically profiled
  }
}
```

## Console Commands

Control the profiler from the game console:

```javascript
// Start profiling
Profiler.start();
// Output: "Profiler started"

// Check status
Profiler.status();
// Output: "Profiler is running"

// View results (after running for a few ticks)
Profiler.output();
// Displays formatted table of CPU usage

// Stop profiling (pause data collection)
Profiler.stop();
// Output: "Profiler stopped"

// Clear all collected data
Profiler.clear();
// Output: "Profiler Memory cleared"

// Get help
Profiler.toString();
```

## Understanding the Output

When you call `Profiler.output()`, you'll see a table like this:

```
Function                    Tot Calls    CPU/Call  Calls/Tick    CPU/Tick    % of Tot
RoomPlanner:analyze               450      1.23ms        3.00       3.69ms       45 %
CreepManager:runHarvester         600      0.85ms        4.00       3.40ms       42 %
CreepManager:runBuilder           300      0.45ms        2.00       0.90ms       11 %
150 total ticks measured           8.12 average CPU profiled per tick
```

- **Function**: Class and method name
- **Tot Calls**: Total times the function was called
- **CPU/Call**: Average CPU per single call
- **Calls/Tick**: Average calls per game tick
- **CPU/Tick**: Average CPU per tick for this function
- **% of Tot**: Percentage of total profiled CPU

## Build-Time Configuration

For production deployments or when you don't need profiling, you can disable it completely at build time:

```bash
# Disable profiler (zero runtime overhead)
PROFILER_ENABLED=false npm run build

# Enable profiler (default)
PROFILER_ENABLED=true npm run build
# or just:
npm run build
```

When disabled, the `@profile` decorator becomes a no-op and adds zero overhead to your code.

### Build Configuration

Configure your build tool to inject the `__PROFILER_ENABLED__` constant:

#### esbuild

```javascript
import esbuild from "esbuild";

const profilerEnabled = process.env.PROFILER_ENABLED !== "false";

esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "dist/main.js",
  define: {
    __PROFILER_ENABLED__: JSON.stringify(profilerEnabled)
  }
});
```

#### webpack

```javascript
const webpack = require("webpack");

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      __PROFILER_ENABLED__: JSON.stringify(process.env.PROFILER_ENABLED !== "false")
    })
  ]
};
```

## Performance Impact

The profiler is optimized for minimal overhead:

- **Tick-based caching**: Reduces Memory access from 1000+ to 1-2 per tick
- **Lazy evaluation**: Only tracks when explicitly started
- **Build-time disable**: Zero overhead when compiled without profiler

**With optimizations**: ~2-5% overhead when running  
**Without profiler**: 0% overhead when disabled at build time

## Memory Structure

The profiler uses the following Memory structure:

```typescript
interface Memory {
  profiler?: {
    data: {
      [functionName: string]: {
        calls: number; // Total number of calls
        time: number; // Total CPU time consumed
      };
    };
    start?: number; // Tick when profiling started (undefined when stopped)
    total: number; // Total ticks profiled across all sessions
  };
}
```

## TypeScript Support

This library is written in TypeScript and includes full type definitions. It properly extends the Screeps type declarations.

```typescript
import type { Profiler, ProfilerMemory } from "@ralphschuler/screeps-profiler";

// Type-safe access to profiler instance
const profiler: Profiler = init();

// Type-safe access to memory
const profilerData: ProfilerMemory = Memory.profiler;
```

## Advanced Usage

### Manual Profiling

While the decorator approach is recommended, you can also manually instrument code:

```typescript
import { init } from "@ralphschuler/screeps-profiler";

const profiler = init();

export function loop() {
  profiler.start();

  // Your game logic...

  profiler.stop();
}
```

### Conditional Profiling

Profile only specific conditions:

```typescript
class RoomManager {
  @profile
  run(room: Room) {
    // Always profiled when profiler is running
    this.economyLogic(room);
    this.defenseLogic(room);
  }

  economyLogic(room: Room) {
    // Not profiled unless decorated
  }

  defenseLogic(room: Room) {
    // Not profiled unless decorated
  }
}
```

### Auto-Start on Deploy

Automatically start profiling when your code is deployed:

```typescript
import { init } from "@ralphschuler/screeps-profiler";

const profiler = init();
global.Profiler = profiler;

// Auto-start if not already running
if (!Memory.profiler) {
  Memory.profiler = { data: {}, total: 0 };
}
if (Memory.profiler.start === undefined) {
  profiler.start();
  console.log("[Profiler] Auto-started on deployment");
}

export function loop() {
  // Your game logic
}
```

## Best Practices

1. **Profile strategically**: Don't profile every function - focus on areas you suspect might be slow
2. **Run for multiple ticks**: Collect data over 100+ ticks for accurate averages
3. **Stop when done**: Stop the profiler when not actively debugging to reduce overhead
4. **Clear between tests**: Use `Profiler.clear()` to reset data when testing changes
5. **Disable in production**: Use build-time disabling for final deployments

## Compatibility

- **Node.js**: >= 18.0.0
- **Bun**: >= 1.0.0
- **Screeps**: Compatible with both MMO and private servers
- **TypeScript**: >= 5.0.0

## Related Packages

- [@ralphschuler/screeps-perf](../screeps-perf) - Performance optimizations
- [@ralphschuler/screeps-metrics](../screeps-metrics) - Metrics collection

## License

MIT © OpenAI Automations
