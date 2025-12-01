## Phase 0 – Project Skeleton & Infrastructure

- [x] Set up repository structure
  - [x] `src/core/` (core loop, schedulers, logging)
  - [x] `src/memory/` (global, cluster, room, pheromones, metrics)
  - [x] `src/roles/` (economy, military, utility, power)
  - [x] `src/logic/` (evolution, expansion, war, nukes, power, cluster/empire)
  - [x] `src/layouts/` (base blueprints)
  - [x] `src/utils/` (weighted selection, caching, math helpers)
  - [x] `src/intershard/` (multi-shard meta, InterShardMemory)

- [x] Configure TypeScript / bundler for Screeps
  - [x] TS config (target ES5, no DOM, Screeps typings)
  - [x] Set up Screeps typings and Game globals

- [x] Implement logging & debug helpers
  - [x] `logger.ts` with log levels (debug/info/warn/error)
  - [x] Optional CPU logging wrapper (per room / per subsystem)

- [x] Implement simple performance profiler
  - [x] Measure per-room loop cost
  - [x] Measure global/strategic loop cost
  - [x] Store rolling averages in Memory for tuning

---

## Phase 1 – Data Models & Memory Schemas

- [x] Define TypeScript types/interfaces for all memory structures

### 1.1 Global / Empire Memory

- [x] `Memory.overmind` schema:
  - [x] `roomsSeen: { [roomName: string]: number /* lastSeenGameTime */ }`
  - [x] `claimQueue: string[]` or structured entries with expand score
  - [x] `warTargets: string[]`
  - [x] `nukeCandidates: string[]` or structured objects with scores
  - [x] `lastRun: number`

- [x] Global state (non-overmind)
  - [x] List of owned rooms with roles (capital/core/remoteHub/forwardBase/etc.)
  - [x] Known rooms with basic intel (sources, controller, owner/reserver, threat indicators)
  - [x] Power bank locations & timers (optional)
  - [x] Global strategic objectives (e.g. “increase power level”, “expand to N rooms”)

### 1.2 Cluster / Colony State

- [x] Define “cluster” abstraction:
  - [x] Cluster ID per group of rooms (Core + adjacents + remotes + forward bases)
  - [x] Cluster memory:
    - [x] member rooms
    - [x] role (economic hub, war cluster, mixed)
    - [x] aggregated metrics (total energy income, surplus/deficit, war index, commodity index)
    - [x] active squads, rally points
    - [x] trade preferences and stock targets

- [x] Link rooms to cluster in RoomMemory

### 1.3 RoomMemory / Swarm State

- [x] `RoomMemory.swarm` schema:
  - [x] `colonyLevel` / evolution stage (1–5 or enum)
  - [x] `intent` / posture (eco/expand/defense/war/nukePrep/siege/evacuate)
  - [x] `danger` / threat level (0–3)
  - [x] `pheromones` object with fixed numeric fields:
    - [x] `expand`
    - [x] `harvest`
    - [x] `build`
    - [x] `upgrade`
    - [x] `defense`
    - [x] `war`
    - [x] `siege`
    - [x] `logistics`
    - [x] (optional) `nukeTarget` weight

  - [x] `ttl` / `nextUpdateTick` to avoid per-tick recompute
  - [x] `eventLog: Array<[type: string, time: number]>` (FIFO max length 20)
  - [x] Structural flags: missing spawn, storage, terminal, labs, nuker, factory, extractor, power spawn, observer, etc.
  - [x] Room role (capital, secondary core, remote mining, forward base, SK outpost)
  - [x] Remote assignments (which remote rooms this room manages)

### 1.4 Creep / Squad State

- [x] Define lightweight `CreepMemory` schema:
  - [x] `role`
  - [x] `family` (economy/military/utility/power)
  - [x] `homeRoom`
  - [x] `targetRoom?`
  - [x] `task?` (short string or small enum)
  - [x] Minimal local state (e.g. `sourceId`, `targetId`)

- [x] Define `SquadMemory` (for war squads):
  - [x] squad type (harass/raid/siege/defense)
  - [x] member creep IDs
  - [x] rally room/flag
  - [x] target room(s)
  - [x] state (gathering/moving/attacking/retreating/dissolving)

---

## Phase 2 – Pheromone System & Metrics

- [x] Implement `pheromone.ts` module

### 2.1 Metrics Collection

- [x] Per room, track rolling metrics:
  - [x] Average energy harvested (per N ticks)
  - [x] Energy spent on:
    - [x] spawning
    - [x] construction
    - [x] repair
    - [x] towers

  - [x] Controller progress rate
  - [x] Idle worker time / idle larva count
  - [x] Recent hostile creep count, damage per tick
  - [x] Remote performance (energy from remotes vs. losses)

- [x] Implement rolling averages (e.g. exponential moving average or window)

### 2.2 Periodic Pheromone Updates

- [x] Implement periodic update loop (every 5–10 ticks per room):
  - [x] Compute contributions to:
    - [x] `harvest`, `build`, `upgrade`, `logistics` from economic metrics
    - [x] `defense`, `war`, `siege` from threat metrics
    - [x] `expand` from energy surplus and stable economy

  - [x] Apply exponential decay factor (0.9–0.99) to each pheromone before new contributions
  - [x] Clamp values to sane min/max

### 2.3 Event-Driven Updates

- [x] Hook event-style updates:
  - [x] On hostile detected → increase `danger`, `defense`, `war`
  - [x] On structure destroyed (esp. spawn/tower/storage) → bump `danger`, `siege`
  - [x] On nuke detected → set `danger` to 3, raise `siege`
  - [x] On remote source lost repeatedly → reduce `expand` or mark remote as unstable

- [x] Log key events in `RoomMemory.swarm.eventLog` (respect FIFO limit 20)

### 2.4 Pheromone Diffusion

- [x] Implement limited diffusion across neighboring owned/reserved rooms:
  - [x] Spread fraction of `defense`, `war`, `expand`, `danger` to neighbors
  - [x] Distance weighting (near rooms get more)
  - [x] Ensure diffusion respects CPU budget (only a few neighbors per tick)

---

## Phase 3 – Evolution Stages & Room Posture

- [x] Implement `evolution.ts` module

### 3.1 Evolution Stages (Colony Levels)

- [x] Define evolution levels / stages:
  - [x] Seed Colony
  - [x] Early Multi-Room Expansion
  - [x] Economic Maturity
  - [x] Fortification & War Readiness
  - [x] End-Game & Dominance

- [x] Encode triggers:
  - [x] Based on RCLs per room
  - [x] Number of rooms, GCL, energy surplus
  - [x] First hostile/nuke detection, infrastructure milestones (storage, labs, nuker, power spawn, factory)

- [x] Assign `RoomMemory.swarm.colonyLevel` based on room & cluster state

### 3.2 Posture States

- [x] Define posture enum:
  - [x] `eco`, `expand`, `defensive`, `war`, `siege`, `evacuate`, `nukePrep`

- [x] Implement transition rules:
  - [x] Use pheromones (`defense`, `war`, `expand`), `danger`, and strategic overrides
  - [x] Example:
    - [x] `danger >= 2` → at least `defensive`
    - [x] `danger >= 3` → `siege`
    - [x] High `expand` and stable economy → `expand`

- [x] Map each posture to:
  - [x] spawn role weights profile
  - [x] resource allocation priorities
  - [x] special rules (e.g. `evacuate` suppresses non-essential building)

---

## Phase 4 – Weighted Selection & Utility Library

- [x] Implement `weightedSelection.ts`
  - [x] Generic roulette selection from `{key, weight}` arrays
  - [x] Handle zero/negative weights safely

- [x] Use weighted selection library for:
  - [x] Spawn decisions
  - [x] Task target selection (sources, constructions, repair targets)
  - [x] Nuke target selection
  - [x] Squad target prioritization where applicable

---

## Phase 5 – Base Blueprints & Construction Logic

- [x] Implement `blueprints.ts` module

### 5.1 Blueprint Data

- [x] Define coordinate arrays for:
  - [x] Early Colony Layout (RCL 1–2)
    - [x] central spawn
    - [x] first extension ring (10)
    - [x] container(s) near sources
    - [x] minimal roads (spawn↔sources)

  - [x] Core Colony Layout (RCL 3–4)
    - [x] 30–40 extensions in 2 rings
    - [x] storage + terminal cluster
    - [x] 3 towers in good coverage
    - [x] reserved spots for labs (3-lab reaction cluster), factory (RCL 7), extractor (RCL 6), power spawn (RCL 8)

  - [x] War/Nuke Ready Layout (RCL 5–8)
    - [x] 60+ extensions
    - [x] 6–8 towers
    - [x] observer spot
    - [x] nuker + power spawn positions
    - [x] lab “cross” formation / multiple reaction clusters
    - [x] factory logistics paths (to storage/terminal)
    - [x] planned rampart coverage

### 5.2 Construction Planner

- [x] Implement blueprint selection per room based on `colonyLevel` and RCL
- [x] Implement construction placement function:
  - [x] Iterate positions and place construction sites if missing
  - [x] Respect global site limits and CPU throttling
  - [x] Avoid dynamic planning; use only pre-computed coordinates

---

## Phase 6 – Core Room Loop, CPU Scheduling & Bucket Modes

- [x] Implement per-room loop `roomNode.ts`:
  - [x] Read / initialize RoomMemory.swarm
  - [x] Update metrics and pheromones (scheduled)
  - [x] Determine evolution stage and posture
  - [x] Run spawn logic
  - [x] Run creep role logic (delegation)
  - [x] Run towers & structure control (repair, attack, heal)
  - [x] Run base construction via blueprints
  - [x] Run resource processing hooks (labs, factory, terminal, power spawn) when available

- [x] Implement global scheduler for:
  - [x] High-frequency tasks (every tick): room loops, creep behaviors
  - [x] Medium-frequency tasks: pheromone updates, cluster logic (~every 5–10 ticks)
  - [x] Low-frequency tasks: strategic decisions, nuke scoring (~every 20–50 ticks)

- [x] Implement bucket-based modes:
  - [x] Normal mode
  - [x] Low-bucket mode (skip or downscale expensive tasks/logging, lab/factory throttling)
  - [x] High-bucket mode (extra scanning / intel gathering / factory runs)

---

## Phase 7 – Creep Role Families & Behaviors

Create modules under `src/roles/`:

### 7.1 Economy Roles

- [x] `LarvaWorker` (harvest/carry/build/upgrade unified starter role)
  - [x] Behavior to prioritize tasks based on room needs:
    - [x] harvest → deliver → build → upgrade

- [x] `Harvester` (stationary miner with container/link for energy sources)
- [x] `Hauler` (transport energy/resources)
- [x] `BuilderAnt`
- [x] `Upgrader`
- [x] `QueenCarrier` / Distributor (managing key energy flow between storage, spawns, extensions, towers)
- [x] `MineralHarvester`
  - [x] Harvest minerals with extractor, respect depletion, deliver to storage/terminal

- [x] `DepositHarvester`
  - [x] Harvest deposits in highway rooms with cooldown/ROI checks, return hauls to terminal/factory

- [x] `LabTech`
  - [x] Maintain reagent labs, collect products, keep energy topped

- [x] `FactoryWorker` / `FactoryOperator`
  - [x] Feed factory inputs and trigger basic commodity production

### 7.2 Scouting & Claiming

- [x] `ScoutAnt`
  - [x] Explore rooms, record intel in Memory.overmind.roomsSeen
  - [x] Evaluate expansion candidates (sources, mineral type, deposits nearby, safety, distance)

- [x] `ClaimAnt`
  - [x] Claim or reserve controllers based on strategic orders and posture

### 7.3 Defense & Military (Home Defense)

- [x] `GuardAnt` (melee / ranged defenders)
- [x] `HealerAnt`
- [x] Tower control loop (possibly `defenseLogic.ts`):
  - [x] Target priority: Nukes (if applicable) > Healers > Ranged > Claimers > Workers
  - [x] Balance between attack/repair/heal depending on posture and danger

### 7.4 Offensive War Roles

- [x] `SoldierAnt` (melee/range, raid and siege variants)
- [x] `SiegeUnit` (tough/heal or dismantlers)
- [x] Harass units for early aggression
- [x] Squad coordination:
  - [x] Rally, attack, retreat states
  - [x] Tie to `SquadMemory` and war targets

### 7.5 Utility & Support

- [x] `Engineer` (repairs, rampart maintenance)
- [x] `RemoteWorker` / Forager for remote mining
- [x] `LinkManager` (if used)
- [x] `TerminalManager` (handles room-level market transfers and inter-room resources)

### 7.6 Power Creeps

- [x] `PowerQueen` (economy-focused Operator)
- [x] `PowerWarrior` (combat-support power creep)
- [x] Implement power creep routing:
  - [x] home room
  - [x] ability usage schedule (not every tick)
  - [x] triggers based on economy / war needs / commodity production stage

---

## Phase 8 – Spawn Logic & Task Assignment

- [x] Implement central spawn manager per room:
  - [x] Derive role weight table from:
    - [x] evolution stage
    - [x] posture
    - [x] pheromones
    - [x] cluster needs (e.g. remote shortage, mineral deficit, commodity goals)

  - [x] Use weighted selection for next role to spawn

- [x] Define body templates per role, varying by room energy capacity & stage
- [x] Implement simple task assignment heuristics:
  - [x] Harvesters → nearest free source / assigned source
  - [x] MineralHarvesters → assigned mineral with Extractor built
  - [x] DepositHarvesters → deposits with good ROI (distance, cooldown, remaining time)
  - [x] Haulers → choose best source/target pair (storage, spawns, extensions, towers, terminals, factories)
  - [x] Builders → choose highest-priority construction sites
  - [x] Upgraders → fallback when no build / repair

---

## Phase 9 – Expansion Logic, Remote Mining & Resource Access

- [x] Implement `expansionLogic.ts`

### 9.1 Room Scoring & Claim Queue

- [x] Use scout intel to score rooms:
  - [x] number of energy sources
  - [x] mineral type and amount
  - [x] nearby highway access & deposit density
  - [x] distance from core
  - [x] terrain complexity
  - [x] hostile presence

- [x] Maintain `Memory.overmind.claimQueue` sorted by expand value
- [x] Integrate with `RoomMemory.swarm.pheromones.expand`

### 9.2 Claim / Reserve Flow

- [x] Decide when to:
  - [x] reserve room
  - [x] full claim room

- [x] Trigger claim operations when:
  - [x] economy is stable (defined thresholds)
  - [x] CPU bucket allows

- [x] After claim:
  - [x] assign room to cluster
  - [x] apply early colony blueprint
  - [x] start remote mining or full development

### 9.3 Remote Mining System

- [x] Identify remote energy sources and controlling room
- [x] Spawn remote miners/haulers
- [x] Build minimal infrastructure (roads, containers)
- [x] Track performance and losses:
  - [x] adjust `expand` and remote assignment if remotes become unprofitable or dangerous

### 9.4 Mineral Harvesting & Lab Integration (per Resources guide)

- [x] Implement mineral lifecycle:
  - [x] Detect Mineral objects and their type per room
  - [x] Build Extractor on mineral spot at RCL 6
  - [x] Respect mineral cooldown and regeneration timings

- [x] Implement basic lab network:
  - [x] 3-lab reaction cluster (2 reagents + 1 product) within range 2
  - [x] API to run reactions and keep products flowing

- [x] Boost management:
  - [x] Define per-role boost preferences and allow boost requests when resources are present

### 9.5 Deposit Harvesting & Factory Input

- [x] Implement scanning for Deposit objects in highway rooms (via scouts / observers)
- [x] For each deposit:
  - [x] track type (Metal, Silicon, Biomass, Mist)
  - [x] track cooldown and remaining ticks to decay
  - [x] estimate profitability vs. travel time and cooldown

- [x] Implement deposit operation:
  - [x] spawn DepositHarvesters + haulers
  - [x] throttle or stop when cooldown too high or deposit near despawn
  - [x] feed deposit resources into factories/terminals for compression or sale

---

## Phase 10 – Defense, Threat Metrics & War Escalation

- [x] Implement `defenseLogic.ts` and `warEconomy.ts`

### 10.1 Threat Metrics

- [x] Compute per-room threat level 0–3 from:
  - [x] hostile creep count
  - [x] total hostile damage
  - [x] presence of enemy structures
  - [x] repeated attacks

- [x] Map to `RoomMemory.swarm.danger`

### 10.2 War Economy Escalation

- [x] Define thresholds:
  - [x] `danger >= 2` → defense posture
  - [x] `danger >= 3` → war/siege posture

- [x] Additional condition:
  - [x] War weight increases only when economy stable (e.g. energy income > 120% consumption)

- [x] Adjust spawn weights:
  - [x] more defenders / healers / guards
  - [x] offensive squads when war posture sustained and economy allows

- [x] Implement global war targets list and cluster-level coordination of attack squads
- [x] Integrate boosts: during sustained war, prioritize production of combat boosts and use boosting pipeline

---

## Phase 11 – Nuke System (Detection, Scoring, Execution)

- [x] Implement `nukeScoringEngine.ts`

### 11.1 Nuke Detection & Defense

- [x] Observer logic to detect incoming nukes
- [x] On detection:
  - [x] raise `danger` and `siege` for room
  - [x] add event to eventLog
  - [x] trigger defensive behaviors:
    - [x] rampart strengthening
    - [x] resource evacuation from blast zone
    - [x] re-prioritize repairs

### 11.2 Nuke Scoring & Target Selection

- [x] Implement scoring formula (configurable):

```
nukeScore = enemyRCL * 2
           + hostileStructuresWeight * 3
           + warPheromone * 1.5
           - distanceFactor;
```

- [x] Allow constants to be tunable in config
- [x] Evaluate candidate enemy rooms infrequently (e.g. every 200–500 ticks)
- [x] Maintain `Memory.overmind.nukeCandidates` with scores

### 11.3 Nuke Execution

- [x] Nuke launch preconditions:
  - [x] enemy RCL ≥ 5
  - [x] Threat ≥ defined threshold
  - [x] Score > configured threshold (e.g. 35)

- [x] Nuke fueling logic:
  - [x] ensure nuker built and loaded with energy/ghodium

- [x] Coordinate nukes with war doctrine:
  - [x] align siege operations with nuke impact time
  - [x] plan attack windows

---

## Phase 12 – Power Creep Integration (Power Resource)

- [x] Implement `powerCreepManager.ts`

### 12.1 Power Goals & Roles

- [x] Define global power goals:
  - [x] Mine power from Power Banks when profitable
  - [x] Process power in RCL 8 rooms using PowerSpawn.processPower to increase GPL
  - [x] Use GPL to unlock/level Power Creeps and their powers

- [x] Assign roles:
  - [x] Economy `PowerQueen`
  - [x] Combat `PowerWarrior`

### 12.2 Stationing & Scheduling

- [x] Home room + secondary rooms per power creep
- [x] Ability usage:
  - [x] triggered by room posture and metrics
  - [x] only every N ticks to save CPU
  - [x] implement benefit > cost heuristics (especially for OPERATE_FACTORY on commodity chains)

---

## Phase 13 – Cluster Logic & Inter-Room Logistics

- [x] Implement `clusterLogic.ts` and `logistics.ts`

### 13.1 Cluster Formation

- [x] Algorithm to group rooms into clusters:
  - [x] adjacency and shared routes
  - [x] classification (capital/core, secondary, remotes, forward)

- [x] Maintain cluster membership in Memory

### 13.2 Resource Balancing

- [x] Per cluster:
  - [x] compute energy/mineral/commodity surpluses/deficits
  - [x] schedule terminal transfers (energy, boosts, bar-compressed minerals, commodities)
  - [x] optionally spawn inter-room haulers

### 13.3 Cluster Defense & Offense

- [x] Coordinate:
  - [x] cross-room defenders (send troops to neighbor under attack)
  - [x] offensive squads across multiple rooms

- [x] Link with war targets and war posture

---

## Phase 14 – Strategic Layer (Per Shard)

- [x] Implement `overmind.ts` (strategic layer for a shard)

### 14.1 Expansion Strategy

- [x] Periodic evaluation of all known rooms:
  - [x] compute expansion scores

- [x] Decide when to:
  - [x] expand into new rooms
  - [x] hold and consolidate

- [x] Manage `claimQueue` and assign claim/remote operations

### 14.2 War Strategy

- [x] Track players and relationships per shard
- [x] Mark global/local enemies
- [x] Set shard-level war posture when needed:
  - [x] instruct clusters to attack/defend specific targets
  - [x] allocate economic support (e.g. from economic clusters, commodity producers)

### 14.3 Nuke Strategy (Shard Level)

- [x] Aggregate room-level nuke scores
- [x] Choose limited set of nuke targets
- [x] Coordinate fueling and launch

---

## Phase 15 – Multi-Shard Meta Layer & InterShardMemory

- [x] Implement `intershard/metaLayer.ts` and `intershard/schema.ts`

### 15.1 InterShardMemory Schema

- [x] Define compact structure:
  - [x] List of shards with:
    - [x] role (Core, Frontier, Resource, Backup)
    - [x] health metrics (CPU category, economy index, war index, commodity index)
    - [x] active inter-shard tasks
    - [x] portal graph information

  - [x] Global strategic targets (e.g. power level target, main war shard)
  - [x] Implement serialization/deserialization with minimal string size

### 15.2 Meta-Layer Logic

- [x] Regular evaluation of shards:
  - [x] compute shard health ranking
  - [x] assign roles (Economic, War, Power, Backup, Frontier)

- [x] High-level objectives per shard:
  - [x] e.g. “Shard A aggressive”, “Shard B eco backbone / commodity hub”

### 15.3 Portal Handling & Colonization

- [x] Detect and record inter-shard portals
- [x] Build portal graph with:
  - [x] target shard
  - [x] threat rating
  - [x] distance approx

- [x] Implement colonization flow:
  - [x] Reconnaissance (scouting target shard)
  - [x] Site selection (room scoring, mineral/deposit access)
  - [x] Pioneer phase (first spawn)
  - [x] Stabilization and integration

### 15.4 Multi-Shard Risk & CPU Management

- [x] Distribute CPU effort based on shard roles and health
- [x] Avoid single points of failure:
  - [x] multiple RCL8 cores across shards

- [x] Implement multi-shard respawn strategy:
  - [x] when shard wiped, meta-layer updates status and shifts focus

---

## Phase 16 – Resilience, Respawn & Long-Term Survival

- [x] Implement redundancy strategies:
  - [x] multiple core rooms and clusters
  - [x] fallback rooms when main capital lost

- [x] Persist critical intel:
  - [x] enemy data
  - [x] map of good expansion targets (including mineral mix and deposit access)

- [x] Implement respawn logic:
  - [x] choose respawn location with low hostile density
  - [x] prioritize rooms with good resource mix (sources + useful minerals + highways)
  - [x] aggressive expansion behavior after respawn, based on previous heuristics

---

## Phase 17 – Configuration & Tuning

- [x] Implement central config module (constants & preferences):
  - [x] pheromone scaling factors & decay
  - [x] thresholds for:
    - [x] war escalation
    - [x] nuke usage
    - [x] evacuation/siege modes

  - [x] CPU budgets per subsystem
  - [x] expansion aggressiveness parameters
  - [x] boost usage rules (which boosts allowed, per stage/posture)
  - [x] mineral/commodity chains to support (which tiers, which chains)
  - [x] market risk limits (max spend, min sell price, credit floor)

- [x] Provide mechanism to tweak config without massive refactor (e.g. single JSON/TS config)

---

## Phase 18 – Testing, Visualization & Iteration

- [x] Implement performance test suite:
  - [x] verify average room loop ≤ 0.1 ms (peace)
  - [x] ≤ 0.25–0.3 ms (defense/war)
  - [x] global overmind ≤ 1–1.5 ms when it runs

- [x] Add in-game visual debugging:
  - [x] show evolution stage, posture, and key pheromone values per room (e.g. on `RoomVisual`)
  - [x] mark war targets, nuke candidates, expansion targets
  - [x] visualize resource system: mineral stock, reactions, factory status

- [x] Logging / debug dashboards:
  - [x] print cluster summaries to console on demand (economy, war, commodities, credits)

- [x] Create tuning workflow:
  - [x] start conservative (eco-heavy, low aggression)
  - [x] adjust war/expand thresholds based on observed behavior
  - [x] adjust boost / commodity chains according to market profitability

- [x] Add unit-style tests where feasible (pure functions, scoring, selection, pheromone updates, reaction planning, trade evaluation)

---

## Phase 19 – Market Integration & Resource Trade

- [x] Implement `marketManager.ts` and supporting utilities

### 19.1 Market Data & Memory Schema

- [x] Extend global/cluster memory with market state:
  - [x] `Memory.overmind.market`:
    - [x] `lastScan: number`
    - [x] `buyOrders: { resourceType: ResourceConstant; maxPrice: number; minAmount: number }[]`
    - [x] `sellOrders: { resourceType: ResourceConstant; minPrice: number; minAmount: number }[]`
    - [x] `cooldowns: { [resourceType: string]: number /* next allowed trade tick */ }`

  - [x] Cluster-level trade preferences:
    - [x] target stock ranges per resource (energy, minerals, boosts, commodities, power)
    - [x] `importDemand` / `exportSurplus` flags per resource

### 19.2 Market Scanning & Pricing Logic

- [x] Implement periodic market scan (low-frequency, e.g. every 100–500 ticks):
  - [x] Pull relevant `Game.market` orders for resources of interest
  - [x] Cache best buy/sell prices per resource (simple aggregates)

- [x] Implement pricing heuristics:
  - [x] Acceptable buy price range based on:
    - [x] rolling average price
    - [x] cluster deficit level

  - [x] Acceptable sell price range based on:
    - [x] rolling average price
    - [x] surplus level and storage pressure

- [x] Use configuration module to define:
  - [x] max credits to spend per tick / per shard
  - [x] safety reserve of credits
  - [x] prioritization of selling commodities (as main source of credits) vs. raw minerals/energy

### 19.3 Trade Decision Logic (Buy & Sell)

- [x] Hook trade decisions into cluster logistics:
  - [x] If cluster has strong surplus of a resource:
    - [x] check market for profitable sell orders
    - [x] prioritize selling commodities and compressed bars to NPC orders

  - [x] If cluster has strong deficit of a critical resource:
    - [x] check market for affordable buy orders
    - [x] prioritize buying missing boosts, minerals, power, or energy when justified

- [x] Implement simple trade executor:
  - [x] ensure terminal cooldown and energy cost are considered
  - [x] avoid spamming trades: per-resource cooldown tick and per-room terminal budget
  - [x] log trade summaries for debugging (profit, cost, remaining credits)

### 19.4 Integration with Pheromones & Strategy

- [x] Connect market usage to pheromones and posture:
  - [x] High `war` / `siege` pheromones:
    - [x] allow more aggressive buying of combat boosts, power, and high-tier commodities

  - [x] High `eco` / strong surplus:
    - [x] prioritize selling surplus minerals/commodities for credits

- [x] Add strategic objectives:
  - [x] maintain minimum credits buffer
  - [x] target credit growth rate when economy is stable

- [x] Use market to support multi-shard meta:
  - [x] War shard may import boosts/energy via market funded by economic shards
  - [x] Economic shards focus on commodity chains and export for credits

### 19.5 Emergency & Failsafe Behaviors

- [x] Emergency buy mode:
  - [x] If critical resource (e.g. energy, specific boosts) falls below hard threshold:
    - [x] temporarily relax normal price limits (within configured emergency bounds)

- [x] Safety constraints:
  - [x] Never trade away last safety buffer of key resources (energy, base minerals)
  - [x] Prevent credit depletion: hard minimum credit floor

- [x] Monitoring:
  - [x] Periodic console summary of:
    - [x] current credits
    - [x] last N trades and their profit/loss
    - [x] per-resource surplus/deficit and trade status
