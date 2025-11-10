# Phase 1: RCL 1-2 Foundation - Implementation Guide

This guide provides detailed implementation tasks for Phase 1 of the Screeps GPT bot development roadmap, focusing on stabilizing the early-game economy and establishing reliable automation patterns.

## Phase Overview

**Goal**: Achieve stable, efficient economy at RCL 1-2 that serves as foundation for advanced features.

**Duration**: 2-3 weeks  
**Priority**: HIGH  
**Status**: 🚧 Ready for Implementation

## Success Criteria

Before advancing to Phase 2, the bot must achieve:

- ✅ Consistent energy surplus of 10+ energy/tick at RCL 2
- ✅ Controller downgrade timer never below 10,000 ticks
- ✅ Spawn utilization >70% of available time
- ✅ CPU usage <5 per tick with 3-5 creeps
- ✅ Zero respawns due to economic failure for 100k ticks on PTR

## Architecture Changes

### Files to Modify

- `src/runtime/behavior/BehaviorController.ts` - Enhanced spawn management
- `src/runtime/evaluation/SystemEvaluator.ts` - Add Phase 1 metrics

### Files to Create

- `src/runtime/behavior/infrastructure/ContainerPlacement.ts` - Container automation
- `src/runtime/behavior/infrastructure/RoadPlanning.ts` - Road network planning
- `tests/unit/containerPlacement.test.ts` - Container placement tests
- `tests/unit/roadPlanning.test.ts` - Road planning tests
- `tests/regression/phase1-economy.test.ts` - Economic stability validation

---

## Deliverable 1: Enhanced Spawn Priority System

### Current State

The `BehaviorController.ensureRoleMinimums()` method spawns creeps in a fixed order (harvester → upgrader → builder → remote miner) without considering room state.

### Problem

- Spawns harvesters even when energy is critically low (can't afford spawn cost)
- Doesn't prioritize controller downgrade risk
- No emergency mode for economic recovery

### Implementation

**Task 1.1**: Add energy threshold checks before spawning

```typescript
// In BehaviorController.ts

private canAffordSpawn(room: Room, bodyCost: number): boolean {
  const energyAvailable = room.energyAvailable;
  const energyNeededForUpgrade = 50; // Reserve for emergency upgrading

  // Don't spawn if it would leave too little energy for critical operations
  return energyAvailable >= (bodyCost + energyNeededForUpgrade);
}

private ensureRoleMinimums(room: Room): void {
  for (const [roleName, definition] of Object.entries(this.roles)) {
    const current = this.countCreepsInRole(room, roleName);
    const needed = definition.minimum;

    if (current < needed) {
      const bodyCost = this.calculateBodyCost(definition.body);

      // NEW: Check if we can afford to spawn
      if (!this.canAffordSpawn(room, bodyCost)) {
        console.log(`Skipping ${roleName} spawn - insufficient energy`);
        continue;
      }

      // Existing spawn logic...
    }
  }
}
```

**Task 1.2**: Implement dynamic spawn priority based on room state

```typescript
// In BehaviorController.ts

interface SpawnPriority {
  role: string;
  priority: number; // Higher = more urgent
  reason: string;
}

private calculateSpawnPriorities(room: Room): SpawnPriority[] {
  const priorities: SpawnPriority[] = [];
  const controller = room.controller;

  for (const [roleName, definition] of Object.entries(this.roles)) {
    const current = this.countCreepsInRole(room, roleName);
    const needed = definition.minimum;

    if (current < needed) {
      let priority = 50; // Default priority
      let reason = "Below minimum";

      // CRITICAL: Controller about to downgrade
      if (
        roleName === "upgrader" &&
        controller &&
        controller.ticksToDowngrade < 5000
      ) {
        priority = 100;
        reason = "Controller downgrade imminent";
      }

      // HIGH: No harvesters (economic collapse)
      if (roleName === "harvester" && current === 0) {
        priority = 90;
        reason = "No harvesters - economy stalled";
      }

      // NORMAL: Regular spawning
      priorities.push({ role: roleName, priority, reason });
    }
  }

  // Sort by priority descending
  return priorities.sort((a, b) => b.priority - a.priority);
}

private ensureRoleMinimums(room: Room): void {
  const priorities = this.calculateSpawnPriorities(room);

  for (const { role, priority, reason } of priorities) {
    const definition = this.roles[role];
    const bodyCost = this.calculateBodyCost(definition.body);

    if (!this.canAffordSpawn(room, bodyCost)) {
      continue;
    }

    console.log(`Spawning ${role} (priority ${priority}: ${reason})`);
    // Existing spawn logic...
    break; // Only spawn one creep per tick
  }
}
```

**Test Coverage**:

```typescript
// tests/unit/behaviorController-phase1.test.ts

describe("Phase 1: Enhanced Spawn Priority", () => {
  it("should prioritize upgraders when controller downgrade is imminent", () => {
    const room = mockRoom({
      controller: { ticksToDowngrade: 4000 }
    });
    const controller = new BehaviorController();
    const priorities = controller["calculateSpawnPriorities"](room);

    expect(priorities[0].role).toBe("upgrader");
    expect(priorities[0].priority).toBe(100);
  });

  it("should skip spawning when energy is too low", () => {
    const room = mockRoom({ energyAvailable: 40 }); // Not enough for 50-cost creep
    const controller = new BehaviorController();

    expect(controller["canAffordSpawn"](room, 50)).toBe(false);
  });

  it("should spawn harvesters first when economy is stalled", () => {
    const room = mockRoom({ creeps: [] }); // No creeps
    const controller = new BehaviorController();
    const priorities = controller["calculateSpawnPriorities"](room);

    expect(priorities[0].role).toBe("harvester");
    expect(priorities[0].priority).toBeGreaterThan(80);
  });
});
```

---

## Deliverable 2: Container-Based Harvesting

### Current State

Harvesters move between sources and spawns, wasting ticks on travel.

### Improvement

Place containers adjacent to sources and spawns to:

- Reduce harvester movement (static position)
- Increase energy throughput
- Enable dedicated hauler role (future Phase 2)

### Implementation

**Task 2.1**: Create ContainerPlacement utility

```typescript
// src/runtime/behavior/infrastructure/ContainerPlacement.ts

export class ContainerPlacement {
  /**
   * Identifies optimal positions for containers near sources
   */
  public planSourceContainers(room: Room): RoomPosition[] {
    const sources = room.find(FIND_SOURCES);
    const positions: RoomPosition[] = [];

    for (const source of sources) {
      // Find position adjacent to source with most access points
      const adjacent = this.getAdjacentPositions(source.pos);
      const optimal = adjacent.reduce((best, pos) => {
        const accessPoints = this.countAccessPoints(pos);
        return accessPoints > this.countAccessPoints(best) ? pos : best;
      });

      positions.push(optimal);
    }

    return positions;
  }

  private getAdjacentPositions(pos: RoomPosition): RoomPosition[] {
    const positions: RoomPosition[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const x = pos.x + dx;
        const y = pos.y + dy;
        if (x > 0 && x < 49 && y > 0 && y < 49) {
          positions.push(new RoomPosition(x, y, pos.roomName));
        }
      }
    }
    return positions.filter(p => this.isValidContainerPosition(p));
  }

  private isValidContainerPosition(pos: RoomPosition): boolean {
    // Check terrain
    const terrain = Game.map.getRoomTerrain(pos.roomName);
    if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) {
      return false;
    }

    // Check for existing structures
    const structures = pos.lookFor(LOOK_STRUCTURES);
    if (structures.length > 0) {
      return false;
    }

    return true;
  }

  private countAccessPoints(pos: RoomPosition): number {
    // Count walkable adjacent tiles
    return this.getAdjacentPositions(pos).filter(p => {
      const terrain = Game.map.getRoomTerrain(p.roomName);
      return terrain.get(p.x, p.y) !== TERRAIN_MASK_WALL;
    }).length;
  }
}
```

**Task 2.2**: Integrate container placement into BehaviorController

```typescript
// In BehaviorController.ts

import { ContainerPlacement } from "./infrastructure/ContainerPlacement";

export class BehaviorController {
  private containerPlacement = new ContainerPlacement();

  public run(room: Room): void {
    // Existing behavior logic...

    // NEW: Plan and build containers at RCL 2+
    if (room.controller && room.controller.level >= 2) {
      this.ensureSourceContainers(room);
    }
  }

  private ensureSourceContainers(room: Room): void {
    const plannedPositions = this.containerPlacement.planSourceContainers(room);

    for (const pos of plannedPositions) {
      const existingStructures = pos.lookFor(LOOK_STRUCTURES);
      const hasContainer = existingStructures.some(s => s.structureType === STRUCTURE_CONTAINER);

      if (!hasContainer) {
        const existingConstruction = pos.lookFor(LOOK_CONSTRUCTION_SITES);
        const hasConstructionSite = existingConstruction.some(s => s.structureType === STRUCTURE_CONTAINER);

        if (!hasConstructionSite) {
          room.createConstructionSite(pos, STRUCTURE_CONTAINER);
          console.log(`Creating container at source in ${room.name}`);
        }
      }
    }
  }
}
```

**Task 2.3**: Update harvester role to use containers

```typescript
// In harvester role implementation

private harvestTask(creep: Creep): void {
  const source = this.findClosestSource(creep);
  if (!source) return;

  // NEW: Check for container at source
  const containers = source.pos.findInRange(FIND_STRUCTURES, 1, {
    filter: s => s.structureType === STRUCTURE_CONTAINER
  });

  if (containers.length > 0) {
    const container = containers[0] as StructureContainer;

    // Position on container if not already there
    if (!creep.pos.isEqualTo(container.pos)) {
      creep.moveTo(container.pos, { reusePath: 10 });
      return;
    }
  }

  // Harvest from source
  if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
    creep.moveTo(source, { reusePath: 5 });
  }
}
```

---

## Deliverable 3: Road Network Automation

### Goal

Automatically plan and build roads connecting:

- Sources → Spawn
- Sources → Controller
- Spawn → Controller

### Implementation

**Task 3.1**: Create RoadPlanning utility

```typescript
// src/runtime/behavior/infrastructure/RoadPlanning.ts

export class RoadPlanning {
  public planRoadNetwork(room: Room): RoomPosition[] {
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) return [];

    const sources = room.find(FIND_SOURCES);
    const controller = room.controller;
    const roadPositions: RoomPosition[] = [];

    // Plan roads: sources → spawn
    for (const source of sources) {
      const path = spawn.pos.findPathTo(source.pos, {
        ignoreCreeps: true,
        swampCost: 1 // Treat swamps as plains for road planning
      });
      roadPositions.push(...path.map(p => new RoomPosition(p.x, p.y, room.name)));
    }

    // Plan roads: spawn → controller
    if (controller) {
      const path = spawn.pos.findPathTo(controller.pos, {
        ignoreCreeps: true,
        range: 3 // Controller can be upgraded from range 3
      });
      roadPositions.push(...path.map(p => new RoomPosition(p.x, p.y, room.name)));
    }

    // Deduplicate positions
    return this.deduplicatePositions(roadPositions);
  }

  private deduplicatePositions(positions: RoomPosition[]): RoomPosition[] {
    const seen = new Set<string>();
    return positions.filter(pos => {
      const key = `${pos.x},${pos.y}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
```

**Task 3.2**: Integrate road planning with builder role

```typescript
// In BehaviorController.ts or builder role

private ensureRoadNetwork(room: Room): void {
  const roadPlanning = new RoadPlanning();
  const plannedRoads = roadPlanning.planRoadNetwork(room);

  let roadsPlanned = 0;
  const maxRoadsPerTick = 5; // Throttle to prevent excessive construction sites

  for (const pos of plannedRoads) {
    if (roadsPlanned >= maxRoadsPerTick) break;

    const structures = pos.lookFor(LOOK_STRUCTURES);
    const hasRoad = structures.some(s => s.structureType === STRUCTURE_ROAD);

    if (!hasRoad) {
      const constructionSites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
      const hasConstructionSite = constructionSites.some(
        s => s.structureType === STRUCTURE_ROAD
      );

      if (!hasConstructionSite) {
        room.createConstructionSite(pos, STRUCTURE_ROAD);
        roadsPlanned++;
      }
    }
  }
}
```

---

## Deliverable 4: Dynamic Role Population

### Goal

Adjust minimum creep counts based on room state rather than fixed values.

### Implementation

**Task 4.1**: Add population scaling logic

```typescript
// In BehaviorController.ts

interface DynamicPopulation {
  role: string;
  minimum: number;
  reason: string;
}

private calculateDynamicPopulation(room: Room): DynamicPopulation[] {
  const sources = room.find(FIND_SOURCES).length;
  const rcl = room.controller?.level ?? 1;

  const population: DynamicPopulation[] = [];

  // Harvesters: 1-2 per source depending on RCL
  const harvestersPerSource = rcl >= 2 ? 2 : 1;
  population.push({
    role: "harvester",
    minimum: sources * harvestersPerSource,
    reason: `${harvestersPerSource} per source (RCL ${rcl})`
  });

  // Upgraders: Scale with available energy
  const energyCapacity = room.energyCapacityAvailable;
  const upgraders = energyCapacity >= 550 ? 2 : 1;
  population.push({
    role: "upgrader",
    minimum: upgraders,
    reason: `Based on energy capacity (${energyCapacity})`
  });

  // Builders: Only when construction sites exist
  const constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
  const builders = constructionSites > 0 ? 1 : 0;
  population.push({
    role: "builder",
    minimum: builders,
    reason: `${constructionSites} construction sites`
  });

  return population;
}
```

---

## Deliverable 5: CPU Optimization for Early Game

### Goal

Ensure CPU usage stays below 5 per tick with 3-5 creeps.

### Implementation

**Task 5.1**: Optimize pathfinding with longer reuse

```typescript
// In role implementations, increase reusePath

// Harvester (static positions with containers)
creep.moveTo(target, { reusePath: 10 }); // Was 5

// Upgrader (mostly static near controller)
creep.moveTo(controller, { range: 3, reusePath: 10 }); // Was 5
```

**Task 5.2**: Add CPU profiling to PerformanceTracker

```typescript
// In PerformanceTracker.ts

public profileSubsystem(name: string, fn: () => void): void {
  const start = Game.cpu.getUsed();
  fn();
  const end = Game.cpu.getUsed();

  const cost = end - start;
  console.log(`[CPU] ${name}: ${cost.toFixed(3)}`);

  // Store in Memory for trending
  Memory.cpuProfile = Memory.cpuProfile || {};
  Memory.cpuProfile[name] = Memory.cpuProfile[name] || [];
  Memory.cpuProfile[name].push(cost);

  // Keep only last 100 samples
  if (Memory.cpuProfile[name].length > 100) {
    Memory.cpuProfile[name].shift();
  }
}
```

**Task 5.3**: Profile behavior execution

```typescript
// In BootstrapKernel.ts or BehaviorController.ts

this.performanceTracker.profileSubsystem("Behavior", () => {
  this.behaviorController.run(room);
});

this.performanceTracker.profileSubsystem("Memory", () => {
  this.memoryManager.cleanup();
});
```

---

## Evaluation Integration

### Extend SystemEvaluator

Add Phase 1 metrics to evaluation:

```typescript
// In SystemEvaluator.ts

// Energy surplus check
const energyIncome = snapshot.execution.harvestRate ?? 0;
const energyExpense = snapshot.execution.spawnCost ?? 0;
const energySurplus = energyIncome - energyExpense;

if (energySurplus < 10 && (memory?.controller?.level ?? 1) >= 2) {
  findings.push({
    severity: "warning",
    title: "Phase 1 target: Energy surplus below 10/tick",
    detail: `Current: ${energySurplus.toFixed(1)}/tick. Target: 10+/tick for RCL 2.`,
    recommendation: "Optimize harvesting or reduce energy consumption."
  });
}

// Controller downgrade check (already exists, just ensure threshold)
if (memory?.controller?.ticksToDowngrade && memory.controller.ticksToDowngrade < 10000) {
  findings.push({
    severity: "critical",
    title: "Phase 1 failure: Controller downgrade risk",
    detail: `Downgrade in ${memory.controller.ticksToDowngrade} ticks. Must maintain >10,000.`,
    recommendation: "Increase upgrader count immediately."
  });
}
```

---

## Testing Strategy

### Regression Tests

Create `tests/regression/phase1-economy.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("Phase 1: Economic Stability", () => {
  it("should maintain energy surplus >10/tick at RCL 2", async () => {
    // Run simulation for 1000 ticks
    const results = await runSimulation({
      duration: 1000,
      targetRCL: 2
    });

    const avgSurplus = results.reduce((sum, r) => sum + r.energySurplus, 0) / results.length;
    expect(avgSurplus).toBeGreaterThan(10);
  });

  it("should never let controller downgrade timer go below 10k", async () => {
    const results = await runSimulation({ duration: 5000 });

    const minDowngradeTimer = Math.min(...results.map(r => r.controllerDowngradeTimer));
    expect(minDowngradeTimer).toBeGreaterThan(10000);
  });

  it("should maintain spawn utilization >70%", async () => {
    const results = await runSimulation({ duration: 1000, targetRCL: 2 });

    const avgUtilization = results.reduce((sum, r) => sum + r.spawnUtilization, 0) / results.length;
    expect(avgUtilization).toBeGreaterThan(0.7);
  });
});
```

---

## Deployment Plan

### Week 1: Foundation

- [ ] Implement enhanced spawn priority (Deliverable 1)
- [ ] Add unit tests for spawn priority logic
- [ ] Deploy to PTR and validate
- [ ] Add CPU profiling infrastructure (Deliverable 5.2-5.3)

### Week 2: Infrastructure

- [ ] Implement container placement (Deliverable 2)
- [ ] Implement road planning (Deliverable 3)
- [ ] Update harvester and builder roles to use infrastructure
- [ ] Deploy to PTR and monitor performance

### Week 3: Optimization

- [ ] Implement dynamic population scaling (Deliverable 4)
- [ ] Optimize CPU usage (Deliverable 5.1)
- [ ] Add Phase 1 evaluation metrics
- [ ] Create regression tests
- [ ] Final PTR validation (must pass 100k tick stability test)

---

## Success Validation

Before marking Phase 1 complete:

1. **Deploy to PTR** and run for 100,000 ticks (minimum)
2. **Verify all metrics**:
   - Energy surplus >10/tick ✅
   - Controller downgrade timer >10,000 ✅
   - Spawn utilization >70% ✅
   - CPU usage <5/tick ✅
   - Zero respawns ✅
3. **Run regression test suite** - all tests passing
4. **Generate evaluation report** - no critical findings
5. **Document lessons learned** in `docs/operations/phase1-postmortem.md`

---

## Troubleshooting

### Common Issues

**Issue**: Spawn priority not working as expected  
**Diagnosis**: Check `calculateSpawnPriorities()` output in console  
**Fix**: Verify controller.ticksToDowngrade is being read correctly

**Issue**: Container placement fails  
**Diagnosis**: Check terrain and existing structures at planned positions  
**Fix**: Improve `isValidContainerPosition()` checks

**Issue**: CPU usage above 5/tick  
**Diagnosis**: Use CPU profiling to identify hotspots  
**Fix**: Increase `reusePath` values, cache expensive calculations

**Issue**: Roads not being built  
**Diagnosis**: Check builder creep count and construction site limits  
**Fix**: Ensure at least 1 builder when construction sites exist

---

## Next Phase

Once Phase 1 is complete and validated, proceed to:

**[Phase 2: Core Task Framework](./02-core-framework.md)**

---

## References

- [Creep Roles Documentation](../../runtime/strategy/creep-roles.md)
- [Scaling Strategies](../../runtime/strategy/scaling-strategies.md)
- [Performance Monitoring](../../operations/performance-monitoring.md)
- [Development Roadmap](../roadmap.md)
