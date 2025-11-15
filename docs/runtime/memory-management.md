# Traffic Memory Management

## Overview

The TrafficManager implements memory management features to prevent unbounded memory growth during multi-room operations. This document describes the memory management strategies, configuration options, and monitoring procedures.

## Problem Statement

Traffic tracking accumulates position data over time across all rooms. Without size limits, this can lead to:

- **Memory exhaustion**: Screeps limits Memory to ~2MB
- **CPU overhead**: Large data structures increase JSON serialization costs
- **Silent degradation**: No warnings when traffic data grows excessively
- **Scaling blockers**: Prevents efficient multi-room empire management

## Memory Management Strategy

### Size Limits

The TrafficManager enforces two types of limits:

1. **Global Position Limit** (`maxTotalPositions`): Maximum total traffic positions across all rooms
2. **Per-Room Position Limit** (`maxPositionsPerRoom`): Maximum positions tracked in any single room

### Decay and Pruning

Traffic data undergoes periodic decay and pruning:

1. **Normal Decay**: Applied every 50 ticks (configurable via `InfrastructureManager.trafficDecayInterval`)
   - Default decay rate: 0.98 per decay cycle
   - Positions below cleanup threshold (default: 1) are removed

2. **Aggressive Decay**: Triggered at 80% capacity (configurable via `aggressiveDecayThreshold`)
   - Decay multiplier increased to 0.9 (positions decay 10% faster)
   - Helps prevent reaching hard limits

3. **Hard Limit Enforcement**: When limits are exceeded
   - Lowest-traffic positions are pruned first
   - High-traffic positions (important for road planning) are preserved
   - Separate enforcement for per-room and global limits

### Pruning Strategy

When pruning is required, positions are prioritized for removal in this order:

1. **Lowest traffic count**: Positions with minimal movement
2. **Age**: Older positions with stale data
3. **Room balance**: Ensures no single room dominates the budget

## Configuration Options

### TrafficManager Configuration

```typescript
interface TrafficManagerConfig {
  // Size Limits
  maxPositionsPerRoom?: number; // Default: 500
  maxTotalPositions?: number; // Default: 2000
  aggressiveDecayThreshold?: number; // Default: 0.8 (80% of max)

  // Decay Settings
  trafficDecayRate?: number; // Default: 0.98
  trafficCleanupThreshold?: number; // Default: 1
  aggressiveDecayMultiplier?: number; // Default: 0.9 (10% faster decay)

  // Warning Thresholds
  warningThreshold?: number; // Default: 0.9 (90% of max)

  // Traffic Analysis
  enableTrafficAnalysis?: boolean; // Default: true
}
```

### InfrastructureManager Configuration

```typescript
interface InfrastructureManagerConfig {
  trafficDecayInterval?: number; // Default: 50 ticks
  enableTrafficAnalysis?: boolean; // Default: true
}
```

### Recommended Settings

**Small Empire (1-3 rooms):**

```typescript
{
  maxPositionsPerRoom: 300,
  maxTotalPositions: 1000,
  trafficDecayInterval: 50
}
```

**Medium Empire (4-8 rooms):**

```typescript
{
  maxPositionsPerRoom: 400,
  maxTotalPositions: 2000,
  trafficDecayInterval: 50
}
```

**Large Empire (9+ rooms):**

```typescript
{
  maxPositionsPerRoom: 500,
  maxTotalPositions: 3000,
  trafficDecayInterval: 100
}
```

## Monitoring and Debugging

### Memory Usage Statistics

Use `getMemoryUsageStats()` to monitor traffic memory consumption:

```typescript
const stats = trafficManager.getMemoryUsageStats();

console.log(`Traffic positions: ${stats.positionCount}/${stats.maxTotalPositions}`);
console.log(`Memory usage: ~${stats.estimatedBytes} bytes`);
console.log(`Utilization: ${stats.utilizationPercent.toFixed(1)}%`);
```

### Automatic Warnings

The TrafficManager logs warnings when:

- Traffic data exceeds 90% of maximum capacity
- Pruning operations are triggered
- Per-room limits are exceeded

Example warning:

```
[TrafficManager] Traffic data at 1800/2000 positions (90.0%)
[TrafficManager] Pruned 5 low-traffic positions to enforce size limit
[TrafficManager] Pruned 100 positions in room W1N1 (exceeded 500 limit)
```

### Integration with MemoryUtilizationMonitor

The traffic memory management system works alongside the `MemoryUtilizationMonitor` for comprehensive memory tracking:

```typescript
import { MemoryUtilizationMonitor } from "@runtime/memory/MemoryUtilizationMonitor";

const monitor = new MemoryUtilizationMonitor();
const utilization = monitor.measure(Memory);

if (utilization.isWarning || utilization.isCritical) {
  const trafficStats = trafficManager.getMemoryUsageStats();
  console.log(`Traffic memory: ${trafficStats.estimatedBytes} bytes`);
}
```

### Debugging High Memory Usage

If traffic memory usage is unexpectedly high:

1. **Check utilization**: Call `getMemoryUsageStats()`
2. **Review high-traffic areas**: Call `getHighTrafficPositions(threshold)`
3. **Adjust limits**: Lower `maxPositionsPerRoom` or `maxTotalPositions`
4. **Increase decay frequency**: Reduce `trafficDecayInterval`
5. **Increase decay rate**: Lower `trafficDecayRate` (more aggressive)

## Memory Budget Recommendations

Based on Screeps 2MB memory limit:

- **Infrastructure (including traffic)**: 10-20% (200-400KB)
- **Traffic data**: 5-10% (100-200KB)
- **Creep memory**: 20-30% (400-600KB)
- **Room memory**: 20-30% (400-600KB)
- **Other systems**: 20-40% (400-800KB)

With default settings (2000 positions × 50 bytes ≈ 100KB), traffic data uses ~5% of available memory, which is within recommended limits.

## Related Systems

### MemorySelfHealer

The `MemorySelfHealer` ensures memory consistency and can help identify issues:

- Validates memory structure integrity
- Removes invalid or corrupted entries
- Works in conjunction with traffic memory management

### MemoryUtilizationMonitor

Provides overall memory monitoring and threshold alerts:

- Tracks total memory usage
- Alerts at warning (70%) and critical (90%) thresholds
- Helps identify which subsystems are consuming memory

## Best Practices

1. **Monitor regularly**: Check traffic memory stats periodically
2. **Adjust for scale**: Increase limits as empire grows
3. **Balance with other systems**: Ensure traffic doesn't dominate memory budget
4. **Test in simulation**: Validate configuration changes in private servers
5. **Log warnings**: Don't ignore pruning warnings - they indicate memory pressure

## Troubleshooting

### Frequent Pruning Warnings

**Symptom**: Constant pruning logs every decay cycle

**Solutions**:

- Increase `maxTotalPositions` or `maxPositionsPerRoom`
- Decrease `trafficDecayInterval` for more frequent cleanup
- Increase `trafficDecayRate` for more aggressive decay

### High Memory Usage Despite Limits

**Symptom**: Memory usage high even with size limits

**Solutions**:

- Check `MemoryUtilizationMonitor` for other memory consumers
- Verify traffic data is being saved to memory correctly
- Ensure decay is running (check `InfrastructureManager.run()` is called)

### Lost Traffic Data

**Symptom**: Traffic positions reset unexpectedly

**Solutions**:

- Verify `saveToMemory()` is called after decay
- Check for memory reset events (respawn, etc.)
- Ensure `InfrastructureManager` has proper memory reference

## Performance Considerations

### CPU Impact

- **Decay operation**: O(n) where n is number of positions (typically <1ms)
- **Pruning operation**: O(n log n) due to sorting (typically <2ms)
- **Per-room enforcement**: O(n) where n is positions per room (typically <1ms)

### Memory Impact

- **Per position**: ~50 bytes (key + count + timestamp)
- **Default configuration**: ~100KB (2000 positions)
- **JSON serialization**: Proportional to total memory size

### Recommendations

- Run decay every 50-100 ticks to balance accuracy and CPU
- Keep `maxTotalPositions` under 3000 to minimize CPU overhead
- Monitor both CPU and memory usage in production

## Future Enhancements

Potential improvements for traffic memory management:

1. **Adaptive limits**: Dynamically adjust based on available memory
2. **Room priority**: Protect traffic data in high-priority rooms
3. **Compression**: Use more efficient data structures
4. **Partitioning**: Separate high-traffic vs low-traffic storage
5. **Time-based expiry**: Remove positions not updated in N ticks

## References

- `TrafficManager`: `packages/bot/src/runtime/infrastructure/TrafficManager.ts`
- `InfrastructureManager`: `packages/bot/src/runtime/infrastructure/InfrastructureManager.ts`
- `MemoryUtilizationMonitor`: `packages/bot/src/runtime/memory/MemoryUtilizationMonitor.ts`
- `MemorySelfHealer`: `packages/bot/src/runtime/memory/MemorySelfHealer.ts`
