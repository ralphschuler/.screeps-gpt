---
title: "Release 0.148.0: Intelligent Room Expansion with Dynamic Claimer Spawning"
date: 2025-11-24T20:26:25.000Z
categories:
  - Release Notes
tags:
  - release
  - expansion
  - performance
  - RCL4
  - autonomous-development
---

We're excited to announce version 0.148.0 of Screeps GPT, featuring intelligent room expansion capabilities that unlock multi-room gameplay at RCL 4. This release bridges the gap between expansion strategy and execution, enabling the bot to autonomously spawn claimers when expansion opportunities are identified.

## Key Features

### Dynamic Claimer Spawning for Room Expansion

The centerpiece of this release is the implementation of dynamic claimer spawning that responds to expansion requests queued by the colony management system. When the bot reaches Room Controller Level 4 and identifies suitable expansion targets through scouting, it now automatically spawns claimer creeps to claim new rooms.

**What Changed:**

- **Expansion Queue Integration**: `RoleControllerManager` now reads from `Memory.colony.expansionQueue` to detect pending room claims
- **Dynamic Role Minimums**: Claimer minimum count adjusts based on `pendingExpansions.length - existingClaimers`, preventing duplicate spawns
- **Intelligent Priority Reordering**: When expansion is pending, claimers move to second position in spawn order (after harvesters) to ensure timely expansion
- **Target Room Assignment**: Each spawned claimer receives a `targetRoom` property in memory, linking it directly to the expansion request

## Technical Details

### The Problem

Prior to this release, the bot had all the pieces needed for expansion but lacked the critical bridge between strategy and execution. The `ClaimerController` defaulted to `minimum: 0` with no logic connecting `ColonyManager.expansionQueue` to spawn decisions. Even when scouting identified perfect expansion targets and queued them for claiming, no claimers would spawn—effectively blocking room expansion at RCL 4+.

### The Solution

We modified `RoleControllerManager.ensureRoleMinimums()` in `packages/bot/src/runtime/behavior/RoleControllerManager.ts` to add expansion-aware logic:

```typescript
// Query expansion state from colony memory
const colony = memory.colony as { expansionQueue?: Array<{ targetRoom: string; status: string }> } | undefined;
const pendingExpansions = colony?.expansionQueue?.filter(exp => exp.status === "pending") ?? [];
const needsClaimers = pendingExpansions.length > 0;

// Dynamically adjust claimer minimum based on pending expansions
if (role === "claimer" && needsClaimers) {
  const claimersOnExpansion = /* count claimers assigned to pending expansions */;
  targetMinimum = Math.max(targetMinimum, pendingExpansions.length - claimersOnExpansion);
}

// Assign target room when spawning
if (spawnedName && role === "claimer" && needsClaimers) {
  const unassignedExpansion = pendingExpansions.find(
    expansion => !assignedClaimerRooms.has(expansion.targetRoom)
  );
  if (unassignedExpansion) {
    game.creeps[spawnedName].memory.targetRoom = unassignedExpansion.targetRoom;
  }
}
```

### Why This Approach?

**Reactive Architecture**: Rather than hard-coding expansion logic, this implementation creates a reactive system where spawn decisions respond directly to strategic planning. When `ColonyManager` identifies an expansion opportunity, the spawn system automatically adapts.

**Duplicate Prevention**: By counting existing claimers assigned to pending expansions, we ensure exactly one claimer per expansion request—no more, no less. This prevents resource waste and spawn queue congestion.

**Priority Without Starvation**: Moving claimers to second position (after harvesters) ensures expansion proceeds promptly while never starving the room of critical energy infrastructure. Harvesters always spawn first, maintaining economic stability.

**Decoupled Systems**: This design maintains clean separation between strategic planning (`ColonyManager`), spawn management (`RoleControllerManager`), and creep behavior (`ClaimerController`). Each system has a single responsibility and communicates through shared memory structures.

### Performance Optimizations

This release includes significant CPU optimizations that reduce spawning overhead, particularly important for rooms with many creeps and multiple pending expansions:

**Pre-Calculated Claimer Assignments**: Instead of iterating through all creeps multiple times per role check, we now pre-calculate claimer assignments once before the role processing loop using a `Set` for O(1) lookups:

```typescript
const assignedClaimerRooms = new Set();
let claimersOnExpansionCount = 0;
for (const creep of Object.values(game.creeps)) {
  if (creep.memory.role === "claimer" && creep.memory.targetRoom) {
    assignedClaimerRooms.add(creep.memory.targetRoom);
    if (pendingExpansions.some(exp => exp.targetRoom === creep.memory.targetRoom)) {
      claimersOnExpansionCount++;
    }
  }
}
```

**Complexity Reduction**:
- **Before**: O(roles × creeps) for claimer checks + O(expansions × creeps) for target assignment
- **After**: O(creeps) once + O(roles) + O(expansions) for target assignment
- **Impact**: Significant CPU reduction when processing spawns with many creeps and multiple pending expansions

**Code Deduplication**: The role order array is now defined once and dynamically modified using `splice` when expansion is pending, eliminating 13 lines of duplicated configuration code.

## Bug Fixes

This release fixes a critical gap in autonomous gameplay progression:

- **Expansion Blockage at RCL 4+**: Claimers now spawn automatically when expansion opportunities are identified, unblocking room expansion and enabling multi-room economy development
- **Resolves Issue #1335**: "We are at room level 4, scouting has rooms to expand to, so why are no claimers spawned?"

## Impact

### Gameplay Progression

This release enables the bot to progress beyond single-room optimization into multi-room empire building. Once the bot reaches RCL 4 and its scouting system identifies suitable expansion targets, it will now autonomously:

1. Queue expansion requests in colony memory
2. Spawn claimers with appropriate target room assignments  
3. Claim new rooms and begin establishing remote operations
4. Scale to multi-room economy and defense coordination

### Development Workflow

This feature exemplifies the autonomous development capabilities of Screeps GPT. Issue #1335 was identified through bot monitoring, automatically triaged by GitHub Copilot, implemented by the Todo automation agent, and thoroughly reviewed—all with minimal manual intervention. The implementation spans just 74 lines of code changes focused on a single file, demonstrating surgical precision aligned with repository coding standards.

### Performance Benefits

The CPU optimizations in this release provide:
- **Single-pass creep iteration** instead of repeated filtering per role
- **Constant-time lookup** for claimer assignments using Set data structures
- **Reduced code complexity** through strategic pre-calculation and caching
- **Scalable spawn logic** that maintains performance as creep counts grow

## What's Next

With room expansion now functional, future releases will focus on:

- **Remote harvesting coordination**: Managing energy logistics across multiple rooms
- **Multi-room defense**: Coordinating defenders and towers across the empire
- **Inter-room logistics**: Terminal networks and resource balancing
- **Colony-wide CPU optimization**: Distributed processing and priority scheduling

These capabilities will build on the foundation established in this release, enabling increasingly sophisticated autonomous gameplay.

---

**Full Changelog**: [v0.146.0...v0.148.0](https://github.com/ralphschuler/.screeps-gpt/compare/v0.146.0...v0.148.0)

**Related PR**: [#1336](https://github.com/ralphschuler/.screeps-gpt/pull/1336)

**Related Issue**: [#1335](https://github.com/ralphschuler/.screeps-gpt/issues/1335)
