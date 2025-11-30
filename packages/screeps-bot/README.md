# @ralphschuler/screeps-bot

An ant colony-inspired swarm intelligence bot for Screeps using pheromone-based coordination.

## Overview

This bot implements emergent swarm behavior inspired by ant colonies. Instead of centralized decision-making, individual creeps respond to local pheromone signals to create coordinated colony behavior.

## Architecture

### Layers

1. **Pheromone Layer** - Room-level signals that decay over time and diffuse to neighboring rooms
2. **Room Layer** - Evolution stages and postures that determine behavior priorities
3. **Cluster Layer** - Groups of rooms that coordinate resources and defense
4. **Strategic Layer** - Empire-wide decisions for expansion and war
5. **Agent Layer** - Individual creeps using simple heuristics for task selection
6. **Multi-Shard Layer** - Cross-shard coordination via InterShardMemory

### Pheromone System

Pheromone types:
- `expand` - Indicates opportunity for expansion
- `harvest` - Energy availability signal
- `build` - Construction needs
- `upgrade` - Controller upgrade priority
- `defense` - Threat response signal
- `war` - Combat escalation
- `siege` - High-intensity combat
- `logistics` - Resource distribution needs
- `nukeTarget` - Nuke targeting priority

Pheromones:
- Decay over time (0.9-0.99 factor per update)
- Diffuse to neighboring rooms
- Are emitted periodically and on events (hostile detection, structure destroyed, etc.)

### Room Lifecycle

**Evolution Stages** (based on RCL):
- `seedColony` - RCL 1-2: Basic survival
- `earlyExpansion` - RCL 3-4: Establishing economy
- `economicMaturity` - RCL 5-6: Full economy
- `fortification` - RCL 7: Defense capabilities
- `endGame` - RCL 8: Maximum potential

**Postures** (based on threat and pheromones):
- `eco` - Economic focus
- `expand` - Expansion focus
- `defensive` - Light defense
- `war` - Active combat
- `siege` - Heavy combat
- `evacuate` - Retreat mode
- `nukePrep` - Preparing for nuclear strike

### Role Families

**Economy:**
- `larvaWorker` - Unified starter role (harvest/carry/build/upgrade)
- `harvester` - Stationary miner with container/link
- `hauler` - Transport energy/resources
- `builder` - Construction and repair
- `upgrader` - Controller upgrade
- `queenCarrier` - Energy distribution (spawns, extensions, towers)
- `mineralHarvester` - Mineral extraction
- `depositHarvester` - Highway deposit harvesting
- `labTech` - Lab operation and boosting
- `factoryWorker` - Factory operation

**Military:**
- `guard` - Melee/ranged defender
- `healer` - Combat healer
- `soldier` - Offensive melee/ranged
- `siegeUnit` - Dismantler/tank
- `harasser` - Early aggression
- `squadMember` - Coordinated squad combat

**Utility:**
- `scout` - Room exploration and intel
- `claimer` - Room claiming/reserving
- `engineer` - Repairs and rampart maintenance
- `remoteWorker` - Remote mining operations
- `terminalManager` - Market transfers

**Power:**
- `powerHarvester` - Power bank harvesting
- `powerCarrier` - Power transport
- `powerQueen` - Economy-focused PowerCreep
- `powerWarrior` - Combat-support PowerCreep

## Usage

```typescript
import { SwarmBot } from "@ralphschuler/screeps-bot";

const bot = new SwarmBot({
  enableProfiling: true,
  enableDebugLogging: false,
  pheromoneUpdateInterval: 5,
  strategicUpdateInterval: 20,
  enableVisualizations: true
});

export const loop = () => {
  bot.run();
};
```

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `enableProfiling` | `true` | Enable CPU profiling per room/subsystem |
| `enableDebugLogging` | `false` | Enable verbose debug logging |
| `pheromoneUpdateInterval` | `5` | Ticks between pheromone updates |
| `strategicUpdateInterval` | `20` | Ticks between strategic layer updates |
| `enableVisualizations` | `true` | Enable in-game visual debugging |

## API

### SwarmBot

Main bot controller class.

```typescript
// Create bot with optional config
const bot = new SwarmBot(config);

// Run every tick
bot.run();

// Get statistics
const stats = bot.getStats();
// Returns: { rooms, creeps, gcl, gpl, bucket, avgCpu, strategic, market, multiShard }

// Reset bot state
bot.reset();
```

### PheromoneManager

Manages pheromone signals across rooms.

```typescript
import { pheromoneManager } from "@ralphschuler/screeps-bot";

// Update metrics for a room
pheromoneManager.updateMetrics(room, swarmState);

// Update pheromones based on metrics
pheromoneManager.updatePheromones(swarmState, room);

// Apply diffusion across rooms
pheromoneManager.applyDiffusion(roomsMap);

// Event handlers
pheromoneManager.onHostileDetected(swarmState, hostileCount, threatLevel);
pheromoneManager.onStructureDestroyed(swarmState, STRUCTURE_SPAWN);
pheromoneManager.onNukeDetected(swarmState);
```

### MemoryManager

Manages all memory structures.

```typescript
import { memoryManager } from "@ralphschuler/screeps-bot";

// Initialize memory
memoryManager.initialize();

// Get/create swarm state for a room
const swarm = memoryManager.getOrInitSwarmState(roomName);

// Get overmind (empire-level) state
const overmind = memoryManager.getOvermind();

// Clean dead creep memory
const cleaned = memoryManager.cleanDeadCreeps();
```

### EvolutionManager & PostureManager

Manage room lifecycle and posture.

```typescript
import { evolutionManager, postureManager } from "@ralphschuler/screeps-bot";

// Update evolution stage
evolutionManager.updateEvolutionStage(swarm, room, totalOwnedRooms);

// Update posture based on pheromones and danger
postureManager.updatePosture(swarm);

// Check posture properties
postureManager.isCombatPosture(swarm.posture);
postureManager.allowsBuilding(swarm.posture);
```

### ClusterManager

Manages room clusters for coordination.

```typescript
import { runClusterManager } from "@ralphschuler/screeps-bot";

// Run cluster operations
runClusterManager(ownedRooms, swarmsMap);
```

### MarketManager

Handles market trading operations.

```typescript
import { runMarketManager, getMarketSummary } from "@ralphschuler/screeps-bot";

// Run market operations
runMarketManager(ownedRooms, swarmsMap);

// Get market summary
const summary = getMarketSummary();
// Returns: { credits, lastTrades, pendingBuys, pendingSells }
```

### StrategicLayer (Overmind)

Empire-wide strategic decisions.

```typescript
import { runStrategicLayer, getStrategicStatus } from "@ralphschuler/screeps-bot";

// Run strategic evaluation
runStrategicLayer(ownedRooms, swarmsMap);

// Get strategic status
const status = getStrategicStatus();
// Returns: { warTargets, claimQueue, nukeCandidates, overallPosture }
```

### Multi-Shard (MetaLayer)

Cross-shard coordination.

```typescript
import { runMetaLayer, getMultiShardStatus } from "@ralphschuler/screeps-bot";

// Run multi-shard operations
runMetaLayer(ownedRooms, swarmsMap);

// Get multi-shard status
const status = getMultiShardStatus();
// Returns: { currentShard, shardRole, knownShards, portalCount }
```

## Multi-Shard Support

The architecture supports multi-shard operation with:
- Shard roles (core, frontier, resource, backup)
- Inter-shard memory for coordination
- Portal-based colonization
- Cross-shard resource balancing
- Automatic shard health monitoring

## Implementation Phases

This bot is implemented in phases:

- **Phase 0**: Project skeleton & infrastructure ✓
- **Phase 1**: Memory schemas ✓
- **Phase 2**: Pheromone system ✓
- **Phase 3**: Evolution & posture ✓
- **Phase 4-5**: Utilities & blueprints ✓
- **Phase 6**: Core loop & scheduling ✓
- **Phase 7**: Creep role families ✓
- **Phase 8**: Spawn logic ✓
- **Phase 9**: Expansion & remote mining ✓
- **Phase 10**: Defense & war ✓
- **Phase 11**: Nuke system ✓
- **Phase 12**: Power creep integration ✓
- **Phase 13**: Cluster logic ✓
- **Phase 14**: Strategic layer ✓
- **Phase 15**: Multi-shard meta layer ✓
- **Phase 16**: Resilience & respawn ✓
- **Phase 17**: Configuration & tuning ✓
- **Phase 18**: Testing & visualization ✓
- **Phase 19**: Market integration ✓

## License

MIT
