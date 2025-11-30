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

Pheromones:
- Decay over time (0.9-0.99 factor per update)
- Diffuse to neighboring rooms
- Are emitted periodically and on events (hostile detection, structure destroyed, etc.)

### Room Lifecycle

**Evolution Stages** (based on RCL):
- `seed` - RCL 1-2: Basic survival
- `growing` - RCL 3-4: Establishing economy
- `developed` - RCL 5-6: Full economy
- `fortified` - RCL 7: Defense capabilities
- `fullyOperational` - RCL 8: Maximum potential

**Postures** (based on threat and pheromones):
- `eco` - Economic focus
- `expand` - Expansion focus
- `defensive` - Light defense
- `war` - Active combat
- `siege` - Heavy combat
- `evacuate` - Retreat mode

### Role Families

**Economy:**
- `swarmHarvester` - Energy collection
- `swarmHauler` - Energy transport
- `swarmBuilder` - Construction
- `swarmUpgrader` - Controller upgrade

**Military:**
- `swarmDefender` - Room defense
- `swarmAttacker` - Offensive operations
- `swarmHealer` - Combat support
- `swarmRanger` - Ranged combat

**Utility:**
- `swarmScout` - Room exploration
- `swarmClaimer` - Room claiming
- `swarmRepairer` - Structure repair

**Power:**
- `swarmPowerHarvester` - Power bank harvesting
- `swarmPowerCarrier` - Power transport

## Usage

```typescript
import { SwarmBot } from "@ralphschuler/screeps-bot";

const bot = new SwarmBot({
  pheromoneDecayRate: 0.95,
  pheromoneDiffusionRate: 0.3,
  updateInterval: 5,
  threatEscalationThreshold: 2,
  cpuBudget: 0.8
});

export const loop = () => {
  bot.run();
};
```

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `pheromoneDecayRate` | 0.95 | Base decay rate for pheromones (0-1) |
| `pheromoneDiffusionRate` | 0.3 | Rate at which pheromones spread to neighbors (0-1) |
| `updateInterval` | 5 | Ticks between pheromone updates |
| `threatEscalationThreshold` | 2 | Threat level that triggers war posture |
| `cpuBudget` | 0.8 | Maximum CPU usage target (0-1) |

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

// Get room states
const rooms = bot.getRoomStates();

// Access managers for debugging
const pheromones = bot.getPheromoneManager();
const clusters = bot.getClusterManager();
const strategy = bot.getStrategyManager();

// Reset all state
bot.reset();
```

### PheromoneManager

Manages pheromone signals across rooms.

```typescript
// Emit event-triggered pheromone
pheromoneManager.emitEventPheromone(roomState, "defense", 20);

// Get dominant pheromone type
const dominant = pheromoneManager.getDominantPheromone(roomState.pheromones);

// Handle events
pheromoneManager.onHostileDetected(roomState, hostileCount, threatLevel);
pheromoneManager.onStructureDestroyed(roomState, STRUCTURE_SPAWN);
pheromoneManager.onNukeDetected(roomState);
```

### RoomStateManager

Manages room lifecycle and posture transitions.

```typescript
// Initialize new room
const state = roomStateManager.initializeRoom(roomName, gameRoom);

// Set posture manually
roomStateManager.setPosture(roomState, "war", "Strategic command");

// Check posture
roomStateManager.isInCombat(roomState);
roomStateManager.isEconomyFocused(roomState);
```

### ClusterManager

Manages room clusters for coordination.

```typescript
// Create cluster
const cluster = clusterManager.createCluster(coreRoom);

// Add remote/forward base
clusterManager.addRemoteRoom(clusterId, roomName);
clusterManager.addForwardBase(clusterId, roomName);

// Set specialization
clusterManager.setSpecialization(clusterId, "mineral");

// Calculate transfer needs
const transfers = clusterManager.calculateTransferNeeds(clusterId);
```

### StrategyManager

Handles empire-wide strategic decisions.

```typescript
// Add expansion target
strategyManager.addExpansionTarget(roomName, sources, distance, hasEnemy, terrain);

// Add war target
strategyManager.addWarTarget(playerName, rooms, priority);

// Escalate/de-escalate war
strategyManager.escalateWar(playerName);
strategyManager.deescalateWar(playerName);

// Get top expansion targets
const targets = strategyManager.getTopExpansionTargets(5);
```

## Multi-Shard Support

The architecture is designed to support multi-shard operation with:
- Shard roles (core, frontier, resource, backup)
- Inter-shard memory for coordination
- Portal-based colonization
- Cross-shard resource balancing

## License

MIT
