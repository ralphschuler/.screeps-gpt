# Defense System

## Overview

The automated defense system provides real-time threat detection and coordinated defensive responses across all owned rooms. The system integrates threat detection with existing tower and combat infrastructure to enable autonomous defense without manual intervention.

## Architecture

### Core Components

#### ThreatDetector

The ThreatDetector scans rooms for hostile creeps and calculates threat levels based on body composition and hostile count.

**Threat Levels:**
- `none`: No hostiles present
- `low`: Single weak hostile (threat score < 50)
- `medium`: 2+ hostiles or moderate threat (threat score < 150)
- `high`: 3+ hostiles or high threat (threat score < 300)
- `critical`: 5+ hostiles or very high threat (threat score ≥ 300)

**Threat Scoring (aligned with CombatManager):**
- `ATTACK` parts: 10 points each
- `RANGED_ATTACK` parts: 5 points each
- `HEAL` parts: 8 points each (highest priority - healers sustain enemy forces)
- `WORK` parts: 5 points each (dismantlers threaten structures)
- `TOUGH` parts: 2 points each

**Memory Persistence:**

```typescript
interface ThreatMemory {
  rooms: Record<string, RoomThreatAssessment>;
  lastUpdate: number;
}
```

Threat data is tracked in `Memory.threats` with automatic cleanup of stale data (default: 100 ticks old).

#### DefenseCoordinator

The DefenseCoordinator integrates threat detection with tower and combat operations, managing defensive posture and coordinating responses.

**Defensive Postures:**
- `normal`: No threats, routine operations
- `alert`: Low/medium threat detected
- `defensive`: High threat, pause controller upgrading
- `emergency`: Critical threat, maximum defensive priority

**Coordination:**
- Activates towers to attack hostiles
- Deploys combat squads when threats detected
- Adjusts spawn priorities for defender creation
- Pauses controller upgrading during defensive/emergency postures

**Memory Persistence:**

```typescript
interface DefenseMemory {
  posture: Record<string, DefensivePosture>;
  lastDefenseAction: number;
}
```

Defense posture is tracked in `Memory.defense` for each room.

#### Combat Squad Memory

Combat squads are persisted in `Memory.combat`:

```typescript
interface CombatManagerMemory {
  squads: Record<string, Squad>;
}
```

## Integration Points

### Kernel Integration

The defense system runs **before infrastructure management** in the kernel execution flow:

```typescript
// 1. Threat detection and defense coordination
for (const roomName in game.rooms) {
  const room = game.rooms[roomName];
  if (room.controller?.my) {
    this.defenseCoordinator.coordinateDefense(room, game.time);
  }
}

// 2. Infrastructure management
this.infrastructureManager.run(game);

// 3. Behavior execution
this.behavior.execute(game, memory, roleCounts, bootstrapMinimums);
```

### BehaviorController Integration

The defense system modifies spawn priorities when threats are detected:

**Normal Mode:**
```
harvester → upgrader → builder → stationaryHarvester → hauler → repairer → remoteMiner → attacker → healer
```

**Defense Mode (defensive/emergency posture):**
```
harvester → hauler → attacker → healer → upgrader → builder → ...
```

**Controller Upgrading:**
Upgraders pause upgrading during `defensive` or `emergency` postures and move to safe positions near storage/spawns instead.

## Usage

### Accessing Defense Information

```typescript
// Check if a room is under threat
const threatLevel = defenseCoordinator.getThreatLevel("W0N0");
if (threatLevel !== "none") {
  console.log(`Room W0N0 under ${threatLevel} threat`);
}

// Check if upgrading should be paused
const shouldPause = defenseCoordinator.shouldPauseUpgrading("W0N0");

// Check if defenders should be prioritized
const needsDefenders = defenseCoordinator.shouldPrioritizeDefenders("W0N0");

// Get all threatened rooms
const threatenedRooms = defenseCoordinator.getThreatenedRooms();
```

### Memory Structure

```typescript
Memory.threats = {
  rooms: {
    "W0N0": {
      roomName: "W0N0",
      threatLevel: "high",
      hostileCount: 3,
      totalThreatScore: 180,
      threats: [
        {
          id: "hostile1" as Id<Creep>,
          room: "W0N0",
          pos: { x: 25, y: 25 },
          owner: "Enemy",
          bodyParts: { attack: 2, rangedAttack: 0, heal: 1, work: 0, tough: 1 },
          threatScore: 60,
          detectedAt: 1000
        }
      ],
      assessedAt: 1000
    }
  },
  lastUpdate: 1000
};

Memory.defense = {
  posture: {
    "W0N0": "defensive"
  },
  lastDefenseAction: 1000
};

Memory.combat = {
  squads: {
    "squad_1000_soldier1_soldier2": {
      id: "squad_1000_soldier1_soldier2",
      members: ["soldier1", "soldier2"],
      role: "defense",
      status: "active",
      createdAt: 1000
    }
  }
};
```

## Performance Characteristics

**Threat Detection:**
- Room scanning: O(n) where n = number of hostile creeps
- Memory updates: O(1) per room
- Cleanup: O(m) where m = number of tracked rooms

**Defense Coordination:**
- Tower activation: Handled by TowerManager (existing)
- Squad deployment: Handled by CombatManager (existing)
- CPU impact: Minimal (<0.1 CPU per room with threats)

**Memory Impact:**
- Base memory: ~100 bytes per threatened room
- Threat data: ~50 bytes per detected hostile
- Automatic cleanup prevents memory bloat

## Testing

The defense system includes comprehensive unit tests:

- `tests/unit/threatDetector.test.ts` - Threat detection and scoring
- `tests/unit/defenseCoordinator.test.ts` - Defense coordination and posture management
- `tests/unit/towerManager.test.ts` - Tower automation (existing)
- `tests/unit/combatManager.test.ts` - Combat squad management (existing)

## Future Enhancements

Potential improvements for Phase 5 (offensive operations):

1. **Scout Integration**: Detect threats in adjacent rooms before they arrive
2. **Rampart Coordination**: Prioritize rampart repair when under attack
3. **Safe Mode Automation**: Trigger safe mode for critical threats
4. **Retreat Logic**: Evacuate valuable creeps during emergency posture
5. **Counter-Attack**: Automatically pursue retreating hostiles
6. **Multi-Room Defense**: Coordinate defensive response across multiple rooms

## Related Documentation

- [Bootstrap Phases](./bootstrap-phases.md) - Phase progression and RCL management
- [Role Balancing](./role-balancing.md) - Spawn priority and role management
- [Task Actions Reference](./task-actions-reference.md) - Task system integration

## See Also

**Source Files:**
- `packages/bot/src/runtime/defense/ThreatDetector.ts`
- `packages/bot/src/runtime/defense/DefenseCoordinator.ts`
- `packages/bot/src/runtime/defense/TowerManager.ts`
- `packages/bot/src/runtime/defense/CombatManager.ts`
- `packages/bot/src/runtime/bootstrap/kernel.ts`
- `packages/bot/src/runtime/behavior/BehaviorController.ts`
