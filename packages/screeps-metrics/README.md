# @ralphschuler/screeps-metrics

Comprehensive metrics collection library for [Screeps](https://screeps.com) using official game APIs.

This library provides tools for collecting and monitoring various metrics from the Screeps game environment including CPU usage, heap memory statistics, GCL/GPL progress, room-level metrics, and resource availability.

## Installation

```bash
npm install @ralphschuler/screeps-metrics
```

Or with bun:

```bash
bun add @ralphschuler/screeps-metrics
```

## Features

- **CPU Metrics**: Track CPU usage, limits, bucket levels, and shard-specific limits
- **Heap Metrics**: Monitor V8 heap statistics including memory usage and allocation
- **GCL Metrics**: Track Global Control Level progress
- **GPL Metrics**: Monitor Global Power Level progress (when available)
- **Room Metrics**: Collect detailed metrics for each visible room
- **Resource Metrics**: Track credits, pixels, CPU unlocks, and access keys
- **Configurable**: Select which metrics to collect
- **TypeScript**: Full type definitions included
- **Zero Dependencies**: Uses only official Screeps APIs

## Usage

### Basic Usage

```typescript
import { MetricsCollector } from "@ralphschuler/screeps-metrics";

// Create collector with all metrics enabled (default)
const collector = new MetricsCollector();

// Collect metrics snapshot
export function loop() {
  const snapshot = collector.collect();

  // Log important metrics
  console.log(`Tick: ${snapshot.tick}`);
  console.log(`CPU: ${snapshot.cpu.used}/${snapshot.cpu.limit}`);
  console.log(`Bucket: ${snapshot.cpu.bucket}`);
  console.log(`GCL: ${snapshot.gcl.level} (${snapshot.gcl.progressPercent}%)`);
  console.log(`Heap: ${snapshot.heap.usedHeapSize} / ${snapshot.heap.heapSizeLimit}`);
  console.log(`Total Creeps: ${snapshot.totalCreeps}`);
  console.log(`Total Rooms: ${snapshot.totalRooms}`);
}
```

### Selective Metrics Collection

You can configure which metrics to collect to optimize performance:

```typescript
import { MetricsCollector } from "@ralphschuler/screeps-metrics";

// Only collect CPU and GCL metrics
const collector = new MetricsCollector({
  collectCpu: true,
  collectHeap: false,
  collectGcl: true,
  collectGpl: false,
  collectRooms: false,
  collectResources: false
});

const snapshot = collector.collect();
console.log(`CPU: ${snapshot.cpu.used}/${snapshot.cpu.limit}`);
console.log(`GCL: ${snapshot.gcl.level}`);
```

### Individual Metric Collection

You can also collect individual metrics:

```typescript
import { MetricsCollector } from "@ralphschuler/screeps-metrics";

const collector = new MetricsCollector();

// Collect only CPU metrics
const cpuMetrics = collector.collectCpuMetrics();
console.log(`CPU Used: ${cpuMetrics.used}`);
console.log(`CPU Limit: ${cpuMetrics.limit}`);
console.log(`CPU Bucket: ${cpuMetrics.bucket}`);

// Collect only heap metrics
const heapMetrics = collector.collectHeapMetrics();
console.log(`Heap Used: ${heapMetrics.usedHeapSize}`);
console.log(`Heap Limit: ${heapMetrics.heapSizeLimit}`);

// Collect only GCL metrics
const gclMetrics = collector.collectGclMetrics();
console.log(`GCL Level: ${gclMetrics.level}`);
console.log(`GCL Progress: ${gclMetrics.progressPercent}%`);
```

### Storing Metrics in Memory

You can store metrics snapshots in Memory for historical tracking:

```typescript
import { MetricsCollector } from "@ralphschuler/screeps-metrics";

// Declare Memory structure
declare global {
  interface Memory {
    metrics?: {
      current: MetricsSnapshot;
      history: MetricsSnapshot[];
    };
  }
}

const collector = new MetricsCollector();

export function loop() {
  const snapshot = collector.collect();

  // Initialize metrics storage
  if (!Memory.metrics) {
    Memory.metrics = {
      current: snapshot,
      history: []
    };
  }

  // Store current snapshot
  Memory.metrics.current = snapshot;

  // Keep last 100 snapshots
  Memory.metrics.history.push(snapshot);
  if (Memory.metrics.history.length > 100) {
    Memory.metrics.history.shift();
  }
}
```

## API Reference

### MetricsCollector

Main class for collecting metrics.

#### Constructor

```typescript
new MetricsCollector(options?: MetricsOptions)
```

**Options:**

- `collectCpu?: boolean` - Whether to collect CPU metrics (default: `true`)
- `collectHeap?: boolean` - Whether to collect heap metrics (default: `true`)
- `collectGcl?: boolean` - Whether to collect GCL metrics (default: `true`)
- `collectGpl?: boolean` - Whether to collect GPL metrics (default: `true`)
- `collectRooms?: boolean` - Whether to collect room metrics (default: `true`)
- `collectResources?: boolean` - Whether to collect resource metrics (default: `true`)

#### Methods

##### `collect(): MetricsSnapshot`

Collects a complete metrics snapshot based on configured options.

##### `collectCpuMetrics(): CpuMetrics`

Collects CPU metrics including usage, limits, and bucket.

##### `collectHeapMetrics(): HeapMetrics`

Collects heap memory statistics if available.

##### `collectGclMetrics(): GclMetrics`

Collects GCL (Global Control Level) metrics.

##### `collectGplMetrics(): GplMetrics | null`

Collects GPL (Global Power Level) metrics if available.

##### `collectRoomMetrics(): Record<string, RoomMetrics>`

Collects metrics for all visible rooms.

##### `collectResourceMetrics(): ResourceMetrics`

Collects resource metrics including credits, pixels, and CPU unlocks.

### Types

#### MetricsSnapshot

Complete metrics snapshot containing all collected metrics.

```typescript
interface MetricsSnapshot {
  tick: number;
  cpu: CpuMetrics;
  heap: HeapMetrics;
  gcl: GclMetrics;
  gpl: GplMetrics | null;
  rooms: Record<string, RoomMetrics>;
  resources: ResourceMetrics;
  totalCreeps: number;
  totalRooms: number;
}
```

#### CpuMetrics

CPU usage and limit metrics.

```typescript
interface CpuMetrics {
  used: number;
  limit: number;
  bucket: number;
  tickLimit?: number;
  shardLimits?: Record<string, number>;
}
```

#### HeapMetrics

V8 heap memory statistics.

```typescript
interface HeapMetrics {
  totalHeapSize: number;
  totalHeapSizeExecutable: number;
  totalPhysicalSize: number;
  totalAvailableSize: number;
  usedHeapSize: number;
  heapSizeLimit: number;
  mallocedMemory: number;
  peakMallocedMemory: number;
  doesZapGarbage: number;
  numberOfNativeContexts?: number;
  numberOfDetachedContexts?: number;
  externalMemory?: number;
}
```

#### GclMetrics

Global Control Level progress.

```typescript
interface GclMetrics {
  level: number;
  progress: number;
  progressTotal: number;
  progressPercent: number;
}
```

#### GplMetrics

Global Power Level progress.

```typescript
interface GplMetrics {
  level: number;
  progress: number;
  progressTotal: number;
  progressPercent: number;
}
```

#### RoomMetrics

Room-level metrics.

```typescript
interface RoomMetrics {
  name: string;
  controllerLevel: number | null;
  energyAvailable: number;
  energyCapacityAvailable: number;
  creepCount: number;
  hostileCreepCount: number;
  sourceCount: number;
  structureCount: number;
}
```

#### ResourceMetrics

Resource availability metrics.

```typescript
interface ResourceMetrics {
  totalEnergy: number;
  credits: number;
  pixels: number;
  cpuUnlocks: number;
  accessKeys: number;
}
```

## Performance Considerations

- **CPU Cost**: Collecting metrics has minimal CPU cost (typically < 0.5 CPU per tick)
- **Heap Metrics**: `Game.cpu.getHeapStatistics()` is relatively expensive (~0.2 CPU). Consider collecting it less frequently
- **Room Metrics**: Cost scales with number of rooms. Use `collectRooms: false` if not needed
- **Selective Collection**: Disable metrics you don't need to minimize CPU usage

## Compatibility

- **Node.js**: >= 18.0.0
- **Bun**: >= 1.0.0
- **Screeps**: Compatible with both MMO and private servers
- **TypeScript**: >= 5.0.0

## TypeScript Support

This library is written in TypeScript and includes full type definitions. All types are exported and can be used in your code:

```typescript
import type { MetricsSnapshot, CpuMetrics, HeapMetrics } from "@ralphschuler/screeps-metrics";
```

## License

MIT © OpenAI Automations
