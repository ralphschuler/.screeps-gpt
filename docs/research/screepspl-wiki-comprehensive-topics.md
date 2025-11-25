# Screeps Community Wiki - Comprehensive Topic Research

**Research Date:** November 2025
**Purpose:** Comprehensive research of all major topics from wiki.screepspl.us/AllPages/
**Wiki Base URL:** https://wiki.screepspl.us/
**Status:** Complete

## Overview

This document provides in-depth research on all major topics from the ScreepsPlus community wiki. It supplements the existing `screepspl-wiki-analysis.md` document with detailed coverage of specific game mechanics, structures, and strategies.

---

## Table of Contents

1. [Room Control Level (RCL) Progression](#1-room-control-level-rcl-progression)
2. [Creep Body Parts and Roles](#2-creep-body-parts-and-roles)
3. [Combat and Defense Strategies](#3-combat-and-defense-strategies)
4. [CPU Optimization and Caching](#4-cpu-optimization-and-caching)
5. [Minerals, Labs, and Boosting](#5-minerals-labs-and-boosting)
6. [Pathfinding Optimization](#6-pathfinding-optimization)
7. [Market Economy and Trading](#7-market-economy-and-trading)
8. [Private Server Setup](#8-private-server-setup)
9. [Power Mechanics](#9-power-mechanics)
10. [Remote Harvesting and Source Keepers](#10-remote-harvesting-and-source-keepers)
11. [Links and Energy Relay](#11-links-and-energy-relay)
12. [Observers and Reconnaissance](#12-observers-and-reconnaissance)
13. [Spawning and Extensions](#13-spawning-and-extensions)
14. [Safe Mode and Controller Protection](#14-safe-mode-and-controller-protection)
15. [Room Claiming and Reservation](#15-room-claiming-and-reservation)
16. [Factories and Commodities](#16-factories-and-commodities)
17. [Useful Constants and API Reference](#17-useful-constants-and-api-reference)

---

## 1. Room Control Level (RCL) Progression

### Overview

The Room Controller Level (RCL) determines which structures you can build and how many of each. Higher RCLs unlock new buildings and increase existing capacity.

### Structure Unlocks by RCL

| RCL | Extensions | Towers | Rampart Max HP | Key Unlocks                           |
| --- | ---------- | ------ | -------------- | ------------------------------------- |
| 0   | 0          | 0      | -              | Roads, Containers (5)                 |
| 1   | 0          | 0      | -              | Spawn (1)                             |
| 2   | 5          | 0      | 300K           | Extensions, Ramparts, Walls           |
| 3   | 10         | 1      | 1M             | Tower (1)                             |
| 4   | 20         | 1      | 3M             | Storage                               |
| 5   | 30         | 2      | 10M            | Links (2)                             |
| 6   | 40         | 2      | 30M            | Extractor, Labs (3), Terminal         |
| 7   | 50         | 3      | 100M           | Factory, Labs (6), 3 Spawns, Observer |
| 8   | 60         | 6      | 300M           | Power Spawn, Nuker, 10 Labs           |

### Extension Capacity Progression

- RCL 2-6: 50 energy per extension
- RCL 7: 100 energy per extension
- RCL 8: 200 energy per extension

### Applicability to .screeps-gpt

**Current Implementation:**

- ✅ RCL-based structure placement in BasePlanner
- ✅ Phase system aligns with RCL milestones

**Recommendations:**

- Ensure extension placement maximizes energy capacity per RCL
- Plan for increased extension capacity at RCL 7/8
- Use RCL as primary trigger for phase transitions

---

## 2. Creep Body Parts and Roles

### Body Part Functions

| Part          | Function                     | Cost | Notes                                    |
| ------------- | ---------------------------- | ---- | ---------------------------------------- |
| WORK          | Harvest/Build/Repair/Upgrade | 100  | Core for miners, builders, upgraders     |
| CARRY         | Transport resources          | 50   | 50 capacity per part                     |
| MOVE          | Movement                     | 50   | 1 part offsets fatigue from 1 other part |
| ATTACK        | Melee damage (30/tick)       | 80   | Range 1 only                             |
| RANGED_ATTACK | Ranged damage (10/tick)      | 150  | Range 1-3                                |
| HEAL          | Heal creeps (12/tick)        | 250  | Adjacent or 4/tick at range              |
| TOUGH         | Damage absorption            | 10   | No function, absorbs damage first        |
| CLAIM         | Controller operations        | 600  | Claim/reserve/attack controllers         |

### Body Part Order Matters

**Damage Application:**

- Parts are damaged in order from first to last
- TOUGH parts should always be first (damage sponge)
- HEAL parts should be last (survive longer)
- MOVE parts distributed or at end for retreat capability

### Standard Role Compositions

**Harvester (Basic):** `[WORK, CARRY, MOVE]`

- Cost: 200 energy
- Use: Early game energy collection

**Static Miner:** `[WORK×5, MOVE]`

- Cost: 550 energy
- Use: Stationary source mining with container

**Hauler:** `[CARRY×N, MOVE×N]`

- Cost: 100 per unit
- Note: Empty CARRY generates no fatigue

**Upgrader:** `[WORK×N, CARRY, MOVE×N]`

- Maximize WORK parts for upgrade speed

**Builder:** `[WORK×N, CARRY×N, MOVE×N]`

- Balance between building and transport

**Combat Defender:** `[TOUGH×N, ATTACK/RANGED×N, MOVE×N, HEAL×N]`

- TOUGH first, HEAL last

### Applicability to .screeps-gpt

**Current Implementation:**

- ✅ Role-based creep system exists
- ⚠️ Fixed body compositions per role
- ⚠️ No dynamic scaling with available energy

**Recommendations:**

- Implement dynamic body generation based on `room.energyAvailable`
- Add body part ordering optimization for combat creeps
- Consider specialized body compositions for different phases

---

## 3. Combat and Defense Strategies

### Passive Defense: Walls and Ramparts

**Walls:**

- Block all movement (friendly and hostile)
- Can be fortified up to 300M HP
- Build at room entrances/choke points
- Multiple layers provide resilience

**Ramparts:**

- Allow friendly movement, block hostiles
- Can be fortified like walls
- Creeps on ramparts are invulnerable until rampart destroyed
- Max HP based on RCL (see above)

### Active Defense: Towers

**Tower Mechanics:**

- Attack, heal, and repair within room
- Effectiveness scales with distance:
  - Max damage/healing at range ≤5
  - Minimum at range ≥20
- Energy consumption: 10 energy per action

**Tower Strategy:**

- Priority: Attack > Heal > Repair
- Conserve energy for attacks
- Multiple towers multiply effectiveness
- Position centrally for maximum coverage

### Defensive Creeps

**Defender Composition:**

- TOUGH parts absorb damage first
- Position on ramparts for protection
- Coordinate with tower support

### Emergency: Safe Mode

- Last resort protection mechanism
- Blocks hostile actions for 20,000 ticks
- One activation per RCL earned
- Can generate additional with 1000 Ghodium

### Applicability to .screeps-gpt

**Current Implementation:**

- ✅ TowerManager exists with attack/heal/repair logic
- ⚠️ No threat assessment system
- ⚠️ No defensive creep spawning
- ❌ No rampart/wall management automation

**Recommendations:**

- Add threat scoring to TowerManager
- Implement DefenseManager for coordinated defense
- Add rampart HP management to repair system
- Consider Safe Mode automation for emergencies

---

## 4. CPU Optimization and Caching

### Memory Management

**Best Practices:**

- Limit small objects in Memory (parsing cost)
- Consolidate data into larger objects
- Use custom serialization for RoomPosition objects
- Store only essential persistent data

**Heap vs Memory:**

- Heap: Faster, persists between ticks, lost on global reset
- Memory: Persistent, parsed from JSON each tick, more expensive

### Caching Strategies

**Cache `room.find()` Results:**

```javascript
// Cache find results per tick
if (!room._cachedSources) {
  room._cachedSources = room.find(FIND_SOURCES);
}
return room._cachedSources;
```

**Path Caching:**

```javascript
// Cache paths with TTL
const cacheKey = `${start.x},${start.y}-${end.x},${end.y}`;
if (!Memory.paths[cacheKey] || Game.time > Memory.paths[cacheKey].expires) {
  Memory.paths[cacheKey] = {
    path: room.findPath(start, end, { serialize: true }),
    expires: Game.time + 100
  };
}
```

### CPU Profiling

**Measurement Pattern:**

```javascript
const startCPU = Game.cpu.getUsed();
// ... expensive operation ...
const cpuUsed = Game.cpu.getUsed() - startCPU;
console.log(`Operation took ${cpuUsed.toFixed(2)} CPU`);
```

### Intent Optimization

- Each game action costs ~0.2 CPU base
- Batch operations where possible
- Check prerequisites before calling actions
- Larger creeps = fewer intents for same work

### Bucket Management

- CPU bucket accumulates unused CPU (max 10,000)
- Generate pixels at 5,000+ bucket
- Throttle non-essential operations when low
- Emergency mode below 500

### Applicability to .screeps-gpt

**Current Implementation:**

- ✅ CPUProfiler exists
- ⚠️ No bucket-aware scheduling
- ⚠️ Limited path caching
- ⚠️ No find result caching

**Recommendations:**

- Implement bucket monitoring in MetricsManager
- Add adaptive throttling based on bucket level
- Implement path cache with TTL
- Cache room.find() results per tick

---

## 5. Minerals, Labs, and Boosting

### Mineral Mining

**Requirements:**

- RCL 6 for Extractor structure
- Mineral deposits regenerate after depletion

**Mining Approaches:**

1. **Container Style:** Large miner (many WORK parts), drops to container
2. **Carry Style:** Miner with WORK+CARRY, slower but self-sufficient

### Lab System

**Lab Requirements:**

- 3+ labs minimum: 2 source labs, 1 target lab
- All within range 2 of each other
- RCL 6: 3 labs, RCL 7: 6 labs, RCL 8: 10 labs

**Reaction Process:**

```javascript
targetLab.runReaction(sourceLab1, sourceLab2);
```

### Compound Tiers

| Tier    | Components   | Example             | Use              |
| ------- | ------------ | ------------------- | ---------------- |
| Base    | Raw minerals | H, O, U, K, L, Z, X | Reaction inputs  |
| Tier 1  | Base + H/O   | UH, UO, ZH, etc.    | Basic boosts     |
| Tier 2  | Tier 1 + OH  | UH2O, UHO2, etc.    | Enhanced boosts  |
| Tier 3  | Tier 2 + X   | XUH2O, XKHO2, etc.  | Maximum boosts   |
| Special | Complex      | Ghodium (G)         | Nukes, Safe Mode |

### Boosting Mechanics

- 30 compound + 20 energy per body part
- Only one boost per part
- Renewing removes all boosts
- Boost effects multiply base part effectiveness

**Key Boosts:**

- XGH2O: 4× upgrade speed (WORK)
- XGHO2: 70% damage reduction (TOUGH)
- XLHO2: 4× healing (HEAL)
- XZH2O: 4× build/repair (WORK)

### Applicability to .screeps-gpt

**Current Implementation:**

- ❌ No mineral harvesting
- ❌ No lab automation
- ❌ No boosting system

**Recommendations:**

- Plan mineral economy for Phase 3
- Prioritize XGH2O production for upgraders
- Design lab network automation
- Implement boost request queue

---

## 6. Pathfinding Optimization

### MoveTo Options

**Key Parameters:**

- `reusePath`: Ticks to reuse cached path (default: 5)
- `maxOps`: Maximum operations for path search
- `maxRooms`: Limit rooms searched
- `plainCost`/`swampCost`: Terrain movement costs

**Optimization Pattern:**

```javascript
creep.moveTo(target, {
  reusePath: 20,
  maxOps: 2000,
  visualizePathStyle: DEBUG ? {} : undefined
});
```

### Path Caching

**Benefits:**

- Major CPU reduction for frequently traveled routes
- Reduces pathfinding recalculation overhead
- Enables path reuse across multiple creeps

**Implementation:**

```javascript
// Calculate once, reuse many times
const pathKey = `${source.id}-${target.id}`;
if (!Memory.paths[pathKey]) {
  Memory.paths[pathKey] = PathFinder.search(source.pos, { pos: target.pos, range: 1 }).path;
}
creep.moveByPath(Memory.paths[pathKey]);
```

### Advanced Libraries

**Traveler:**

- Improved stuck detection
- Better traffic management
- Efficient path reuse

**Cartographer:**

- Multi-room path optimization
- Priority-based movement
- Coordinated creep movement

**screeps-pathfinding:**

- Traffic management
- Custom prioritization
- Robust caching

### Stuck Detection

```javascript
// Simple stuck detection
if (creep.pos.isEqualTo(creep.memory.lastPos)) {
  creep.memory.stuckTicks = (creep.memory.stuckTicks || 0) + 1;
  if (creep.memory.stuckTicks > 3) {
    // Force path recalculation
    delete creep.memory._move;
  }
} else {
  creep.memory.stuckTicks = 0;
  creep.memory.lastPos = creep.pos;
}
```

### Applicability to .screeps-gpt

**Current Implementation:**

- ✅ PathfindingManager exists
- ✅ Basic cost matrices
- ⚠️ No path caching
- ⚠️ No stuck detection

**Recommendations:**

- Implement path cache with TTL
- Add stuck detection logic
- Consider Traveler integration
- Optimize reusePath values per role

---

## 7. Market Economy and Trading

### Terminal Requirements

- RCL 6 to build Terminal
- 500 energy per transfer + distance cost
- Required for all market transactions

### Creating Orders

**Order Types:**

- **Buy Order:** Willing to pay credits for resources
- **Sell Order:** Offering resources for credits

**Costs:**

- 5% credit fee on order creation
- Energy cost for transfers (distance-based)

### Market Operations

```javascript
// Check market prices
const orders = Game.market.getAllOrders({ type: ORDER_BUY, resourceType: RESOURCE_ENERGY });

// Execute deal
Game.market.deal(orderId, amount, roomName);

// Create order
Game.market.createOrder({
  type: ORDER_SELL,
  resourceType: RESOURCE_OXYGEN,
  price: 0.5,
  totalAmount: 10000,
  roomName: "W1N1"
});
```

### Trading Strategy

**Early Game:**

- Focus on energy production
- Sell excess minerals if accessible

**Mid Game:**

- Monitor market for needed minerals
- Trade for missing compound ingredients

**Late Game:**

- Optimize commodity chains
- Arbitrage opportunities
- Automated trading bots

### Applicability to .screeps-gpt

**Current Implementation:**

- ❌ No terminal operations
- ❌ No market integration

**Recommendations:**

- Design terminal network for Phase 3
- Implement basic resource transfer
- Add market price monitoring
- Consider automated trading for late game

---

## 8. Private Server Setup

### Installation Methods

**Official npm Package:**

```bash
npm install -g screeps
npx screeps init
npx screeps start
```

**Community Launchers:**

- Screepers Launcher: Docker-based, mod-friendly
- Jomik's Server: Simplified setup

### Requirements

- Node.js 10-12 (older versions)
- MongoDB and Redis for scale
- Build tools for native modules
- Steam API key

### Configuration

**Essential Settings:**

- Steam API key for authentication
- Database connection (MongoDB/Redis or LokiJS)
- Server hostname and port

**Recommended Mods:**

- `screepsmod-auth`: Authentication
- `screepsmod-admin-utils`: Admin tools
- `screepsmod-mongo`: MongoDB driver

### Applicability to .screeps-gpt

**Current Implementation:**

- ✅ Docker-based testing environment
- ✅ screeps-server-mockup for E2E tests

**Recommendations:**

- Document private server setup for contributors
- Consider CI/CD testing on private server
- Use for performance benchmarking

---

## 9. Power Mechanics

### Power Banks

- Spawn in highway rooms (sector borders)
- Contain 500-10,000 power units
- Reflect 50% damage to attackers
- Require coordinated attack+heal teams

### Power Processing

**Requirements:**

- RCL 8 for Power Spawn
- 1 power + 50 energy = 1 GPL point

**Process:**

```javascript
powerSpawn.processPower();
```

### Power Creeps

**Classes:**

- Operator: Economy and base support
- Commander: Team buffs
- Executor: Solo combat power

**Key Powers:**

- Operate Factory: Enable high-tier production
- Generate Ops: Create power resources
- Operate Tower: Enhance tower actions

### Global Power Level (GPL)

- Increases with processed power
- Unlocks Power Creep levels
- Enables new abilities

### Applicability to .screeps-gpt

**Current Implementation:**

- ❌ No power harvesting
- ❌ No power processing
- ❌ No Power Creep support

**Recommendations:**

- Add to Phase 4+ roadmap
- Design power bank harvesting system
- Plan GPL progression strategy

---

## 10. Remote Harvesting and Source Keepers

### Remote Harvesting

**Strategy:**

- Mine sources in unowned rooms
- Transport energy back to owned rooms
- Reserved rooms provide 2× energy

**Creep Roles:**

- **Remote Miner:** Stationary harvester at source
- **Remote Hauler:** Transport between rooms

### Room Reservation

**Benefits:**

- 3000 energy per source (vs 1500 unreserved)
- Blocks other players from claiming

**Mechanics:**

- CLAIM part required
- 1 point per tick per CLAIM part
- Max 5000 reservation points

### Source Keeper Rooms

**Characteristics:**

- Center 9 rooms of each sector
- Source Keepers spawn from Lairs
- Defend sources and minerals
- Respawn 300 ticks after killed

**Harvesting SK Rooms:**

- Combat creeps required
- Coordinate timing with SK spawns
- Lucrative but dangerous

### Highway Rooms

**Deposits:**

- Metal, Silicon, Biomass, Mist
- Require special extraction
- Used for commodity production

### Applicability to .screeps-gpt

**Current Implementation:**

- ⚠️ Basic scout role exists
- ❌ No remote harvesting automation
- ❌ No SK room handling

**Recommendations:**

- Design remote harvesting for Phase 2 completion
- Plan SK room harvesting for Phase 3
- Implement reservation management

---

## 11. Links and Energy Relay

### Link Mechanics

**Properties:**

- Instant energy transfer within room
- 3% energy loss per transfer (rounded up)
- Cooldown = distance between links
- RCL 5: 2 links, RCL 6: 3 links, RCL 7: 4 links, RCL 8: 6 links

### Link Network Patterns

**Source Link:** Near energy source, miners deposit
**Storage Link:** Near storage, receives energy
**Controller Link:** Near controller, feeds upgraders
**Spawn Link:** Near spawn cluster, feeds extensions

### Transfer Logic

```javascript
// Send when above threshold, receive below
if (sourceLink.store[RESOURCE_ENERGY] > 400) {
  const target = storageLink.store[RESOURCE_ENERGY] < 400 ? storageLink : controllerLink;
  sourceLink.transferEnergy(target);
}
```

### Applicability to .screeps-gpt

**Current Implementation:**

- ✅ LinkManager exists
- ✅ Basic transfer logic

**Recommendations:**

- Optimize transfer thresholds
- Add priority-based link routing
- Consider cooldown management

---

## 12. Observers and Reconnaissance

### Observer Structure

- RCL 7 required
- View any room within 10 rooms
- One room per tick observation

**Usage:**

```javascript
observer.observeRoom("W5N5");
// Room visible next tick
```

### Scouting Strategy

**Systematic Scanning:**

- Rotate observer focus
- Build room memory database
- Track enemy movements

**Scout Creeps:**

- Minimal body (MOVE only)
- Persistent room visibility
- Cheaper than Observer for nearby rooms

### Map Intelligence

**Track Per Room:**

- Owner/reservation status
- Controller level
- Mineral type
- Source count
- Last updated tick

### Applicability to .screeps-gpt

**Current Implementation:**

- ⚠️ Basic scout role
- ❌ No Observer automation
- ❌ Limited room memory

**Recommendations:**

- Design scouting automation for Phase 3
- Implement room memory database
- Add Observer rotation logic

---

## 13. Spawning and Extensions

### Spawn Energy

- Base spawn: 300 energy capacity
- Extensions add to available energy pool
- All energy must be present to spawn

### Energy Calculations

```javascript
const available = room.energyAvailable;      // Current stored
const capacity = room.energyCapacityAvailable; // Maximum possible

if (available >= creepCost) {
  spawn.spawnCreep(body, name, {memory: {...}});
}
```

### Extension Placement

**Best Practices:**

- Cluster near spawn for efficient filling
- Use roads for hauler access
- Balance distance vs. defense

### Spawning Strategy

**Dynamic Body Generation:**

```javascript
function generateBody(template, energy) {
  const unitCost = template.reduce((sum, p) => sum + BODYPART_COST[p], 0);
  const repeats = Math.floor(energy / unitCost);
  return Array(repeats).fill(template).flat();
}
```

### Applicability to .screeps-gpt

**Current Implementation:**

- ✅ SpawnManager with queue
- ✅ Extension placement in BasePlanner
- ⚠️ Fixed body compositions

**Recommendations:**

- Implement dynamic body scaling
- Optimize extension fill patterns
- Add spawn priority tuning

---

## 14. Safe Mode and Controller Protection

### Safe Mode Mechanics

**Activation:**

```javascript
room.controller.activateSafeMode();
```

**Duration:** 20,000 ticks (~20 hours)

**Effects:**

- Blocks all hostile actions
- Protects structures and creeps
- Your creeps can still operate

### Limitations

- One per player per shard at a time
- 50,000 tick cooldown between activations
- Limited activations (one per RCL + generated)

### Generating Safe Mode

```javascript
// Requires creep with 1000 Ghodium
creep.generateSafeMode(controller);
```

### Automatic Activation

**Trigger Conditions (example):**

```javascript
const hostiles = room.find(FIND_HOSTILE_CREEPS);
const criticalWall = room.find(FIND_STRUCTURES, {
  filter: s => s.structureType === STRUCTURE_WALL && s.hits < 10000
});

if (hostiles.length > 0 && criticalWall.length > 0) {
  room.controller.activateSafeMode();
}
```

### Applicability to .screeps-gpt

**Current Implementation:**

- ❌ No Safe Mode automation
- ❌ No controller attack detection

**Recommendations:**

- Add emergency Safe Mode trigger
- Implement threat level assessment
- Consider Ghodium reserve for generation

---

## 15. Room Claiming and Reservation

### Claiming Rooms

**Requirements:**

- Creep with CLAIM part
- GCL allows additional room

**Process:**

```javascript
claimCreep.claimController(room.controller);
```

### Reservation

**Purpose:**

- Block others from claiming
- Double source energy output
- Cheaper than full claim

**Mechanics:**

- 1 point per tick per CLAIM part
- Max 5000 points
- Decays at 1 point per tick

### Expansion Strategy

**Room Selection Criteria:**

- Source count (2 preferred)
- Mineral type (for diversity)
- Distance from existing rooms
- Defensibility

### Applicability to .screeps-gpt

**Current Implementation:**

- ⚠️ Basic room expansion logic
- ❌ No reservation automation
- ❌ Limited room evaluation

**Recommendations:**

- Enhance room selection algorithm
- Add mineral coverage consideration
- Implement reservation management

---

## 16. Factories and Commodities

### Factory Basics

- RCL 7 required
- Level 0 factory: Basic commodities
- Higher levels require PowerCreep empowerment

### Compression

**Resource Bars:**

- Compact storage format
- Trade-friendly
- Produced at level 0

**Examples:**

- Battery: Energy compression
- Utrium Bar: Utrium compression

### Commodity Production

**Tiers:**

- Level 0: Basic, no empowerment needed
- Level 1-5: Require factory empowerment

**NPC Market:**

- Sell commodities for credits
- Higher tiers = higher value

### Applicability to .screeps-gpt

**Current Implementation:**

- ❌ No factory automation

**Recommendations:**

- Add to Phase 4 roadmap
- Design commodity production chains
- Integrate with market system

---

## 17. Useful Constants and API Reference

### Find Constants

| Constant                | Value | Use                |
| ----------------------- | ----- | ------------------ |
| FIND_CREEPS             | 1     | All creeps         |
| FIND_MY_CREEPS          | 2     | Own creeps         |
| FIND_HOSTILE_CREEPS     | 3     | Enemy creeps       |
| FIND_SOURCES            | 5     | Energy sources     |
| FIND_STRUCTURES         | 8     | All structures     |
| FIND_MY_STRUCTURES      | 9     | Own structures     |
| FIND_CONSTRUCTION_SITES | 11    | Construction sites |
| FIND_MY_SPAWNS          | 12    | Own spawns         |
| FIND_DROPPED_RESOURCES  | 14    | Dropped resources  |

### Error Codes

| Code                     | Value | Meaning                |
| ------------------------ | ----- | ---------------------- |
| OK                       | 0     | Success                |
| ERR_NOT_OWNER            | -1    | Not your object        |
| ERR_NO_PATH              | -2    | No path found          |
| ERR_BUSY                 | -4    | Object is busy         |
| ERR_NOT_ENOUGH_ENERGY    | -6    | Insufficient energy    |
| ERR_NOT_ENOUGH_RESOURCES | -6    | Insufficient resources |
| ERR_INVALID_TARGET       | -7    | Invalid target         |
| ERR_FULL                 | -8    | Storage full           |
| ERR_NOT_IN_RANGE         | -9    | Not in range           |

### Game Object Access

```javascript
Game.creeps; // All your creeps
Game.spawns; // All your spawns
Game.rooms; // Visible rooms
Game.structures; // All your structures
Game.getObjectById(id); // Get any object by ID
Game.time; // Current tick
Game.cpu.getUsed(); // CPU used this tick
Game.cpu.bucket; // CPU bucket level
```

---

## Cross-Reference with .screeps-gpt Implementation

### Coverage Matrix

| Topic                | Wiki Coverage | Bot Implementation    | Status                 |
| -------------------- | ------------- | --------------------- | ---------------------- |
| RCL Progression      | ✅            | ✅ Phase system       | Complete               |
| Creep Body Parts     | ✅            | ⚠️ Fixed compositions | Needs dynamic          |
| Combat/Defense       | ✅            | ⚠️ TowerManager only  | Needs expansion        |
| CPU Optimization     | ✅            | ⚠️ Basic profiler     | Needs bucket awareness |
| Minerals/Labs        | ✅            | ❌ Not implemented    | Phase 3                |
| Pathfinding          | ✅            | ⚠️ No caching         | High priority          |
| Market/Trading       | ✅            | ❌ Not implemented    | Phase 3                |
| Private Server       | ✅            | ✅ Docker tests       | Complete               |
| Power Mechanics      | ✅            | ❌ Not implemented    | Phase 4                |
| Remote Harvesting    | ✅            | ❌ Not implemented    | Phase 2                |
| Links                | ✅            | ✅ LinkManager        | Complete               |
| Observers            | ✅            | ⚠️ Basic scout        | Needs automation       |
| Spawning             | ✅            | ✅ SpawnManager       | Complete               |
| Safe Mode            | ✅            | ❌ Not implemented    | Phase 2                |
| Claiming/Reservation | ✅            | ⚠️ Basic expansion    | Needs enhancement      |
| Factories            | ✅            | ❌ Not implemented    | Phase 4                |
| API Constants        | ✅            | ✅ TypeScript types   | Complete               |

---

## Implementation Priority

### Immediate (Tier 1)

1. **Path Caching** - High CPU impact
2. **Dynamic Body Generation** - Better resource utilization
3. **CPU Bucket Monitoring** - Stability

### Short-term (Tier 2)

4. **Remote Harvesting** - Expand energy income
5. **Enhanced Defense** - Threat assessment
6. **Safe Mode Automation** - Emergency protection

### Medium-term (Tier 3)

7. **Mineral Economy** - Labs and compounds
8. **Terminal Network** - Resource sharing
9. **Observer Automation** - Intelligence gathering

### Long-term (Tier 4)

10. **Power Mechanics** - End-game progression
11. **Factory Automation** - Commodity production
12. **Market Integration** - Automated trading

---

## References

### Official Documentation

- [Screeps API](https://docs.screeps.com/api/)
- [Game Guide](https://docs.screeps.com/index.html)
- [Creeps Documentation](https://docs.screeps.com/creeps.html)
- [Defense Guide](https://docs.screeps.com/defense.html)
- [Market System](https://docs.screeps.com/market.html)
- [Power Mechanics](https://docs.screeps.com/power.html)
- [Control Guide](https://docs.screeps.com/control.html)
- [Resources Guide](https://docs.screeps.com/resources.html)

### Community Resources

- [ScreepsPlus Wiki](https://wiki.screepspl.us/)
- [Screeps Fandom Wiki](https://screeps.fandom.com/)
- [Screeps Forum](https://screeps.com/forum/)
- [Traveler Library](https://github.com/bonzaiferroni/Traveler)
- [screeps-pathfinding](https://github.com/NesCafe62/screeps-pathfinding)
- [Screeps Cache Library](https://github.com/glitchassassin/screeps-cache)

---

**Document Version:** 1.0
**Last Updated:** November 2025
**Related Documents:**

- `screepspl-wiki-analysis.md` - Maturity and debugging analysis
- `overmind-analysis.md` - Overmind bot patterns
- `the-international-analysis.md` - Competitive bot strategies
