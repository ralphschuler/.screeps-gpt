# Pathfinding System

## Overview

The bot uses a flexible pathfinding abstraction layer that allows switching between different pathfinding implementations. This provides the ability to use advanced pathfinding libraries like screeps-cartographer for optimized movement, while maintaining backward compatibility with Screeps' native pathfinding.

## Architecture

### Pathfinding Providers

The pathfinding system is built around the `PathfindingProvider` interface, which defines a common API for different pathfinding implementations:

```typescript
interface PathfindingProvider {
  findPath(
    origin: RoomPosition,
    goal: RoomPosition | { pos: RoomPosition },
    opts?: PathfindingOptions
  ): PathfindingResult;
  moveTo(creep: Creep, target: RoomPosition | { pos: RoomPosition }, opts?: PathfindingOptions): ScreepsReturnCode;
  getName(): string;
}
```

### Available Providers

#### Default Pathfinder

The `DefaultPathfinder` uses Screeps' native `PathFinder.search()` and `creep.moveTo()` methods. This is the baseline implementation that maintains the original behavior of the bot.

**Characteristics:**

- Uses native Screeps pathfinding algorithms
- Minimal CPU overhead
- Well-tested and stable
- No external dependencies

#### Cartographer Pathfinder

The `CartographerPathfinder` uses the [screeps-cartographer](https://www.npmjs.com/package/screeps-cartographer) library for advanced pathfinding with caching and optimization.

**Characteristics:**

- Advanced path caching across ticks
- Optimized multi-room pathfinding
- Highway preference for long-distance travel
- Source Keeper room avoidance
- Stuck detection and automatic repathing
- Higher initial CPU cost, but savings on subsequent ticks

## Configuration

### Enabling Cartographer Pathfinding

To enable the cartographer pathfinding provider, configure it in the kernel or when instantiating the BehaviorController or TaskManager:

```typescript
// In BehaviorController
const behaviorController = new BehaviorController({
  pathfindingProvider: "cartographer", // or "default"
  useTaskSystem: true,
  cpuSafetyMargin: 0.85
});

// In TaskManager (used by task system)
const taskManager = new TaskManager({
  pathfindingProvider: "cartographer",
  cpuThreshold: 0.8
});
```

### Pathfinding Options

Both providers support a common set of pathfinding options:

```typescript
interface PathfindingOptions {
  range?: number; // Target range (default: 1)
  reusePath?: number; // Ticks to reuse cached path (default: 5)
  ignoreCreeps?: boolean; // Ignore other creeps (default: false)
  maxRooms?: number; // Max rooms to search (default: 16)
  maxOps?: number; // Max pathfinding operations (default: 2000)
  costCallback?: (roomName: string, costMatrix: CostMatrix) => CostMatrix | void;
  plainCost?: number; // Plain terrain cost (default: 1)
  swampCost?: number; // Swamp terrain cost (default: 5)
}
```

## Integration Points

### Task System Integration

When the task system is enabled (`useTaskSystem: true`), all task actions automatically use the configured pathfinding provider. The `TaskAction` base class has a `moveToTarget()` method that delegates to the pathfinding manager:

```typescript
export abstract class TaskAction {
  protected pathfindingManager?: PathfindingManager;

  protected moveToTarget(creep: Creep, target: RoomPosition | { pos: RoomPosition }, range = 1): void {
    if (this.pathfindingManager) {
      this.pathfindingManager.moveTo(creep, target, { range, reusePath: 5 });
    } else {
      creep.moveTo(target, { range, reusePath: 5 });
    }
  }
}
```

### Legacy Role System

The legacy role-based system (when `useTaskSystem: false`) currently uses native `creep.moveTo()` calls directly. These calls bypass the pathfinding abstraction layer and always use the default Screeps pathfinding.

To use cartographer pathfinding with the legacy role system, the role functions would need to be refactored to accept a pathfinding manager parameter.

## Performance Considerations

### CPU Usage

- **Default Pathfinder:** Consistent CPU usage per call, typically 0.1-0.5 CPU per moveTo
- **Cartographer:** Higher initial cost (0.5-2.0 CPU for first path), but subsequent calls using cached paths cost <0.1 CPU

### Memory Usage

- **Default Pathfinder:** Minimal memory usage (path stored in creep memory)
- **Cartographer:** Additional memory for path caching (configurable)

### Recommended Strategy

1. **Start with default:** Use the default pathfinder initially to establish a baseline
2. **Profile your bot:** Use the profiler to measure pathfinding CPU usage
3. **Test on PTR:** Enable cartographer on PTR to measure real-world performance
4. **Compare results:** Look for overall CPU savings, especially with many creeps
5. **Gradual rollout:** Enable in production if PTR results show improvement

## Build Impact

Adding screeps-cartographer increases the build size:

- **Without cartographer:** ~579kb
- **With cartographer:** ~713kb (+134kb)

The additional build size is acceptable given the potential CPU savings from advanced pathfinding and caching.

## Testing

### Unit Tests

The pathfinding abstraction layer has comprehensive unit tests covering:

- Provider initialization and configuration
- Path caching behavior
- Option passing and configuration
- Fallback behavior

### Test Environment

In the test environment, screeps-cartographer is properly mocked to avoid dependency on the Screeps Game object:

```typescript
// tests/setup.ts
globals.Game = {
  time: 0,
  cpu: { limit: 500, tickLimit: 500, bucket: 10000, getUsed: () => 0 }
};

globals.Memory = {};

globals.PathFinder = {
  search: () => ({ path: [], ops: 0, cost: 0, incomplete: false })
};
```

## Future Enhancements

### Planned Improvements

1. **Traffic Management Integration:** Integrate cartographer's traffic management with the existing TrafficManager
2. **Room-Specific Configuration:** Allow different pathfinding providers per room based on traffic or complexity
3. **Dynamic Switching:** Automatically switch providers based on CPU availability
4. **Cost Matrix Optimization:** Pre-calculate cost matrices for frequently-traveled rooms
5. **Benchmark Suite:** Add automated benchmarks to measure pathfinding performance

### Migration Path for Legacy Roles

To enable cartographer pathfinding in the legacy role system:

1. Refactor role functions to accept a pathfinding manager parameter
2. Update BehaviorController to pass the pathfinding manager to role functions
3. Replace direct `creep.moveTo()` calls with pathfinding manager calls
4. Test thoroughly to ensure backward compatibility

## Related Documentation

- [Task System Documentation](./task-system.md) - Task system architecture
- [Memory Management](./memory-management.md) - Memory optimization strategies
- [Logging and Visuals](./logging-and-visuals.md) - Debugging pathfinding issues

## External Resources

- [screeps-cartographer on npm](https://www.npmjs.com/package/screeps-cartographer)
- [Screeps PathFinder API](https://docs.screeps.com/api/#PathFinder)
- [Creep.moveTo Documentation](https://docs.screeps.com/api/#Creep.moveTo)
