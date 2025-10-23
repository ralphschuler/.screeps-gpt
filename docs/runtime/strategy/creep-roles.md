# Creep Roles and Decision Logic

This document describes the role-based creep behavior system implemented in `src/runtime/behavior/BehaviorController.ts`.

## Overview

The AI uses a role-based system where each creep is assigned a specific role that determines its behavior and task execution. Roles are defined with minimum population requirements, body part configurations, and task execution logic.

Current roster:

- **Harvester** – baseline economy and energy distribution
- **Upgrader** – controller progress maintenance
- **Builder** – construction and structural upkeep
- **Remote Miner** – long-distance energy acquisition

## Role Definitions

### Harvester

**Purpose**: Primary energy collection and distribution role that keeps spawns and extensions supplied with energy.

**Minimum Count**: 2 creeps  
**Body Configuration**: `[WORK, CARRY, MOVE]` (50 energy cost)  
**Version**: 1

**Task State Machine**:

```
HARVEST → DELIVER → UPGRADE
   ↑         ↓         ↓
   └─────────┴─────────┘
```

**Decision Tree**:

1. **HARVEST Task**
   - **Trigger**: Creep has free capacity for energy
   - **Action**: Find closest active source and harvest energy
   - **Pathfinding**: Range 1, reuse path for 5 ticks
   - **Transition**: When `store.getFreeCapacity(RESOURCE_ENERGY) === 0`, switch to DELIVER

2. **DELIVER Task**
   - **Trigger**: Creep is full of energy
   - **Priority Targets**: Spawns and extensions with free energy capacity
   - **Target Selection**: Closest by path, fallback to first in list
   - **Action**: Transfer energy to target structure
   - **Pathfinding**: Range 1, reuse path for 5 ticks
   - **Transition**: When `store.getUsedCapacity(RESOURCE_ENERGY) === 0`, switch to HARVEST
   - **Fallback**: If no delivery targets, switch to UPGRADE

3. **UPGRADE Task (Fallback)**
   - **Trigger**: No spawns/extensions need energy
   - **Action**: Upgrade room controller with remaining energy
   - **Pathfinding**: Range 3, reuse path for 5 ticks
   - **Transition**: When `store.getUsedCapacity(RESOURCE_ENERGY) === 0`, switch to HARVEST

**Performance Characteristics**:

- Harvest rate: 2 energy/tick (1 WORK part)
- Carry capacity: 50 energy (1 CARRY part)
- Movement speed: 1 road tile/tick, 2 ticks/plain tile
- Full cycle time: ~25-40 ticks (depends on source distance)
- Energy efficiency: 50 energy harvested per spawn cost (100% ROI in 1 trip)

### Upgrader

**Purpose**: Dedicated room controller upgrading to maintain and increase room control level (RCL).

**Minimum Count**: 1 creep  
**Body Configuration**: `[WORK, CARRY, MOVE]` (50 energy cost)  
**Version**: 1

**Task State Machine**:

```
RECHARGE ⟷ UPGRADE
```

**Decision Tree**:

1. **RECHARGE Task**
   - **Trigger**: Creep has free capacity for energy
   - **Energy Sources** (in priority order):
     - Spawns with stored energy
     - Extensions with stored energy
     - Containers with stored energy
   - **Target Selection**: Closest by path, fallback to first in list
   - **Action**: Withdraw energy from target structure
   - **Pathfinding**: Range 1, reuse path for 5 ticks
   - **Transition**: When `store.getFreeCapacity(RESOURCE_ENERGY) === 0`, switch to UPGRADE

2. **UPGRADE Task**
   - **Trigger**: Creep is full of energy
   - **Action**: Upgrade room controller
   - **Pathfinding**: Range 3, reuse path for 5 ticks
   - **Transition**: When `store.getUsedCapacity(RESOURCE_ENERGY) === 0`, switch to RECHARGE

**Performance Characteristics**:

- Upgrade rate: 1 control points/tick/energy (1 WORK part)
- Carry capacity: 50 energy (1 CARRY part)
- Movement speed: 1 road tile/tick, 2 ticks/plain tile
- Full cycle time: ~50-60 ticks (withdraw + upgrade + travel)
- Controller points per cycle: 50 points

### Builder

**Purpose**: Establishes new infrastructure and keeps critical structures repaired when construction slows down.

**Minimum Count**: 1 creep
**Body Configuration**: `[WORK, CARRY, MOVE, MOVE]` (200 energy cost)
**Version**: 1

**Task State Machine**:

```
GATHER → BUILD → MAINTAIN
   ↑               ↓
   └───────────────┘
```

**Decision Tree**:

1. **GATHER Task**
   - **Trigger**: Default state and whenever the creep is empty
   - **Energy Sources**: Spawns, extensions, containers, and storage structures with spare energy
   - **Fallback**: Harvests from active sources if no stored energy is available
   - **Transition**: When `store.getFreeCapacity(RESOURCE_ENERGY) === 0`, switch to BUILD

2. **BUILD Task**
   - **Trigger**: Inventory is full
   - **Action**: Build the closest construction site (path priority)
   - **Transition**:
     - When the current site finishes or none exist, switch to MAINTAIN
     - When `store.getUsedCapacity(RESOURCE_ENERGY) === 0`, switch to GATHER

3. **MAINTAIN Task**
   - **Trigger**: No construction sites are available
   - **Action**: Repair damaged non-defensive structures; upgrade the controller when nothing needs repair
   - **Transition**: When `store.getUsedCapacity(RESOURCE_ENERGY) === 0`, switch back to GATHER

**Performance Characteristics**:

- Construction throughput: 5 build power/tick (1 WORK part)
- Repair throughput: 100 hits/tick (1 WORK part)
- Travel speed: 1 road tile/tick, 2 ticks/plain tile
- Utility coverage: Always contributes by repairing or upgrading even without construction work

### Remote Miner

**Purpose**: Harvests energy from remote rooms and ferries it back to the home economy.

**Minimum Count**: 0 creeps (enabled once remote targets are configured)
**Body Configuration**: `[WORK, WORK, CARRY, MOVE, MOVE]` (350 energy cost)
**Version**: 1

**Task State Machine**:

```
TRAVEL → MINE → RETURN ↴
   ↑               └─────┘
```

**Decision Tree**:

1. **TRAVEL Task**
   - **Trigger**: Default state until the creep reaches the assigned `targetRoom`
   - **Action**: Move toward the target room centre (25,25) using longer path reuse to conserve CPU
   - **Transition**: When `creep.room.name === targetRoom`, switch to MINE

2. **MINE Task**
   - **Trigger**: Creep is in the target room with free capacity
   - **Source Selection**: Remembers the chosen source by storing `sourceId`
   - **Transition**: When `store.getFreeCapacity(RESOURCE_ENERGY) === 0`, switch to RETURN

3. **RETURN Task**
   - **Trigger**: Inventory contains harvested energy
   - **Action**: Travel back to `homeRoom`, deposit into storage structures, spawns, or extensions; upgrades the controller if no delivery targets exist
   - **Transition**: When `store.getUsedCapacity(RESOURCE_ENERGY) === 0`, switch back to TRAVEL and resume mining

**Performance Characteristics**:

- Harvest output: 2 energy/tick while mining (2 WORK parts)
- Carry capacity: 50 energy (1 CARRY part)
- Remote cadence: Balanced MOVE parts allow consistent round trips
- Assignment memory: Persists `homeRoom`, `targetRoom`, and `sourceId` for deterministic routing

## Spawn Management

### Population Maintenance

The `BehaviorController.ensureRoleMinimums()` method enforces minimum population requirements each tick:

1. **Check Current Population**: Count living creeps for each role
2. **Identify Gaps**: Compare against role minimum requirements
3. **Spawn Priority**: Roles are processed in definition order (harvester → upgrader → builder → remoteMiner)
4. **Spawn Selection**: Find first available (non-spawning) spawn
5. **Creep Creation**:
   - Name format: `{role}-{game.time}-{memory.creepCounter}`
   - Example: `builder-12345-3`
   - Memory initialized with role defaults

### Spawn Failures

**Common Failure Codes**:

- `ERR_NOT_ENOUGH_ENERGY`: Room doesn't have required energy (logged as warning)
- `ERR_BUSY`: Spawn is already spawning another creep (silently skipped on next pass)
- `ERR_NAME_EXISTS`: Random name collision (extremely rare, retried next tick)

## Memory Management

### Role Memory Structure

Each creep memory contains:

```typescript
{
  role: "harvester" | "upgrader" | "builder" | "remoteMiner",  // Role assignment
  task: string,                     // Current task state
  version: number,                  // Role version for migrations
  homeRoom?: string,                // Remote miner home anchor
  targetRoom?: string,              // Remote miner destination
  sourceId?: Id<Source>             // Cached source assignment
}
```

### Version Migration

When role version changes (e.g., new task logic or body parts):

1. Old creeps detected by version mismatch
2. Task reset to role default
3. Version updated to current
4. Builder and remote miner migrations also seed their extended memory (`homeRoom`, `targetRoom`, `sourceId`) without breaking older creeps

### Memory Initialization

New creeps get memory from `RoleDefinition.memory()`:

```typescript
harvester: { role: "harvester", task: "harvest", version: 1 }
upgrader: { role: "upgrader", task: "recharge", version: 1 }
```

## Performance Benchmarks

### Expected Performance (Early Game - RCL 1-2)

**2 Harvesters + 1 Upgrader** (baseline economy):

- Energy income: ~10-15 energy/tick (2 harvesters at 1 source)
- Energy storage capacity: ~300 energy (spawn)
- Spawn uptime: ~80% (spawning harvesters every ~3 energy fills)
- Controller upgrade rate: ~5 control points/tick
- CPU usage: ~1-3 CPU/tick

### CPU Budget Allocation

Approximate CPU costs per role per tick:

- Harvester: ~0.3-0.5 CPU (pathfinding dominates)
- Upgrader: ~0.3-0.5 CPU (pathfinding dominates)
- Spawn logic: ~0.1-0.2 CPU
- Memory management: ~0.1 CPU

## Task Switching Optimization

### Path Reuse Strategy

Both roles use `reusePath: 5` parameter:

- **Benefit**: Reduces pathfinding CPU cost by 80-90%
- **Trade-off**: May use suboptimal paths if obstacles change
- **Refresh Rate**: Path recalculated every 5 ticks or on target change

### Task Transition Efficiency

**Zero-latency transitions**: Task switches happen immediately when conditions met

- No explicit waiting or delay states
- Maximizes creep utilization
- Prevents idle ticks

## Scaling Strategies

### When to Add More Harvesters

Add harvesters when:

- **Spawn queue depth > 5**: Not enough energy delivery
- **Controller downgrade timer < 5000**: Insufficient upgrade energy
- **Multiple sources unlocked**: 1-2 harvesters per source optimal

### When to Add More Upgraders

Add upgraders when:

- **Energy surplus**: Spawns/extensions frequently at capacity
- **RCL progress < target**: Want faster controller upgrades
- **CPU available**: Each upgrader costs ~0.5 CPU/tick

### Recommended Scaling Progression

| RCL | Sources | Harvesters | Upgraders | CPU Budget |
| --- | ------- | ---------- | --------- | ---------- |
| 1   | 1       | 2          | 1         | 2-3        |
| 2   | 2       | 3-4        | 1-2       | 3-5        |
| 3   | 2       | 4-5        | 2-3       | 5-8        |
| 4+  | 2+      | 2/source   | 3-5       | 8-15       |

## Error Handling

### Unknown Roles

If a creep has an unrecognized role:

- Warning logged: `Unknown role '{role}' for creep {name}`
- Creep skipped for that tick
- Manual intervention required (reassign or suicide)

### Missing Task State

If a creep's task is invalid:

- Task reset to role default
- No warning logged (automatic recovery)
- Continues execution normally

### Pathfinding Failures

If a creep cannot find a path:

- Move action returns `ERR_NO_PATH`
- Creep stays in place
- Will retry next tick (potential for stuck creeps)

## Strategy Validation Guidelines

When modifying role behavior, validate:

1. **Task transitions maintain state machine invariants**
2. **Energy flow is balanced (harvest rate ≥ consumption rate)**
3. **CPU usage stays within limits (measure with PerformanceTracker)**
4. **Memory structure remains compatible with MemoryManager**
5. **Spawn logic maintains minimum populations**

## Related Documentation

- [Task Prioritization](./task-prioritization.md) - Detailed task scheduling logic
- [Scaling Strategies](./scaling-strategies.md) - Multi-room expansion patterns
- [Memory Management](../operations/memory-management.md) - Memory hygiene and optimization
- [Performance Monitoring](../operations/performance-monitoring.md) - CPU tracking and alerting
