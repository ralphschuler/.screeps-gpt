# Architecture Alignment: Roadmap to Codebase Mapping

This document provides detailed mapping between the strategic roadmap phases and the existing codebase structure, showing how planned features integrate with current implementations.

## Current Architecture Overview

The Screeps GPT bot is built on a modular architecture that separates concerns into distinct runtime subsystems:

### Kernel Layer (`src/runtime/bootstrap/`)

**Purpose**: Orchestrates tick processing and coordinates subsystem execution.

**Current Components**:

- `BootstrapKernel.ts` - Main game loop orchestration
- Entry point for all subsystem initialization

**Roadmap Integration**:

- **Phase 1**: Add dynamic population management hooks
- **Phase 2**: Integrate task queue polling
- **Phase 4**: Add empire-level coordination layer
- **Phase 5**: Coordinate multi-shard tick processing

### Behavior Layer (`src/runtime/behavior/`)

**Purpose**: Implements creep decision-making and action execution.

**Current Components**:

- `BehaviorController.ts` - Role-based creep management
- `roles/` - Individual role implementations

**Architecture Evolution**:

**Phase 1** (Enhancement):

- Add container-aware harvesting logic
- Implement dynamic spawn priority
- Enhance road network automation

**Phase 2** (Transition):

- Refactor from role-based to task-based system
- Maintain role wrappers for backward compatibility
- Gradually migrate behaviors to consume task queue

**Phase 3-5** (Extension):

- Add specialized roles (mineral harvester, scout, claimer)
- Implement military roles (attacker, defender, healer)
- Multi-room role coordination

### Memory Layer (`src/runtime/memory/`)

**Purpose**: Provides consistent Memory access and cleanup.

**Current Components**:

- `MemoryManager.ts` - Memory consistency helpers
- Creep memory initialization
- Dead creep cleanup

**Roadmap Integration**:

- **Phase 2**: Add task assignment memory tracking
- **Phase 3**: Extend for resource logistics tracking
- **Phase 4**: Empire-wide memory coordination
- **Phase 5**: Multi-shard memory synchronization

### Metrics Layer (`src/runtime/metrics/`)

**Purpose**: Tracks CPU usage and performance profiling.

**Current Components**:

- `PerformanceTracker.ts` - CPU accounting per subsystem

**Roadmap Integration**:

- **Phase 1**: Add energy flow metrics
- **Phase 2**: Track task assignment performance
- **Phase 3**: Detailed CPU profiling per manager
- **Phase 4**: Per-room CPU allocation tracking
- **Phase 5**: Multi-shard performance aggregation

### Evaluation Layer (`src/runtime/evaluation/`)

**Purpose**: Generates health reports and improvement recommendations.

**Current Components**:

- `SystemEvaluator.ts` - Analyzes snapshots and generates findings

**Roadmap Integration**:

See [Evaluation Integration](#evaluation-integration) section below.

### Respawn Layer (`src/runtime/respawn/`)

**Purpose**: Detects and handles loss of all spawns.

**Current Components**:

- `RespawnManager.ts` - Respawn detection logic

**Roadmap Integration**:

- **Phase 1**: Enhanced to prevent respawns through better economy
- **Phase 4**: Multi-room respawn coordination (fallback spawns)
- **Phase 5**: Shard-level respawn strategies

---

## Planned Architecture Additions

### Task System (`src/runtime/tasks/`) - Phase 2

**Purpose**: Centralized work distribution replacing role-specific logic.

**New Components**:

#### `TaskTypes.ts`

```typescript
export interface Task {
  id: string;
  type: TaskType;
  priority: number;
  target: RoomPosition | Id<Structure | Source>;
  assignedCreep?: Id<Creep>;
  status: "pending" | "assigned" | "in-progress" | "completed";
  createdAt: number;
  deadline?: number;
}

export enum TaskType {
  HARVEST = "harvest",
  HAUL = "haul",
  BUILD = "build",
  REPAIR = "repair",
  UPGRADE = "upgrade",
  WITHDRAW = "withdraw",
  TRANSFER = "transfer",
  ATTACK = "attack",
  HEAL = "heal",
  CLAIM = "claim",
  RESERVE = "reserve"
}

export interface TaskPriority {
  CRITICAL: 100; // Spawn about to die, controller downgrade imminent
  HIGH: 75; // Normal spawn queue, urgent construction
  NORMAL: 50; // Regular harvesting, repairs
  LOW: 25; // Optional upgrades, remote mining
  IDLE: 0; // Fallback tasks
}
```

#### `TaskQueue.ts`

```typescript
export class TaskQueue {
  private tasks: Map<string, Task> = new Map();

  public addTask(task: Task): void;
  public removeTask(taskId: string): void;
  public getAvailableTasks(priority?: number): Task[];
  public assignTask(taskId: string, creepId: Id<Creep>): boolean;
  public completeTask(taskId: string): void;
  public cleanupExpiredTasks(): void;
}
```

#### `TaskAssigner.ts`

```typescript
export class TaskAssigner {
  public assignTasks(creeps: Creep[], tasks: Task[]): void {
    // Algorithm: Assign closest idle creep to highest priority task
    // Considerations: Creep capabilities, energy state, distance
  }

  private calculateScore(creep: Creep, task: Task): number {
    // Scoring factors:
    // - Distance to target (lower is better)
    // - Creep body suitability (more WORK parts for build tasks)
    // - Current energy state (empty creeps prefer HARVEST)
    // - Task priority (higher priority weighted more)
  }
}
```

**Integration Points**:

- `BootstrapKernel.ts` - Call `TaskAssigner.assignTasks()` each tick
- `BehaviorController.ts` - Refactor to consume tasks instead of hard-coded roles
- `SystemEvaluator.ts` - Track task completion rates

---

### Manager Layer (`src/runtime/managers/`) - Phases 2-3

**Purpose**: Specialized resource and structure management.

#### Phase 2 Managers

**`StorageManager.ts`**:

```typescript
export class StorageManager {
  public distributeEnergy(room: Room): void;
  public requestEnergy(structure: Structure, amount: number): void;
  public getEnergySource(): Structure | null;
  public balanceStorage(): void; // Prevent overflow/underflow
}
```

**`LinkManager.ts`**:

```typescript
export class LinkManager {
  public optimizeLinkNetwork(room: Room): void;
  public transferEnergy(): void; // Source links → controller/storage links
  public calculateLinkEfficiency(): number;
}
```

**`TowerManager.ts`**:

```typescript
export class TowerManager {
  public defendRoom(room: Room): void; // Attack hostile creeps
  public repairStructures(room: Room): void; // Maintain roads, ramparts
  public healCreeps(room: Room): void; // Heal damaged friendly creeps
}
```

#### Phase 3 Managers

**`TerminalManager.ts`**:

```typescript
export class TerminalManager {
  public transferResources(targetRoom: string, resourceType: ResourceConstant, amount: number): void;
  public balanceResources(): void; // Distribute excess to needy rooms
  public getMarketPrice(resource: ResourceConstant): number;
}
```

**`LabManager.ts`**:

```typescript
export class LabManager {
  public runReactions(room: Room): void;
  public queueCompound(compound: MineralCompoundConstant): void;
  public optimizeLabLayout(): void; // Position labs for max efficiency
}
```

**`MarketManager.ts`**:

```typescript
export class MarketManager {
  public analyzePrices(): Map<ResourceConstant, number>;
  public createBuyOrder(resource: ResourceConstant, amount: number, price: number): void;
  public createSellOrder(resource: ResourceConstant, amount: number, price: number): void;
  public executeTrades(): void; // Automated market participation
}
```

**Integration Points**:

- `BootstrapKernel.ts` - Initialize managers and call tick methods
- `TaskQueue.ts` - Managers create tasks (e.g., "haul mineral to lab")
- `SystemEvaluator.ts` - Track manager efficiency metrics

---

### Empire Layer (`src/runtime/empire/`) - Phase 4

**Purpose**: Multi-room coordination and colonization.

**New Components**:

#### `EmpireManager.ts`

```typescript
export class EmpireManager {
  public getRooms(): Room[];
  public allocateCPU(): Map<string, number>; // CPU budget per room
  public coordinateDefense(): void; // Empire-wide threat response
  public balanceResources(): void; // Inter-room logistics
}
```

#### `ColonyManager.ts`

```typescript
export class ColonyManager {
  public identifyExpansionTarget(): RoomPosition | null;
  public claimRoom(roomName: string): void;
  public bootstrapColony(roomName: string): void; // Remote spawn assistance
  public monitorColonyProgress(roomName: string): ColonyStatus;
}
```

#### `ScoutManager.ts`

```typescript
export class ScoutManager {
  public scoutRoom(roomName: string): RoomIntelligence;
  public updateIntelligence(): void; // Refresh room data
  public identifyThreats(): HostilePresence[];
  public findRemoteSources(): RemoteSourceInfo[];
}
```

**Integration Points**:

- `BootstrapKernel.ts` - Empire tick before individual room ticks
- `TaskQueue.ts` - Empire-level tasks (scout, claim, remote haul)
- `SystemEvaluator.ts` - Empire health metrics

---

### Military Layer (`src/runtime/military/`) - Phase 5

**Purpose**: Combat operations and threat response.

**New Components**:

#### `SquadManager.ts`

```typescript
export class SquadManager {
  public createSquad(composition: SquadComposition): Squad;
  public moveSquad(squad: Squad, target: RoomPosition): void;
  public executeFormation(squad: Squad, formation: FormationType): void;
}
```

#### `DefenseManager.ts`

```typescript
export class DefenseManager {
  public detectThreats(room: Room): HostileCreep[];
  public activateSafeMode(room: Room): void;
  public deployDefenders(room: Room, threatLevel: number): void;
}
```

#### `SiegeManager.ts`

```typescript
export class SiegeManager {
  public planSiege(targetRoom: string): SiegePlan;
  public executeSiege(plan: SiegePlan): void;
  public claimConqueredRoom(roomName: string): void;
}
```

**Integration Points**:

- `EmpireManager.ts` - Empire-wide threat coordination
- `TaskQueue.ts` - Military tasks (attack, heal, fortify)
- `SystemEvaluator.ts` - Combat effectiveness metrics

---

### Shard Layer (`src/runtime/shard/`) - Phase 5

**Purpose**: Multi-shard presence and coordination.

**New Components**:

#### `ShardCoordinator.ts`

```typescript
export class ShardCoordinator {
  public getActiveShards(): string[];
  public allocateGCL(): Map<string, number>; // GCL budget per shard
  public synchronizeStrategy(): void; // Cross-shard coordination
}
```

#### `PortalManager.ts`

```typescript
export class PortalManager {
  public findPortals(room: Room): StructurePortal[];
  public establishRoute(fromShard: string, toShard: string): PortalRoute;
  public transferCreeps(route: PortalRoute, creeps: Creep[]): void;
}
```

**Integration Points**:

- Global coordination layer above `BootstrapKernel.ts`
- Inter-shard memory via `InterShardMemory`
- Multi-shard evaluation reporting

---

## Evaluation Integration

The `SystemEvaluator` is extended to track roadmap-specific metrics at each phase.

### Phase 1: Foundation Metrics

**New Evaluation Findings**:

```typescript
// Add to SystemEvaluator.evaluate()

if (snapshot.energySurplus < 10 && snapshot.rcl === 2) {
  findings.push({
    severity: "warning",
    title: "Energy surplus below Phase 1 target",
    detail: `Current surplus: ${snapshot.energySurplus}/tick. Target: 10+/tick.`,
    recommendation: "Add harvesters or optimize source utilization."
  });
}

if (snapshot.controllerDowngradeTimer < 10000) {
  findings.push({
    severity: "critical",
    title: "Controller downgrade risk",
    detail: `Downgrade in ${snapshot.controllerDowngradeTimer} ticks.`,
    recommendation: "Increase upgrader count immediately."
  });
}

if (snapshot.spawnUtilization < 0.7 && snapshot.creepCount < 5) {
  findings.push({
    severity: "warning",
    title: "Low spawn utilization in early game",
    detail: `Spawn active ${(snapshot.spawnUtilization * 100).toFixed(1)}% of time. Target: >70%.`,
    recommendation: "Increase creep population to improve economy."
  });
}
```

### Phase 2: Task Framework Metrics

**Extend PerformanceSnapshot**:

```typescript
interface PerformanceSnapshot {
  // ... existing fields
  taskMetrics?: {
    totalTasks: number;
    assignedTasks: number;
    completedTasks: number;
    averageAssignmentLatency: number;
    taskQueueDepth: number;
  };
}
```

**New Evaluation Findings**:

```typescript
if (snapshot.taskMetrics) {
  const { averageAssignmentLatency, taskQueueDepth } = snapshot.taskMetrics;

  if (averageAssignmentLatency > 5) {
    findings.push({
      severity: "warning",
      title: "Task assignment latency high",
      detail: `Average latency: ${averageAssignmentLatency.toFixed(1)} ticks. Target: <5 ticks.`,
      recommendation: "Review task assignment algorithm or reduce task complexity."
    });
  }

  if (taskQueueDepth > 50) {
    findings.push({
      severity: "warning",
      title: "Task queue backlog",
      detail: `${taskQueueDepth} tasks pending. Creeps may be undersized.`,
      recommendation: "Increase creep population or improve task prioritization."
    });
  }
}
```

### Phase 3: Economy Metrics

**Extend PerformanceSnapshot**:

```typescript
interface PerformanceSnapshot {
  // ... existing fields
  economyMetrics?: {
    storageReserves: number;
    linkEfficiency: number;
    terminalBalance: number;
    marketCredits: number;
    mineralProduction: Map<MineralConstant, number>;
  };
}
```

**New Evaluation Findings**:

```typescript
if (snapshot.economyMetrics) {
  const { storageReserves, linkEfficiency, marketCredits } = snapshot.economyMetrics;

  if (storageReserves < 20000 && snapshot.rcl >= 4) {
    findings.push({
      severity: "warning",
      title: "Low storage reserves",
      detail: `Storage: ${storageReserves} energy. Target: >20,000.`,
      recommendation: "Increase remote mining or reduce energy consumption."
    });
  }

  if (linkEfficiency < 0.8 && snapshot.rcl >= 5) {
    findings.push({
      severity: "info",
      title: "Link network underutilized",
      detail: `Efficiency: ${(linkEfficiency * 100).toFixed(1)}%. Target: >80%.`,
      recommendation: "Optimize link placement or increase link usage."
    });
  }

  if (marketCredits < 0) {
    findings.push({
      severity: "warning",
      title: "Negative market balance",
      detail: `Credits: ${marketCredits}. Spending exceeds income.`,
      recommendation: "Review market strategy or increase resource production."
    });
  }
}
```

### Phase 4: Empire Metrics

**Extend PerformanceSnapshot**:

```typescript
interface PerformanceSnapshot {
  // ... existing fields
  empireMetrics?: {
    totalRooms: number;
    roomsStable: number; // RCL 3+
    roomsExpanding: number; // RCL 1-2
    interRoomTransfers: number;
    cpuPerRoom: Map<string, number>;
  };
}
```

### Phase 5: Combat Metrics

**Extend PerformanceSnapshot**:

```typescript
interface PerformanceSnapshot {
  // ... existing fields
  militaryMetrics?: {
    activeSquads: number;
    defensesActive: number;
    hostilesEngaged: number;
    roomsConquered: number;
    safeModeAvailable: boolean;
  };
}
```

---

## Migration Strategy

### Phase 1 → Phase 2 Transition (Role-Based to Task-Based)

**Goal**: Transition from hard-coded role logic to task consumption without breaking existing behavior.

**Steps**:

1. **Implement Task System**: Create `TaskQueue`, `TaskAssigner`, `TaskTypes`
2. **Wrapper Pattern**: BehaviorController creates tasks internally but maintains role interface
3. **Gradual Migration**: One role at a time, replace internal logic with task consumption
4. **Validation**: Compare behavior before/after with regression tests
5. **Deprecation**: Once all roles migrated, remove role-specific code

**Example - Harvester Migration**:

```typescript
// Before (role-based)
class HarvesterRole {
  public run(creep: Creep): void {
    if (creep.store.getFreeCapacity() > 0) {
      // Find source and harvest
    } else {
      // Find spawn and deliver
    }
  }
}

// After (task-based)
class HarvesterRole {
  public run(creep: Creep, taskQueue: TaskQueue): void {
    const assignedTask = taskQueue.getTaskForCreep(creep.id);
    if (!assignedTask) {
      // Request new task from queue
      const task = taskQueue.getAvailableTask(creep);
      taskQueue.assignTask(task.id, creep.id);
    }
    this.executeTask(creep, assignedTask);
  }
}
```

### Backward Compatibility

During transition, maintain dual code paths:

- **Legacy Mode**: Uses role-based system (default until Phase 2 complete)
- **Task Mode**: Uses task system (enabled via Memory flag)
- **Evaluation**: Track metrics for both modes in parallel

---

## Testing Strategy

### Unit Tests

Each new component must have unit tests:

- `TaskQueue.test.ts` - Task prioritization, assignment, cleanup
- `StorageManager.test.ts` - Energy distribution logic
- `EmpireManager.test.ts` - Multi-room coordination

### Integration Tests

Phase transitions require integration tests:

- Phase 1: Economic stability under stress (spawn queue, controller downgrade)
- Phase 2: Task assignment with mixed creep types
- Phase 4: Multi-room bootstrapping and resource transfer

### Regression Tests

Validate that new phases don't break earlier functionality:

- Phase 2 task system doesn't degrade Phase 1 economy
- Phase 4 empire management doesn't increase CPU beyond targets

---

## Performance Considerations

### CPU Budget Allocation

| Phase   | Target CPU/tick | Breakdown                                |
| ------- | --------------- | ---------------------------------------- |
| Phase 1 | <5              | Kernel: 0.5, Behavior: 3, Other: 1.5     |
| Phase 2 | <10             | + Tasks: 2, Managers: 2                  |
| Phase 3 | <15             | + Economy: 3 (labs, market, terminal)    |
| Phase 4 | <10 per room    | Empire: 2, Per-room: 8                   |
| Phase 5 | <12 per room    | + Military: 2 (per room with operations) |

### Optimization Strategies

1. **Caching**: Minimize repeated lookups (room.find(), Memory access)
2. **Throttling**: Run expensive operations every N ticks (market analysis, scouting)
3. **Early Exit**: Skip inactive subsystems (no labs → skip LabManager)
4. **Profiling**: Track CPU per subsystem, identify hotspots

---

## Documentation Updates

As each phase is implemented, update:

1. **API Documentation**: TSDoc comments for new classes/methods
2. **Strategy Guides**: Update `docs/runtime/strategy/` with new tactics
3. **Operations Runbooks**: Add troubleshooting for new systems
4. **Roadmap Status**: Mark deliverables complete in `roadmap.md`
5. **Changelog**: Document user-facing changes per release

---

## Next Steps

1. Review Phase 1 implementation guide: [01-foundation.md](./phases/01-foundation.md)
2. Create Epic issue for Phase 1 using roadmap deliverables
3. Set up evaluation tracking for Phase 1 metrics
4. Begin implementation with highest-priority Phase 1 tasks

For strategic overview, see [Development Roadmap](./roadmap.md).
