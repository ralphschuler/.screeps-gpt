# Phase 4: Multi-Room Management - Implementation Guide

This guide covers empire-level coordination, room claiming, colonization, and inter-room logistics.

## Phase Overview

**Goal**: Successfully manage 2-4 rooms with coordinated resource sharing and expansion automation.

**Duration**: 5-6 weeks  
**Priority**: MEDIUM  
**Prerequisites**: Phase 3 complete, primary room at RCL 6+  
**Status**: 📋 Planned

## Success Criteria

- ✅ Successfully claim and stabilize 2-4 rooms
- ✅ Inter-room energy transfer efficiency >70%
- ✅ New rooms reach RCL 3 within 50k ticks
- ✅ CPU usage scales linearly (<10 per room)
- ✅ No room failures due to resource starvation

## Architecture Changes

### New Modules

- `src/runtime/empire/` - Multi-room coordination
  - `EmpireManager.ts` - Empire-wide coordination
  - `ColonyManager.ts` - Room claiming and bootstrapping
  - `ScoutManager.ts` - Room reconnaissance

## Key Deliverables

### 1. Empire Manager

**Purpose**: Coordinate multiple rooms and allocate empire-wide resources

```typescript
// src/runtime/empire/EmpireManager.ts
export class EmpireManager {
  public run(): void {
    const rooms = this.getManagedRooms();

    // Allocate CPU budget
    const cpuBudget = this.allocateCPU(rooms);

    // Coordinate defense
    this.coordinateEmpireDefense(rooms);

    // Balance resources
    this.balanceEmpireResources(rooms);

    // Manage expansion
    this.manageExpansion(rooms);
  }

  private getManagedRooms(): Room[] {
    return Object.values(Game.rooms).filter(room => {
      return room.controller && room.controller.my;
    });
  }

  private allocateCPU(rooms: Room[]): Map<string, number> {
    const budget = new Map<string, number>();
    const cpuPerRoom = Game.cpu.limit / rooms.length;

    for (const room of rooms) {
      const rcl = room.controller?.level ?? 0;
      // Higher RCL rooms get slight priority
      const allocation = cpuPerRoom * (1 + rcl * 0.05);
      budget.set(room.name, allocation);
    }

    return budget;
  }

  private coordinateEmpireDefense(rooms: Room[]): void {
    // Check for threats across all rooms
    const threats = this.identifyThreats(rooms);

    if (threats.length > 0) {
      // Activate safe mode or deploy defenders
      for (const threat of threats) {
        this.respondToThreat(threat);
      }
    }
  }

  private identifyThreats(rooms: Room[]): RoomThreat[] {
    const threats: RoomThreat[] = [];

    for (const room of rooms) {
      const hostiles = room.find(FIND_HOSTILE_CREEPS);
      if (hostiles.length > 0) {
        threats.push({
          room: room.name,
          hostileCount: hostiles.length,
          severity: this.calculateThreatSeverity(hostiles)
        });
      }
    }

    return threats;
  }

  private calculateThreatSeverity(hostiles: Creep[]): number {
    // Calculate based on hostile body parts
    const attackParts = hostiles.reduce(
      (sum, creep) => sum + creep.body.filter(p => p.type === ATTACK || p.type === RANGED_ATTACK).length,
      0
    );
    return attackParts;
  }

  private respondToThreat(threat: RoomThreat): void {
    const room = Game.rooms[threat.room];
    if (!room) return;

    if (threat.severity > 10 && room.controller?.safeModeAvailable) {
      room.controller.activateSafeMode();
      console.log(`Safe mode activated in ${room.name}`);
    } else {
      // Request defender creeps from other rooms
      this.requestDefenders(threat);
    }
  }

  private balanceEmpireResources(rooms: Room[]): void {
    // Identify rooms with excess and deficit
    const resourceSummary = this.summarizeResources(rooms);

    for (const [resource, distribution] of resourceSummary) {
      this.redistributeResource(resource, distribution, rooms);
    }
  }

  private summarizeResources(rooms: Room[]): Map<ResourceConstant, ResourceDistribution> {
    const summary = new Map<ResourceConstant, ResourceDistribution>();

    for (const room of rooms) {
      const storage = room.storage;
      const terminal = room.terminal;

      if (storage || terminal) {
        const energy =
          (storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0) +
          (terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0);

        // Track energy distribution
        // (Similar for other resources)
      }
    }

    return summary;
  }

  private redistributeResource(resource: ResourceConstant, distribution: ResourceDistribution, rooms: Room[]): void {
    // Transfer from surplus rooms to deficit rooms via terminal
    const surplus = distribution.surplus;
    const deficit = distribution.deficit;

    if (surplus.length > 0 && deficit.length > 0) {
      const sourceRoom = Game.rooms[surplus[0].room];
      const targetRoom = deficit[0].room;

      if (sourceRoom?.terminal && !sourceRoom.terminal.cooldown) {
        sourceRoom.terminal.send(resource, 1000, targetRoom, "Empire rebalance");
      }
    }
  }

  private manageExpansion(rooms: Room[]): void {
    // Determine if expansion is viable
    if (this.shouldExpand(rooms)) {
      const targetRoom = this.identifyExpansionTarget(rooms);
      if (targetRoom) {
        this.initiateExpansion(targetRoom, rooms);
      }
    }
  }

  private shouldExpand(rooms: Room[]): boolean {
    const gcl = Game.gcl.level;
    const activeRooms = rooms.length;

    // Don't expand if at GCL limit
    if (activeRooms >= gcl) return false;

    // Don't expand if CPU bucket is low
    if (Game.cpu.bucket < 5000) return false;

    // Don't expand if any room is struggling
    const strugglingRooms = rooms.filter(r => {
      const rcl = r.controller?.level ?? 0;
      return rcl < 3; // Wait for all rooms to be at least RCL 3
    });

    return strugglingRooms.length === 0;
  }

  private identifyExpansionTarget(rooms: Room[]): string | null {
    // Use scout data to find suitable expansion room
    const scouts = this.getScoutReports();

    const candidates = scouts.filter(report => {
      return !report.claimed && report.sourceCount >= 2 && report.controllerLevel === 0 && !report.hostiles;
    });

    if (candidates.length === 0) return null;

    // Prefer rooms closer to existing empire
    return this.selectClosestRoom(candidates, rooms);
  }

  private getScoutReports(): ScoutReport[] {
    // Read from Memory.empire.scoutReports
    return [];
  }

  private selectClosestRoom(candidates: ScoutReport[], rooms: Room[]): string {
    // Find candidate with shortest path to existing rooms
    return candidates[0].roomName; // Placeholder
  }

  private initiateExpansion(targetRoom: string, rooms: Room[]): void {
    // Create claimer creep to claim the room
    // Set up remote harvesting to bootstrap
    console.log(`Initiating expansion to ${targetRoom}`);
  }

  private requestDefenders(threat: RoomThreat): void {
    // Add to empire defense queue
    // Other rooms will spawn defenders
  }
}

interface RoomThreat {
  room: string;
  hostileCount: number;
  severity: number;
}

interface ResourceDistribution {
  surplus: Array<{ room: string; amount: number }>;
  deficit: Array<{ room: string; needed: number }>;
}
```

### 2. Colony Manager

**Purpose**: Handle room claiming and initial colonization

```typescript
// src/runtime/empire/ColonyManager.ts
export class ColonyManager {
  public claimRoom(targetRoom: string, homeRoom: Room): void {
    // Create claimer creep if needed
    const claimers = homeRoom.find(FIND_MY_CREEPS, {
      filter: c => c.memory.role === "claimer" && c.memory.targetRoom === targetRoom
    });

    if (claimers.length === 0) {
      this.spawnClaimer(homeRoom, targetRoom);
    }
  }

  private spawnClaimer(homeRoom: Room, targetRoom: string): void {
    const spawns = homeRoom.find(FIND_MY_SPAWNS);
    if (spawns.length === 0) return;

    const spawn = spawns[0];
    const body = [CLAIM, MOVE];

    spawn.spawnCreep(body, `claimer-${targetRoom}-${Game.time}`, {
      memory: {
        role: "claimer",
        targetRoom,
        homeRoom: homeRoom.name
      }
    });
  }

  public bootstrapColony(targetRoom: string, homeRoom: Room): void {
    // Send remote harvesters to build first spawn
    this.sendRemoteHarvesters(targetRoom, homeRoom);

    // Send builders to construct spawn
    this.sendRemoteBuilders(targetRoom, homeRoom);

    // Monitor progress
    this.monitorColonyProgress(targetRoom);
  }

  private sendRemoteHarvesters(targetRoom: string, homeRoom: Room): void {
    // Spawn remote miners assigned to target room
  }

  private sendRemoteBuilders(targetRoom: string, homeRoom: Room): void {
    // Spawn builders to construct spawn in target room
  }

  private monitorColonyProgress(targetRoom: string): ColonyStatus {
    const room = Game.rooms[targetRoom];
    if (!room) {
      return { status: "unreachable", progress: 0 };
    }

    const spawns = room.find(FIND_MY_SPAWNS);
    if (spawns.length > 0) {
      return { status: "established", progress: 100 };
    }

    const constructionSites = room.find(FIND_CONSTRUCTION_SITES, {
      filter: { structureType: STRUCTURE_SPAWN }
    });

    if (constructionSites.length > 0) {
      const progress = constructionSites[0].progress / constructionSites[0].progressTotal;
      return { status: "building", progress: progress * 100 };
    }

    return { status: "pending", progress: 0 };
  }
}

interface ColonyStatus {
  status: "unreachable" | "pending" | "building" | "established";
  progress: number;
}
```

### 3. Scout Manager

**Purpose**: Explore and evaluate potential expansion rooms

```typescript
// src/runtime/empire/ScoutManager.ts
export class ScoutManager {
  public scoutRoom(roomName: string): void {
    // Create scout creep if needed
    const scouts = Object.values(Game.creeps).filter(
      c => c.memory.role === "scout" && c.memory.targetRoom === roomName
    );

    if (scouts.length === 0) {
      this.spawnScout(roomName);
    }
  }

  private spawnScout(targetRoom: string): void {
    // Spawn cheap scout creep (1 MOVE)
    const spawns = Object.values(Game.spawns);
    if (spawns.length === 0) return;

    const spawn = spawns[0];
    spawn.spawnCreep([MOVE], `scout-${targetRoom}-${Game.time}`, {
      memory: {
        role: "scout",
        targetRoom
      }
    });
  }

  public recordIntelligence(room: Room): ScoutReport {
    const report: ScoutReport = {
      roomName: room.name,
      scoutedAt: Game.time,
      claimed: !!room.controller?.owner,
      reserved: !!room.controller?.reservation,
      sourceCount: room.find(FIND_SOURCES).length,
      mineralType: room.find(FIND_MINERALS)[0]?.mineralType,
      controllerLevel: room.controller?.level ?? 0,
      hostiles: room.find(FIND_HOSTILE_CREEPS).length > 0,
      structures: room.find(FIND_STRUCTURES).length
    };

    // Store in Memory
    Memory.empire = Memory.empire || {};
    Memory.empire.scoutReports = Memory.empire.scoutReports || {};
    Memory.empire.scoutReports[room.name] = report;

    return report;
  }

  public getIntelligence(roomName: string): ScoutReport | null {
    return Memory.empire?.scoutReports?.[roomName] ?? null;
  }
}

interface ScoutReport {
  roomName: string;
  scoutedAt: number;
  claimed: boolean;
  reserved: boolean;
  sourceCount: number;
  mineralType?: MineralConstant;
  controllerLevel: number;
  hostiles: boolean;
  structures: number;
}
```

### 4. Claimer Role

```typescript
// In behavior roles
class ClaimerRole {
  public run(creep: Creep): void {
    const targetRoom = creep.memory.targetRoom;
    if (!targetRoom) return;

    if (creep.room.name !== targetRoom) {
      // Move to target room
      const exit = creep.room.findExitTo(targetRoom);
      if (exit !== ERR_NO_PATH && exit !== ERR_INVALID_ARGS) {
        const exitPos = creep.pos.findClosestByRange(exit);
        if (exitPos) {
          creep.moveTo(exitPos);
        }
      }
      return;
    }

    // In target room - claim controller
    const controller = creep.room.controller;
    if (controller) {
      if (creep.claimController(controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller);
      }
    }
  }
}
```

## Inter-Room Energy Transfer

Extend `StorageManager` to handle inter-room transfers:

```typescript
// In StorageManager.ts
private transferToDeficitRoom(room: Room, targetRoom: string, amount: number): void {
  const terminal = room.terminal;
  if (!terminal || terminal.cooldown > 0) return;

  const energyAvailable = terminal.store.getUsedCapacity(RESOURCE_ENERGY);
  if (energyAvailable >= amount + 1000) { // Reserve 1k for transfer cost
    terminal.send(RESOURCE_ENERGY, amount, targetRoom, "Empire support");
    console.log(`Sent ${amount} energy from ${room.name} to ${targetRoom}`);
  }
}
```

## CPU Allocation Per Room

Track and enforce CPU budgets:

```typescript
// In BootstrapKernel.ts
for (const room of rooms) {
  const cpuBudget = this.empireManager.getCPUBudget(room.name);
  const startCPU = Game.cpu.getUsed();

  this.processRoom(room);

  const cpuUsed = Game.cpu.getUsed() - startCPU;
  if (cpuUsed > cpuBudget) {
    console.log(`Warning: ${room.name} exceeded CPU budget (${cpuUsed.toFixed(2)} / ${cpuBudget.toFixed(2)})`);
  }
}
```

## Evaluation Integration

```typescript
// In SystemEvaluator.ts
if (snapshot.empireMetrics) {
  const { totalRooms, roomsStable, cpuPerRoom } = snapshot.empireMetrics;

  if (totalRooms > 1) {
    const avgCPU = Array.from(cpuPerRoom.values()).reduce((a, b) => a + b, 0) / totalRooms;

    if (avgCPU > 10) {
      findings.push({
        severity: "warning",
        title: "CPU per room exceeds target",
        detail: `Average: ${avgCPU.toFixed(1)} CPU/tick. Target: <10.`,
        recommendation: "Optimize room processing or reduce empire size."
      });
    }
  }

  if (roomsStable < totalRooms * 0.75) {
    findings.push({
      severity: "warning",
      title: "Too many unstable rooms",
      detail: `${roomsStable}/${totalRooms} rooms at RCL 3+.`,
      recommendation: "Focus on stabilizing existing rooms before expansion."
    });
  }
}
```

## Testing Strategy

```typescript
// tests/regression/phase4-empire.test.ts
describe("Phase 4: Multi-Room Management", () => {
  it("should successfully claim and bootstrap new room", async () => {
    const results = await runMultiRoomSimulation({
      duration: 50000,
      rooms: ["W1N1", "W2N1"]
    });

    const newRoom = results.rooms.find(r => r.name === "W2N1");
    expect(newRoom.rcl).toBeGreaterThanOrEqual(3);
  });

  it("should maintain CPU <10 per room", async () => {
    const results = await runMultiRoomSimulation({ rooms: 3 });

    const avgCPU = results.reduce((sum, r) => sum + r.cpuUsed, 0) / results.length;
    expect(avgCPU / 3).toBeLessThan(10);
  });
});
```

## Deployment Plan

- **Week 1-2**: Implement EmpireManager and CPU allocation
- **Week 3**: Implement ColonyManager and claiming mechanics
- **Week 4**: Implement ScoutManager and room reconnaissance
- **Week 5-6**: Testing, inter-room logistics, optimization

## Success Validation

- ✅ Claim 2 rooms successfully
- ✅ New rooms reach RCL 3 within 50k ticks
- ✅ CPU scales linearly
- ✅ Inter-room transfers maintain energy balance

## Next Phase

[Phase 5: Advanced Combat & Multi-Shard](./05-advanced-combat.md)

## References

- [Architecture Alignment](../architecture.md#empire-layer)
- [Development Roadmap](../roadmap.md#phase-4-multi-room-management)
- [Phase 3: Economy Expansion](./03-economy-expansion.md)
