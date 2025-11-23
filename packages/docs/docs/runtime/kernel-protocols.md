# Kernel Protocols

This document describes the runtime protocols used for inter-process communication in the Screeps bot runtime. These protocols replace Memory-based communication patterns with type-safe, zero-overhead protocol-based communication using the `@ralphschuler/screeps-kernel` system.

## Overview

Runtime protocols enable processes to communicate without serializing data to Memory. This provides:

- **Zero Memory Cost**: No serialization overhead
- **Type Safety**: Compile-time type checking
- **State Persistence**: Protocol instances persist across ticks as singletons
- **Clear Contracts**: Self-documenting through typed interfaces
- **Separation of Concerns**: IPC logic separate from business logic

## Protocol Architecture

All runtime protocols are implemented in `packages/bot/src/runtime/protocols/` and registered automatically when imported in `main.ts`.

### Combined Protocol Interface

Processes use the `RuntimeProtocols` interface to access all protocol methods with full type safety:

```typescript
import type { RuntimeProtocols } from "@runtime/protocols";

@process({ name: "MyProcess", priority: 50 })
export class MyProcess {
  run(ctx: ProcessContext<Memory, RuntimeProtocols>): void {
    // TypeScript knows about all protocol methods
    if (ctx.protocol.isEmergencyReset()) { ... }
    const roleCounts = ctx.protocol.getRoleCounts();
  }
}
```

## Protocol Specifications

### StateCoordinationProtocol

**Purpose**: Coordinates emergency state and respawn flags between processes.

**Replaces**: `memory.emergencyReset`, `memory.needsRespawn`

**Interface**:
```typescript
interface IStateCoordinationProtocol {
  setEmergencyReset(value: boolean): void;
  isEmergencyReset(): boolean;
  setNeedsRespawn(value: boolean): void;
  needsRespawn(): boolean;
  clearFlags(): void;
}
```

**Usage**:
```typescript
// MemoryProcess sets emergency reset
ctx.protocol.setEmergencyReset(true);

// Other processes check flag and skip execution
if (ctx.protocol.isEmergencyReset()) {
  return;
}
```

**Producers**: MemoryProcess, RespawnProcess  
**Consumers**: All processes

---

### RoleManagementProtocol

**Purpose**: Shares creep role counts between processes.

**Replaces**: `memory.roles`

**Interface**:
```typescript
interface IRoleManagementProtocol {
  setRoleCounts(counts: Record<string, number>): void;
  getRoleCounts(): Record<string, number>;
  getRoleCount(role: string): number;
  clearRoleCounts(): void;
}
```

**Usage**:
```typescript
// MemoryProcess updates role counts
ctx.protocol.setRoleCounts({ harvester: 3, upgrader: 2 });

// BehaviorProcess reads role counts
const roleCounts = ctx.protocol.getRoleCounts();
const harvesterCount = ctx.protocol.getRoleCount('harvester');
```

**Producers**: MemoryProcess  
**Consumers**: BehaviorProcess

---

### BehaviorCoordinationProtocol

**Purpose**: Shares behavior execution summaries for metrics collection.

**Replaces**: `memory.behaviorSummary`

**Interface**:
```typescript
interface IBehaviorCoordinationProtocol {
  setBehaviorSummary(summary: BehaviorSummary): void;
  getBehaviorSummary(): BehaviorSummary | undefined;
  clearBehaviorSummary(): void;
}
```

**Types**:
```typescript
interface BehaviorSummary {
  processedCreeps: number;
  spawnedCreeps: string[];
  tasksExecuted: Record<string, number>;
}
```

**Usage**:
```typescript
// BehaviorProcess stores summary
ctx.protocol.setBehaviorSummary({
  processedCreeps: 5,
  spawnedCreeps: ['harvester1'],
  tasksExecuted: { harvest: 10, upgrade: 5 }
});

// MetricsProcess reads summary
const summary = ctx.protocol.getBehaviorSummary();
```

**Producers**: BehaviorProcess  
**Consumers**: MetricsProcess

---

### BootstrapCoordinationProtocol

**Purpose**: Coordinates bootstrap phase status and role minimums.

**Replaces**: `memory.bootstrapStatus`

**Interface**:
```typescript
interface IBootstrapCoordinationProtocol {
  setBootstrapStatus(status: BootstrapStatus): void;
  getBootstrapStatus(): BootstrapStatus | undefined;
  isBootstrapActive(): boolean;
  getBootstrapMinimums(): Record<string, number>;
  clearBootstrapStatus(): void;
}
```

**Types**:
```typescript
interface BootstrapStatus {
  isActive: boolean;
  phase?: string;
  progress?: number;
}
```

**Usage**:
```typescript
// BootstrapProcess updates status
ctx.protocol.setBootstrapStatus({ 
  isActive: true, 
  phase: 'initial',
  progress: 50
});

// BehaviorProcess checks bootstrap
if (ctx.protocol.isBootstrapActive()) {
  const minimums = ctx.protocol.getBootstrapMinimums();
  // Returns { harvester: 2, upgrader: 1, builder: 1 }
}
```

**Producers**: BootstrapProcess  
**Consumers**: BehaviorProcess

---

### MetricsCoordinationProtocol

**Purpose**: Shares memory utilization metrics for evaluation.

**Replaces**: `memory.memoryUtilization`

**Interface**:
```typescript
interface IMetricsCoordinationProtocol {
  setMemoryUtilization(utilization: MemoryUtilization): void;
  getMemoryUtilization(): MemoryUtilization | undefined;
  clearMemoryUtilization(): void;
}
```

**Types**:
```typescript
interface MemoryUtilization {
  used: number;
  limit: number;
  percentage: number;
}
```

**Usage**:
```typescript
// MemoryProcess stores utilization
ctx.protocol.setMemoryUtilization({ 
  used: 1024, 
  limit: 2048, 
  percentage: 50 
});

// MetricsProcess reads utilization
const utilization = ctx.protocol.getMemoryUtilization();
```

**Producers**: MemoryProcess  
**Consumers**: MetricsProcess

---

### HealthMonitoringProtocol

**Purpose**: Shares health status and recovery state for monitoring.

**Replaces**: `memory.health`

**Interface**:
```typescript
interface IHealthMonitoringProtocol {
  setHealthMetrics(metrics: HealthMetrics): void;
  getHealthMetrics(): HealthMetrics | undefined;
  getHealthScore(): number | undefined;
  isInRecovery(): boolean;
  clearHealthMetrics(): void;
}
```

**Types**:
```typescript
interface HealthMetrics {
  score: number;
  state: string;
  metrics: Record<string, number>;
  timestamp: number;
  warnings: HealthWarning[];
  recovery: RecoveryState;
}

interface HealthWarning {
  type: string;
  severity: string;
  message: string;
}

interface RecoveryState {
  mode: string;
  actionsCount: number;
}
```

**Usage**:
```typescript
// HealthProcess stores metrics
ctx.protocol.setHealthMetrics({
  score: 85,
  state: 'healthy',
  metrics: { creeps: 10, energy: 5000 },
  timestamp: Game.time,
  warnings: [],
  recovery: { mode: 'NORMAL', actionsCount: 0 }
});

// Other processes check health
const healthScore = ctx.protocol.getHealthScore();
if (ctx.protocol.isInRecovery()) {
  // Adjust behavior for recovery mode
}
```

**Producers**: HealthProcess  
**Consumers**: External monitoring, MetricsProcess

## Migration Guide

### Before: Memory-Based Communication

```typescript
@process({ name: "ProducerProcess", priority: 100 })
export class ProducerProcess {
  run(ctx: ProcessContext): void {
    // Set data in Memory
    ctx.memory.roles = { harvester: 3 };
    ctx.memory.emergencyReset = true;
  }
}

@process({ name: "ConsumerProcess", priority: 50 })
export class ConsumerProcess {
  run(ctx: ProcessContext): void {
    // Read from Memory with fallbacks
    const roles = ctx.memory.roles ?? {};
    if (ctx.memory.emergencyReset) {
      return;
    }
  }
}
```

### After: Protocol-Based Communication

```typescript
@process({ name: "ProducerProcess", priority: 100 })
export class ProducerProcess {
  run(ctx: ProcessContext<Memory, RuntimeProtocols>): void {
    // Set data via protocol
    ctx.protocol.setRoleCounts({ harvester: 3 });
    ctx.protocol.setEmergencyReset(true);
  }
}

@process({ name: "ConsumerProcess", priority: 50 })
export class ConsumerProcess {
  run(ctx: ProcessContext<Memory, RuntimeProtocols>): void {
    // Read from protocol with type safety
    const roles = ctx.protocol.getRoleCounts();
    if (ctx.protocol.isEmergencyReset()) {
      return;
    }
  }
}
```

### Benefits

- **Type Safety**: TypeScript catches errors at compile time
- **No Serialization**: Direct in-memory access, no JSON serialization
- **Self-Documenting**: Protocol interfaces serve as documentation
- **Easier Testing**: Protocols can be tested independently
- **Clear Dependencies**: Producer/consumer relationships are explicit

## Adding New Protocols

To add a new protocol for inter-process communication:

### 1. Define Protocol Interface

Create a new file in `packages/bot/src/runtime/protocols/`:

```typescript
// MyNewProtocol.ts
import { protocol } from "@ralphschuler/screeps-kernel";

export interface IMyNewProtocol {
  setData(data: MyData): void;
  getData(): MyData | undefined;
}

@protocol({ name: "MyNewProtocol" })
export class MyNewProtocol implements IMyNewProtocol {
  private data: MyData | undefined;

  public setData(data: MyData): void {
    this.data = data;
  }

  public getData(): MyData | undefined {
    return this.data;
  }
}
```

### 2. Export Protocol

Add exports to `packages/bot/src/runtime/protocols/index.ts`:

```typescript
import "./MyNewProtocol";
export { MyNewProtocol } from "./MyNewProtocol";
export type { IMyNewProtocol } from "./MyNewProtocol";

// Add to RuntimeProtocols interface
export interface RuntimeProtocols
  extends IStateCoordinationProtocol,
    // ... other protocols
    IMyNewProtocol {}
```

### 3. Use Protocol

Import the protocol in your process:

```typescript
import type { RuntimeProtocols } from "@runtime/protocols";

@process({ name: "MyProcess", priority: 50 })
export class MyProcess {
  run(ctx: ProcessContext<Memory, RuntimeProtocols>): void {
    ctx.protocol.setData(myData);
    const data = ctx.protocol.getData();
  }
}
```

## Testing Protocols

Protocols can be tested independently from processes:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { RoleManagementProtocol } from "./RoleManagementProtocol";

describe("RoleManagementProtocol", () => {
  let protocol: RoleManagementProtocol;

  beforeEach(() => {
    protocol = new RoleManagementProtocol();
  });

  it("should store and retrieve role counts", () => {
    protocol.setRoleCounts({ harvester: 3, upgrader: 2 });
    
    expect(protocol.getRoleCounts()).toEqual({
      harvester: 3,
      upgrader: 2
    });
    expect(protocol.getRoleCount("harvester")).toBe(3);
  });

  it("should return 0 for unknown roles", () => {
    expect(protocol.getRoleCount("unknown")).toBe(0);
  });
});
```

## Best Practices

### 1. Keep Protocols Focused

Each protocol should have a single responsibility:

```typescript
// ✅ Good: Focused protocol
interface IRoleManagementProtocol {
  setRoleCounts(counts: Record<string, number>): void;
  getRoleCounts(): Record<string, number>;
}

// ❌ Bad: Kitchen sink protocol
interface IEverythingProtocol {
  setRoles(...): void;
  setHealth(...): void;
  setMetrics(...): void;
}
```

### 2. Use Descriptive Names

Protocol names should clearly indicate their purpose:

```typescript
// ✅ Good
StateCoordinationProtocol
RoleManagementProtocol

// ❌ Bad
Protocol1
DataProtocol
```

### 3. Handle Missing Data

Always handle cases where data might not be set:

```typescript
// ✅ Good
const summary = ctx.protocol.getBehaviorSummary() ?? defaultSummary;

// ❌ Bad
const summary = ctx.protocol.getBehaviorSummary();
summary.processedCreeps; // May throw if undefined
```

### 4. Document Producers and Consumers

Clearly document which processes produce and consume each protocol's data.

### 5. Consider Memory Usage

While protocols don't use Memory, they still use heap memory. Avoid unbounded growth:

```typescript
// ✅ Good: Limit size
if (this.history.length > 1000) {
  this.history.shift();
}

// ❌ Bad: Unbounded growth
this.history.push(entry);
```

## Troubleshooting

### Protocol Methods Not Found

**Problem**: `ctx.protocol.myMethod is not a function`

**Solution**: Ensure protocols are imported before kernel initialization in `main.ts`:

```typescript
// Must be before kernel.run()
import "@runtime/protocols";
```

### Type Errors

**Problem**: TypeScript doesn't recognize protocol methods

**Solution**: Specify the protocol interface in ProcessContext:

```typescript
run(ctx: ProcessContext<Memory, RuntimeProtocols>): void {
  ctx.protocol.getRoleCounts(); // Now TypeScript knows
}
```

### State Not Persisting

**Problem**: Protocol state resets each tick

**Cause**: Protocol instances are singleton by design. If state resets:
1. Check that the protocol is properly decorated with `@protocol`
2. Ensure the protocol is imported in `main.ts`
3. Verify no other code is clearing the ProtocolRegistry

## See Also

- [screeps-kernel PROTOCOL.md](../../screeps-kernel/PROTOCOL.md) - Kernel protocol system documentation
- [Process Implementation Guide](./processes.md) - Process architecture documentation
- [Memory Management](./memory.md) - Memory system documentation
