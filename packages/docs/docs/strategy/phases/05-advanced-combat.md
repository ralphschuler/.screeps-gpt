# Phase 5: Advanced Combat & Multi-Shard - Implementation Guide

This guide covers military operations, multi-shard expansion, and advanced combat tactics.

## Phase Overview

**Goal**: Implement offensive/defensive military capabilities and establish multi-shard presence.

**Duration**: 6-8 weeks  
**Priority**: LOW (Future)  
**Prerequisites**: Phase 4 complete, empire established (4+ rooms), GCL 5+  
**Status**: 📋 Future Planning

## Success Criteria

- ✅ Successfully defend against player attacks
- ✅ Conduct offensive operations to claim contested rooms
- ✅ Maintain presence on 2+ shards simultaneously
- ✅ CPU efficiency <12 per room across shards
- ✅ GCL progression >1 level per week

## Architecture Changes

### New Modules

- `src/runtime/military/` - Combat operations
  - `SquadManager.ts` - Formation and tactics
  - `DefenseManager.ts` - Automated defense
  - `SiegeManager.ts` - Offensive operations
  - `ThreatAssessment.ts` - Enemy analysis
- `src/runtime/shard/` - Multi-shard management
  - `ShardCoordinator.ts` - Cross-shard coordination
  - `PortalManager.ts` - Inter-shard logistics

## Key Deliverables

### 1. Military Creep Roles

**Attacker**: Melee combat specialist

```typescript
class AttackerRole {
  public static readonly BODY = [TOUGH, TOUGH, MOVE, MOVE, ATTACK, ATTACK, MOVE];

  public run(creep: Creep): void {
    const targetRoom = creep.memory.targetRoom;

    if (creep.room.name !== targetRoom) {
      this.moveToRoom(creep, targetRoom);
      return;
    }

    const hostile = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    if (hostile) {
      if (creep.attack(hostile) === ERR_NOT_IN_RANGE) {
        creep.moveTo(hostile);
      }
    } else {
      // Attack hostile structures
      const hostileStructure = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);
      if (hostileStructure) {
        if (creep.attack(hostileStructure) === ERR_NOT_IN_RANGE) {
          creep.moveTo(hostileStructure);
        }
      }
    }
  }

  private moveToRoom(creep: Creep, targetRoom: string): void {
    const exit = creep.room.findExitTo(targetRoom);
    if (exit !== ERR_NO_PATH && exit !== ERR_INVALID_ARGS) {
      const exitPos = creep.pos.findClosestByRange(exit);
      if (exitPos) creep.moveTo(exitPos);
    }
  }
}
```

**Healer**: Support and recovery specialist

```typescript
class HealerRole {
  public static readonly BODY = [MOVE, MOVE, MOVE, HEAL, HEAL, HEAL];

  public run(creep: Creep): void {
    const squad = this.getSquad(creep);
    if (!squad) return;

    // Follow squad leader
    const leader = Game.getObjectById(squad.leader);
    if (leader && !creep.pos.isNearTo(leader)) {
      creep.moveTo(leader);
    }

    // Heal damaged squad members
    const damaged = squad.members.map(id => Game.getObjectById(id)).filter(c => c && c.hits < c.hitsMax)[0];

    if (damaged) {
      if (creep.pos.isNearTo(damaged)) {
        creep.heal(damaged);
      } else {
        creep.rangedHeal(damaged);
      }
    }
  }

  private getSquad(creep: Creep): Squad | undefined {
    return Memory.military?.squads?.find(s => s.members.includes(creep.id));
  }
}
```

**Ranger**: Ranged combat specialist

```typescript
class RangerRole {
  public static readonly BODY = [MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK];

  public run(creep: Creep): void {
    const hostile = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);

    if (hostile) {
      const range = creep.pos.getRangeTo(hostile);

      if (range > 3) {
        creep.moveTo(hostile);
      } else if (range < 3) {
        // Kite away
        const fleeDirection = this.getFleeDirection(creep.pos, hostile.pos);
        creep.move(fleeDirection);
      }

      creep.rangedAttack(hostile);
    }
  }

  private getFleeDirection(from: RoomPosition, away: RoomPosition): DirectionConstant {
    const dx = from.x - away.x;
    const dy = from.y - away.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? RIGHT : LEFT;
    } else {
      return dy > 0 ? BOTTOM : TOP;
    }
  }
}
```

### 2. Squad Manager

**Purpose**: Coordinate military creeps in formations

```typescript
// packages/bot/src/runtime/military/SquadManager.ts
export class SquadManager {
  public createSquad(composition: SquadComposition): Squad {
    const squadId = `squad-${Game.time}`;

    const squad: Squad = {
      id: squadId,
      members: [],
      leader: undefined,
      targetRoom: composition.targetRoom,
      formation: composition.formation,
      status: "forming"
    };

    // Spawn squad members
    this.spawnSquadMembers(squad, composition);

    // Store in Memory
    Memory.military = Memory.military || { squads: [] };
    Memory.military.squads.push(squad);

    return squad;
  }

  private spawnSquadMembers(squad: Squad, composition: SquadComposition): void {
    // Spawn attackers, healers, rangers based on composition
    const roles = [
      { role: "attacker", count: composition.attackers },
      { role: "healer", count: composition.healers },
      { role: "ranger", count: composition.rangers }
    ];

    for (const { role, count } of roles) {
      for (let i = 0; i < count; i++) {
        this.spawnSquadMember(squad, role);
      }
    }
  }

  private spawnSquadMember(squad: Squad, role: string): void {
    // Find available spawn and create creep
    // Add creep ID to squad.members
  }

  public moveSquad(squad: Squad, target: RoomPosition): void {
    const members = squad.members.map(id => Game.getObjectById(id)).filter(c => c !== null) as Creep[];

    if (members.length === 0) return;

    const leader = members[0];
    squad.leader = leader.id;

    // Leader moves to target
    leader.moveTo(target);

    // Other members follow leader in formation
    this.executeFormation(squad, members, leader);
  }

  private executeFormation(squad: Squad, members: Creep[], leader: Creep): void {
    if (squad.formation === "tight") {
      // All members stay within 1 tile of leader
      for (const member of members) {
        if (member.id === leader.id) continue;
        if (!member.pos.isNearTo(leader)) {
          member.moveTo(leader);
        }
      }
    } else if (squad.formation === "spread") {
      // Members maintain 2-3 tile spacing
      for (const member of members) {
        if (member.id === leader.id) continue;
        const range = member.pos.getRangeTo(leader);
        if (range > 3) {
          member.moveTo(leader);
        } else if (range < 2) {
          // Move away from leader
        }
      }
    }
  }

  public disbandSquad(squadId: string): void {
    const squads = Memory.military?.squads ?? [];
    Memory.military.squads = squads.filter(s => s.id !== squadId);
  }
}

interface Squad {
  id: string;
  members: Id<Creep>[];
  leader?: Id<Creep>;
  targetRoom: string;
  formation: FormationType;
  status: "forming" | "moving" | "engaged" | "retreating";
}

interface SquadComposition {
  targetRoom: string;
  attackers: number;
  healers: number;
  rangers: number;
  formation: FormationType;
}

type FormationType = "tight" | "spread" | "line";
```

### 3. Defense Manager

**Purpose**: Automated defense coordination

```typescript
// packages/bot/src/runtime/military/DefenseManager.ts
export class DefenseManager {
  public run(room: Room): void {
    const threats = this.assessThreats(room);

    if (threats.length === 0) return;

    const threatLevel = this.calculateThreatLevel(threats);

    if (threatLevel > 50) {
      this.activateEmergencyDefense(room);
    } else {
      this.deployDefenders(room, threatLevel);
    }
  }

  private assessThreats(room: Room): Creep[] {
    return room.find(FIND_HOSTILE_CREEPS);
  }

  private calculateThreatLevel(threats: Creep[]): number {
    let level = 0;

    for (const threat of threats) {
      // Count attack parts
      const attackParts = threat.body.filter(p => p.type === ATTACK || p.type === RANGED_ATTACK).length;
      level += attackParts * 10;
    }

    return level;
  }

  private activateEmergencyDefense(room: Room): void {
    const controller = room.controller;

    if (controller?.safeModeAvailable && controller.safeModeCooldown === undefined) {
      controller.activateSafeMode();
      console.log(`[DEFENSE] Safe mode activated in ${room.name}`);

      // Notify user
      Game.notify(`Safe mode activated in ${room.name} due to high threat level`);
    }
  }

  private deployDefenders(room: Room, threatLevel: number): void {
    const defenders = room.find(FIND_MY_CREEPS, {
      filter: c => c.memory.role === "defender"
    });

    const needed = Math.ceil(threatLevel / 20);

    if (defenders.length < needed) {
      // Spawn more defenders
      this.spawnDefender(room);
    }
  }

  private spawnDefender(room: Room): void {
    const spawns = room.find(FIND_MY_SPAWNS);
    if (spawns.length === 0) return;

    const spawn = spawns[0];
    const body = [TOUGH, MOVE, ATTACK, MOVE, ATTACK];

    spawn.spawnCreep(body, `defender-${room.name}-${Game.time}`, {
      memory: { role: "defender", homeRoom: room.name }
    });
  }
}
```

### 4. Siege Manager

**Purpose**: Offensive room conquest

```typescript
// packages/bot/src/runtime/military/SiegeManager.ts
export class SiegeManager {
  public planSiege(targetRoom: string): SiegePlan {
    const intel = this.gatherIntelligence(targetRoom);

    return {
      targetRoom,
      phases: [
        { name: "scout", duration: 1000, objective: "Gather room intel" },
        { name: "breach", duration: 5000, objective: "Destroy outer defenses" },
        { name: "claim", duration: 1000, objective: "Claim controller" },
        { name: "secure", duration: 10000, objective: "Establish spawn" }
      ],
      requiredForces: this.calculateRequiredForces(intel),
      estimatedDuration: 20000
    };
  }

  private gatherIntelligence(targetRoom: string): RoomIntelligence {
    // Read from scout reports
    return {
      towers: 0,
      ramparts: 0,
      walls: 0,
      hostileCreeps: 0,
      controllerLevel: 0
    };
  }

  private calculateRequiredForces(intel: RoomIntelligence): SquadComposition {
    // Calculate based on defenses
    const attackers = Math.max(5, intel.towers * 2);
    const healers = Math.max(3, attackers / 2);
    const rangers = Math.max(2, intel.ramparts > 0 ? 5 : 2);

    return {
      targetRoom: "",
      attackers,
      healers,
      rangers,
      formation: "tight"
    };
  }

  public executeSiege(plan: SiegePlan): void {
    // Create and coordinate squads based on plan
    console.log(`Executing siege on ${plan.targetRoom}`);
  }
}

interface SiegePlan {
  targetRoom: string;
  phases: SiegePhase[];
  requiredForces: SquadComposition;
  estimatedDuration: number;
}

interface SiegePhase {
  name: string;
  duration: number;
  objective: string;
}

interface RoomIntelligence {
  towers: number;
  ramparts: number;
  walls: number;
  hostileCreeps: number;
  controllerLevel: number;
}
```

### 5. Multi-Shard Coordination

**Shard Coordinator**:

```typescript
// packages/bot/src/runtime/shard/ShardCoordinator.ts
export class ShardCoordinator {
  public run(): void {
    const currentShard = Game.shard.name;

    // Read inter-shard memory
    const shardData = this.getShardData();

    // Update current shard status
    this.updateShardStatus(currentShard, shardData);

    // Coordinate GCL allocation
    this.allocateGCL(shardData);

    // Coordinate resources if needed
    this.coordinateResources(shardData);
  }

  private getShardData(): Map<string, ShardStatus> {
    const data = new Map<string, ShardStatus>();

    // Read from InterShardMemory
    const raw = InterShardMemory.getLocal();
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const [shard, status] of Object.entries(parsed)) {
        data.set(shard, status as ShardStatus);
      }
    }

    return data;
  }

  private updateShardStatus(shard: string, data: Map<string, ShardStatus>): void {
    const rooms = Object.values(Game.rooms).filter(r => r.controller?.my);

    const status: ShardStatus = {
      shard,
      rooms: rooms.length,
      gcl: Game.gcl.level,
      cpu: Game.cpu.getUsed(),
      lastUpdate: Game.time
    };

    data.set(shard, status);

    // Write to InterShardMemory
    InterShardMemory.setLocal(JSON.stringify(Object.fromEntries(data)));
  }

  private allocateGCL(data: Map<string, ShardStatus>): void {
    // Distribute GCL budget across shards
    // Focus on shards with room for expansion
  }

  private coordinateResources(data: Map<string, ShardStatus>): void {
    // Plan portal logistics if needed
  }
}

interface ShardStatus {
  shard: string;
  rooms: number;
  gcl: number;
  cpu: number;
  lastUpdate: number;
}
```

**Portal Manager**:

```typescript
// packages/bot/src/runtime/shard/PortalManager.ts
export class PortalManager {
  public findPortals(room: Room): StructurePortal[] {
    return room.find(FIND_STRUCTURES, {
      filter: { structureType: STRUCTURE_PORTAL }
    }) as StructurePortal[];
  }

  public establishRoute(fromShard: string, toShard: string): PortalRoute | null {
    // Find portal path between shards
    // Store in Memory for reuse
    return null;
  }

  public transferCreeps(route: PortalRoute, creeps: Creep[]): void {
    // Send creeps through portal
    for (const creep of creeps) {
      creep.moveTo(route.portalPos);
    }
  }
}

interface PortalRoute {
  fromShard: string;
  toShard: string;
  portalPos: RoomPosition;
  travelTime: number;
}
```

## Evaluation Integration

```typescript
// In SystemEvaluator.ts
if (snapshot.militaryMetrics) {
  const { activeSquads, defensesActive, hostilesEngaged } = snapshot.militaryMetrics;

  if (hostilesEngaged > 0 && !defensesActive) {
    findings.push({
      severity: "critical",
      title: "Hostiles present but defenses inactive",
      detail: `${hostilesEngaged} hostiles detected. Defense not responding.`,
      recommendation: "Check DefenseManager and tower automation."
    });
  }

  if (activeSquads > 0) {
    findings.push({
      severity: "info",
      title: `${activeSquads} military squad(s) active`,
      detail: "Offensive operations in progress.",
      recommendation: "Monitor CPU usage and combat effectiveness."
    });
  }
}
```

## Testing Strategy

```typescript
// tests/regression/phase5-combat.test.ts
describe("Phase 5: Combat Operations", () => {
  it("should defend against hostile intrusion", async () => {
    const results = await runCombatSimulation({
      hostileCount: 3,
      hostileBody: [ATTACK, ATTACK, MOVE]
    });

    expect(results.roomSurvived).toBe(true);
    expect(results.hostilesEliminated).toBe(3);
  });

  it("should successfully siege and claim hostile room", async () => {
    const results = await runSiegeSimulation({
      targetRoom: "W5N5",
      defenseLevel: "medium"
    });

    expect(results.roomClaimed).toBe(true);
  });
});
```

## Deployment Plan

- **Week 1-2**: Implement military roles and DefenseManager
- **Week 3-4**: Implement SquadManager and formation tactics
- **Week 5**: Implement SiegeManager and offensive capabilities
- **Week 6-7**: Multi-shard coordination
- **Week 8**: Testing and optimization

## Success Validation

- ✅ Defend against player attack (PTR or live)
- ✅ Successfully claim contested room
- ✅ Maintain 2-shard presence
- ✅ CPU remains efficient

## References

- [Architecture Alignment](../architecture.md#military-layer)
- [Development Roadmap](../roadmap.md#phase-5-advanced-combat--multi-shard)
- [Phase 4: Multi-Room Management](./04-multi-room.md)
