# @ralphschuler/screeps-swarm-bot

Swarm-intelligence Screeps bot scaffold that applies the pheromone-driven "ant colony"
architecture described in the design document. The package focuses on lightweight
room-local heuristics, stochastic spawn selection, and rare global overmind updates
while relying on the shared `@ralphschuler/screeps-kernel` for process management.

## Features

- **Pheromone memory model** mapped into `Memory.swarm` with decay, TTL, and
  event buffering to capture stigmergic signals per room.
- **Colony evolution tracking** that derives intent and posture from controller
  progress, danger levels, and expansion pressure.
- **Spawn roulette profiles** that translate pheromone weights into probabilistic
  role suggestions without central micromanagement.
- **Global overmind** that executes infrequently to rank claim targets,
  consolidate war/nuke candidates, and record scouting intel.
- **Kernel-managed processes** for deterministic execution order and CPU
  protection out of the box.
- **Blueprint-aware structure tracking** to push build pheromones when core
  layouts fall behind.
- **Defense, expansion, and power-creep loops** that operate on tower
  priorities, neighbor diffusion, and lightweight power ability usage.
- **New core scaffolding** (`src/core`, `src/logic`, `src/intershard`) for
  logging, profiling, posture derivation, claim scoring, and shard-meta
  snapshots.

## Usage

```typescript
import { loop as swarmLoop } from "@ralphschuler/screeps-swarm-bot";

export const loop = swarmLoop;
```

The exported `loop` wires the screeps-kernel, registers all swarm processes, and
runs them each tick. Logs use `@ralphschuler/screeps-logger` and the
`@process` decorator automatically registers processes when modules are
imported.

## Processes

- `SwarmMetaProcess` (priority 110): writes inter-shard health snapshots and
  shard roles into `InterShardMemory` for the cross-shard meta-layer.
- `SwarmOvermindProcess` (priority 100): low-frequency global coordination that
  updates `Memory.swarm.overmind`, claim queues, and war/nuke candidate sets.
- `SwarmWarProcess` (priority 82): war posture tuning, siege detection, and
  pheromone amplification when hostiles are seen or nukes are inbound.
- `SwarmExpansionProcess` (priority 85): propagates expand pheromones into
  neighbor rooms and keeps the claim queue warm.
- `SwarmRoomProcess` (priority 80): room-level pheromone upkeep, evolution
  stage calculation, spawn profile generation, and event buffering.
- `SwarmSpawnProcess` (priority 65): roulette-driven role selection that
  translates spawn profiles into creep bodies and emits spawn events.
- `SwarmCreepProcess` (priority 60): runs lightweight role behaviors for the
  economy, scouting, claiming, defense, and offensive archetypes.
- `SwarmLogisticsProcess` (priority 77): pairs surplus and deficit rooms and
  emits logistics routes plus pheromone boosts for inter-room hauling.
- `SwarmRallyProcess` (priority 83): stages war/raid rallies by mapping homes
  to frontline or war-target rooms for guards, healers, and soldiers.

## Todo coverage vs. design plan

- [x] Project skeleton with `src/core`, `src/logic`, `src/memory`, `src/layouts`,
  `src/intershard`, and typed Screeps TS config.
- [x] Pheromone memory schema with decay/diffusion, intent derivation, and
  spawn roulette weights.
- [x] Global overmind queues (claim/war/nuke) plus inter-shard health snapshot
  updates and cluster grouping.
- [x] Creep archetype behaviors for economy, scouting/claiming, defense, and
  offense.
- [x] Blueprint tracking with deficit-driven build pheromones.
- [x] Automated blueprint placement (construction site creation respecting
  controller limits).
- [x] Tower control refinements for nuke-first, healer/ranged priority and
  rampart hardening.
- [x] Expansion tasking for claim/scout/forager ants tied to the claim queue.
- [x] Remote logistics routes for energy shuffling plus rally logic for
  war/raiding squads.
- [x] CPU profiling hooks and per-room metric EMA helpers for performance
  tuning.

## Extending

- Add new protocols with `@protocol` to expose shared helpers to all processes.
- Create additional processes (e.g., `RemoteHarvestProcess`) and export them via
  `src/processes/index.ts`; they are automatically registered by the decorator.
- Adjust thresholds in `src/constants.ts` to tune aggression, decay factors, and
  TTL windows.

## Building

```bash
yarn workspace @ralphschuler/screeps-swarm-bot build
```

The package ships TypeScript sources and emits declaration files for
consumption by other packages in the monorepo.
