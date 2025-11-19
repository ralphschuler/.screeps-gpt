# @ralphschuler/screeps-perf

Drop-in, zero configuration performance optimization library for [Screeps](https://screeps.com).

This library helps reduce CPU usage by providing optimized implementations of common operations:

- Faster array methods using for-loops
- Automatic cleanup of dead creep memory
- Intelligent caching of pathfinding results

## Installation

```bash
npm install @ralphschuler/screeps-perf
```

Or with bun:

```bash
bun add @ralphschuler/screeps-perf
```

## Usage

### Basic Setup

Add this to the top of your `main.js` or `main.ts` file, before any other imports:

```typescript
import { setupPerformanceOptimizations } from "@ralphschuler/screeps-perf";

// Enable all optimizations with default settings
setupPerformanceOptimizations();

export function loop() {
  // Your game logic here
}
```

**Important**: This library should be the first thing imported in your scripts because it adjusts functions that your other scripts might use.

### Advanced Configuration

You can selectively enable or disable specific optimizations:

```typescript
import { setupPerformanceOptimizations } from "@ralphschuler/screeps-perf";

const perf = setupPerformanceOptimizations({
  speedUpArrayFunctions: true, // Optimize array methods (default: true)
  cleanUpCreepMemory: true, // Auto-cleanup dead creeps (default: true)
  optimizePathFinding: true // Cache pathfinding results (default: true)
});
```

### Using Original findPath

Cached paths may not always be optimal depending on room conditions. To access the uncached pathfinding:

```typescript
import { setupPerformanceOptimizations } from "@ralphschuler/screeps-perf";

const perf = setupPerformanceOptimizations();

// Later in your code, use the original findPath
const room = Game.rooms["W1N1"];
const path = perf.originalFindPath.call(room, startPos, endPos);
```

## Features

### Array Function Optimizations

Native JavaScript array methods (`filter`, `forEach`, `map`) have internal overhead. This library replaces them with faster for-loop implementations optimized for the V8 engine used by Screeps.

**Performance Impact**: Reduces CPU usage by 10-30% for array-heavy operations.

### Automatic Creep Memory Cleanup

Dead creeps leave behind memory entries that increase memory parsing time each tick. This module automatically removes memory for non-existent creeps every 100 ticks.

**How it works**: Monkey-patches `Spawn.prototype.createCreep` to trigger periodic cleanup without requiring explicit calls from your code.

**Performance Impact**: Reduces memory parse time, especially in games with high creep turnover.

### Path Finding Cache

Pathfinding is one of the most CPU-intensive operations in Screeps. This module caches `Room.findPath` results in memory and intelligently reuses them.

**Cache Policy**:

- Paths are cached per unique start/end position pair
- Cached paths are removed if used less than once per 300 ticks
- Cached paths expire after 2000 ticks to adapt to room changes
- Cache is cleaned every 40 ticks per room

**Performance Impact**: Can reduce pathfinding CPU usage by 50-90% depending on your creep behavior patterns.

## TypeScript Support

This library is written in TypeScript and includes full type definitions. It properly extends the Screeps type declarations.

## Memory Structure

The library uses the following Memory structures:

```typescript
interface Memory {
  screepsPerf?: {
    lastMemoryCleanUp: number;
  };
  pathOptimizer?: {
    lastCleaned: number;
    [pathIdentifier: string]: {
      tick: number;
      path: string;
      used: number;
    };
  };
}
```

## Compatibility

- **Node.js**: >= 18.0.0
- **Bun**: >= 1.0.0
- **Screeps**: Compatible with both MMO and private servers
- **TypeScript**: >= 5.0.0

## Credits

Based on the original [screeps-perf](https://www.npmjs.com/package/screeps-perf) by [Gary Borton](https://github.com/gdborton), rewritten in TypeScript with enhanced type safety and modern module structure.

## License

MIT © OpenAI Automations
