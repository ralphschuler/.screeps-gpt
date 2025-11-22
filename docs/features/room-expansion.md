# Room Expansion System

The room expansion system enables the AI to automatically expand to additional rooms when conditions are favorable. This system integrates scouting, empire management, colony planning, and behavior control to seamlessly claim new territory.

## Configuration

### Build-Time Configuration

The system uses the `PLAYER_USERNAME` environment variable to identify your rooms vs. enemy rooms:

```bash
# Default build (uses "ralphschuler")
yarn build

# Build with custom username
PLAYER_USERNAME="yourname" yarn build

# In GitHub Actions (use repository variable)
PLAYER_USERNAME=${{ vars.PLAYER_USERNAME }} yarn build
```

The player username is injected at build time as `__PLAYER_USERNAME__` and cannot be changed at runtime.

## Overview

The expansion system operates through a coordinated pipeline:

1. **Scouting** - Discovers adjacent rooms and collects intelligence
2. **Evaluation** - Assesses expansion readiness based on GCL, CPU, and stability
3. **Planning** - Prioritizes expansion targets and maintains a queue
4. **Execution** - Spawns claimer creeps to claim target controllers
5. **Takeover Planning** - Identifies occupied rooms for potential conquest

## Components

### ScoutManager (`packages/bot/src/runtime/scouting/ScoutManager.ts`)

Discovers and analyzes adjacent rooms:
- Runs every 100 ticks via ScoutingProcess
- Scans 8 adjacent rooms around each owned room
- Collects intelligence: sources, minerals, ownership, threats
- Stores data in Memory.scout with 10k tick lifetime
- Calculates path distances from home rooms
- Analyzes hostile structures and creep composition

### EmpireManager (`packages/bot/src/runtime/empire/EmpireManager.ts`)

Coordinates empire-wide expansion decisions:
- Checks expansion conditions every tick
- Evaluates GCL capacity (activeRooms < gcl.level)
- Monitors CPU bucket (>= 5000)
- Assesses room stability (all rooms >= RCL 3)
- Identifies best expansion targets from scout data
- **NEW**: Accepts rooms with 1+ sources (not just 2+)
- **NEW**: Identifies occupied rooms for takeover planning
- Initiates expansion requests via ColonyManager

### ColonyManager (`packages/bot/src/runtime/planning/ColonyManager.ts`)

Maintains the expansion queue:
- Stores expansion requests in Memory.colony.expansionQueue
- Priority-based queue (higher priority first)
- Prevents duplicate requests for same room
- Tracks request status: pending, claimed, failed
- Evaluates expansion opportunities every 100 ticks

### BehaviorController (`packages/bot/src/runtime/behavior/BehaviorController.ts`)

Spawns claimer creeps for expansion:
- Checks expansion queue after role minimum spawning
- Identifies expansions without assigned claimers
- Prioritizes by expansion request priority
- Spawns claimers with target room and home room memory
- Prevents duplicate claimers for same target

### Claimer Creep (`packages/bot/src/runtime/behavior/stateMachines/claimer.ts`)

Executes the claiming:
- Travels to target room
- Finds and claims the controller
- Body: CLAIM + MOVE parts (scales with energy)
- Minimum cost: 650 energy (1 CLAIM + 1 MOVE)

## Configuration

### EmpireManager Settings

```typescript
{
  targetCpuPerRoom: 10,              // CPU budget per room
  minCpuBucketForExpansion: 5000,   // Minimum CPU bucket for expansion
  minRclForStability: 3              // Minimum RCL for stable room
}
```

### ColonyManager Settings

```typescript
{
  minRclForExpansion: 4,             // Minimum RCL to expand from
  maxRoomsPerShard: 10               // Maximum rooms per shard
}
```

### Expansion Criteria

**Rooms eligible for claiming:**
- Not owned by another player
- At least 1 source (changed from 2)
- No controller level or level 0
- No hostile creeps present

## Expansion Flow

### Step 1: Discovery

ScoutingProcess runs every 100 ticks:
```
For each owned room:
  - Calculate 8 adjacent room coordinates
  - If room has visibility, scout it
  - Collect: sources, minerals, ownership, threats
  - Analyze: hostile structures, creep composition
  - Calculate path distance from home
  - Store in Memory.scout
```

### Step 2: Evaluation

EmpireManager checks conditions every tick:
```
shouldExpand():
  - Check: activeRooms < gcl.level
  - Check: cpu.bucket >= 5000
  - Check: all rooms >= RCL 3
  - Return: true if all conditions met
```

### Step 3: Target Selection

EmpireManager identifies best target:
```
identifyExpansionTarget():
  - Get all scouted rooms
  - Filter: not owned, 1+ sources, no hostiles
  - Sort by path distance (closest first)
  - Return: best candidate room name
```

### Step 4: Takeover Identification (NEW)

EmpireManager identifies occupied rooms:
```
identifyTakeoverTargets():
  - Get all scouted rooms
  - Filter: owned by other players, 1+ sources
  - Calculate takeover priority based on:
    * Strategic value (source count)
    * Difficulty (RCL, threat level)
    * Defenses (towers, structures)
  - Store in Memory.takeover.targets
  - Log: takeover target identification
```

### Step 5: Request Creation

EmpireManager requests expansion:
```
initiateExpansion(targetRoom):
  - Call: colonyManager.requestExpansion()
  - Priority: 75 (high)
  - Reason: "Empire expansion"
```

### Step 6: Queue Management

ColonyManager maintains queue:
```
requestExpansion(targetRoom, reason, tick, priority):
  - Check: not already claimed
  - Check: not already queued
  - Create: ExpansionRequest
  - Insert: priority-sorted queue
  - Save: Memory.colony.expansionQueue
```

### Step 7: Claimer Spawning

BehaviorController spawns claimer:
```
spawnClaimersForExpansion():
  - Get: pending expansion requests
  - Filter: expansions without claimers
  - Sort: by priority (highest first)
  - For highest priority:
    - Generate body (CLAIM + MOVE)
    - Check energy availability
    - Spawn claimer with target room memory
    - Log: spawn confirmation
```

### Step 8: Claiming

Claimer creep executes:
```
runClaimer(creep):
  - If not in target room:
    - Find exit to target room
    - Move to exit
  - If in target room:
    - Find controller
    - Claim controller
    - Log: claim success
```

## Memory Structure

### Memory.colony

```typescript
{
  expansionQueue: [
    {
      targetRoom: "W2N1",      // Target room to claim
      priority: 75,            // Priority (higher = sooner)
      reason: "Empire expansion", // Reason for expansion
      requestedAt: 12345,      // Tick when requested
      status: "pending"        // pending|claimed|failed
    }
  ],
  claimedRooms: ["W1N1"],      // Currently claimed rooms
  shardMessages: [],           // Inter-shard messages
  lastExpansionCheck: 12345    // Last evaluation tick
}
```

### Memory.takeover (NEW)

```typescript
{
  targets: [
    {
      roomName: "W3N2",        // Occupied room
      owner: "PlayerX",         // Current owner
      controllerLevel: 4,       // RCL of room
      sourceCount: 2,           // Number of sources
      threatLevel: "medium",    // Threat assessment
      hostileStructures: {
        towers: 2,
        ramparts: 15,
        walls: 20,
        spawns: 1
      },
      hostileCreeps: {
        defenders: 3,
        healers: 1,
        totalBodyParts: {
          attack: 10,
          rangedAttack: 8,
          heal: 6,
          tough: 5,
          work: 2
        }
      },
      discoveredAt: 12345,      // When discovered
      status: "identified",     // Current status
      priority: 35,             // Takeover priority (0-100)
      strategy: undefined       // Future: attack strategy
    }
  ],
  lastUpdate: 12345
}
```

### Memory.scout

```typescript
{
  rooms: {
    "W2N1": {
      roomName: "W2N1",
      lastScouted: 12345,
      owned: false,
      sourceCount: 1,           // Now accepts 1+ sources
      sources: [
        { id: "...", x: 10, y: 20 }
      ],
      mineral: {
        type: "H",
        x: 25,
        y: 25,
        id: "..."
      },
      hasHostiles: false,
      hostileCount: 0,
      isSourceKeeper: false,
      pathDistance: 1
    }
  },
  lastUpdate: 12345,
  activeScouts: {}
}
```

### Claimer Creep Memory

```typescript
{
  role: "claimer",
  task: "claim",
  version: 1,
  targetRoom: "W2N1",         // Room to claim
  homeRoom: "W1N1"            // Spawning room
}
```

## Takeover Priority Calculation

The system calculates takeover priority (0-100) based on:

**Positive Factors:**
- Base priority: 50
- 2+ sources: +20

**Negative Factors:**
- High RCL: -5 per level
- Threat level:
  - Low: -5
  - Medium: -15
  - High: -30
  - Extreme: -50
- Defensive structures:
  - Towers: -10 per tower
  - Spawns: -5 per spawn

**Example:**
```
Room W3N2:
- Base: 50
- 2 sources: +20
- RCL 4: -20
- Medium threat: -15
- 2 towers: -20
- 1 spawn: -5
= Priority: 10 (low priority for takeover)
```

## Monitoring

### Console Commands

Check expansion status:
```javascript
// View expansion queue
Memory.colony.expansionQueue

// View takeover targets (NEW)
Memory.takeover.targets

// View scouted rooms
Memory.scout.rooms

// View active claimers
Object.values(Game.creeps).filter(c => c.memory.role === 'claimer')
```

### Log Messages

The system logs key events:
```
[ScoutManager] Scouted W2N1: 1 sources, owned=false, SK=false, hostiles=0
[EmpireManager] Initiating expansion to W2N1
[EmpireManager] 🎯 Identified takeover target: W3N2 (Owner: PlayerX, RCL: 4, Threat: medium, Priority: 35)
[ColonyManager] Queued expansion to W2N1: Empire expansion (priority: 75)
[BehaviorController] 🏴 Spawned claimer claimer-12345-0 for expansion to W2N1
```

## Troubleshooting

### Expansion Not Triggering

Check conditions:
1. **GCL Limit**: Verify `Game.gcl.level > owned rooms count`
2. **CPU Bucket**: Verify `Game.cpu.bucket >= 5000`
3. **Room Stability**: Verify all rooms are RCL 3+
4. **Scout Data**: Verify suitable rooms in `Memory.scout.rooms`
5. **Source Count**: Now accepts rooms with 1+ sources

### No Takeover Targets

Check scouting:
1. **Visibility**: Verify rooms with other players are visible
2. **Scout Data**: Check `Memory.scout.rooms` for owned rooms
3. **Takeover Memory**: Check `Memory.takeover.targets`

### No Claimer Spawning

Check queue:
1. **Expansion Queue**: Verify `Memory.colony.expansionQueue` has pending requests
2. **Existing Claimers**: Check if claimer already exists for target
3. **Energy**: Verify room has at least 650 energy for claimer
4. **Spawn Availability**: Verify spawn is not busy

### Claimer Not Claiming

Check creep:
1. **Target Room**: Verify `creep.memory.targetRoom` is set
2. **Path**: Verify path exists to target room
3. **Controller**: Verify target room has unclaimed controller
4. **Hostiles**: Verify target room is safe

## Changes in This Version

### Room Expansion Criteria Update
- **Before**: Only rooms with 2+ sources were considered for expansion
- **After**: Rooms with 1+ sources are now eligible for claiming
- **Impact**: Enables expansion to more rooms, including single-source rooms
- **Rationale**: Even single-source rooms provide strategic value and GCL progression

### Takeover Planning System (NEW)
- **Feature**: Identifies occupied rooms owned by other players
- **Analysis**: Evaluates threat level, defenses, and strategic value
- **Priority**: Calculates conquest priority (0-100) based on difficulty
- **Memory**: Stores targets in `Memory.takeover.targets`
- **Status**: Currently "identified" - future implementations will add attack strategies
- **Purpose**: Foundation for future offensive capabilities

## Future Enhancements

### Expansion System
- Remote room evaluation (mineral types, strategic value)
- Power bank targeting for GCL boost
- Automatic room abandonment if unprofitable
- Cross-shard expansion coordination
- Defensive claiming (blocking opponents)

### Takeover System (Planned)
- **Phase 1** (Current): Identify and track occupied rooms ✅
- **Phase 2**: Analyze attack requirements (creep composition, spawn timing)
- **Phase 3**: Generate conquest strategies (siege, rush, economic warfare)
- **Phase 4**: Execute takeover operations (spawn attackers, coordinate assault)
- **Phase 5**: Post-conquest stabilization (defense, rebuilding)

### Conquest Strategies (Future)
- **Siege Strategy**: Wear down defenses over time
- **Rush Strategy**: Overwhelming force for quick takeover
- **Economic Warfare**: Cut off resources and wait
- **Diplomatic Approach**: Negotiate room transfer (multi-player scenarios)

## Performance

### CPU Impact

- ScoutingProcess: ~0.5 CPU per room per 100 ticks
- EmpireManager: ~0.3 CPU per tick (with expansion + takeover checks)
- ColonyManager: ~0.1 CPU per tick
- BehaviorController: ~0.1 CPU per tick (claimer spawning)
- Total: ~1 CPU per tick average

### Memory Impact

- Scout data: ~500 bytes per room
- Expansion queue: ~200 bytes per request
- Takeover targets: ~400 bytes per target
- Claimer memory: ~100 bytes per claimer
- Total: < 15 KB for typical usage

## Related Systems

- **Scouting System**: Discovers expansion and takeover targets
- **Empire Coordination**: Manages multi-room operations
- **Behavior System**: Executes claimer behavior
- **Spawn System**: Generates claimer creeps
- **GCL System**: Determines expansion capacity
- **Defense System**: Future integration for conquest operations
