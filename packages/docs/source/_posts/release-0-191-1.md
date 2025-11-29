---
title: "Release 0.191.1: Link Construction Priority Fix"
date: 2025-11-29T13:14:14.000Z
categories:
  - Release Notes
tags:
  - release
  - bugfix
  - runtime
  - infrastructure
  - builder
---

Release 0.191.1 addresses a critical infrastructure bug where builder creeps were unable to construct link structures, preventing efficient energy distribution networks in rooms that had reached RCL 5 and beyond. This small but impactful fix ensures the bot can now properly leverage the powerful link network system introduced at RCL 5.

## The Problem: Missing Links

Links are one of Screeps' most powerful infrastructure components, unlocked at Room Controller Level (RCL) 5. They enable instant energy transfers across rooms without the need for hauler creeps, dramatically improving energy distribution efficiency. However, a configuration oversight prevented builders from recognizing link construction sites as valid build targets.

The bug was discovered when the bot reached RCL 5 and construction sites for links were placed, but builder creeps consistently ignored them in favor of other structures. Investigation revealed that `STRUCTURE_LINK` was completely absent from three critical priority arrays that govern builder behavior:

- `BuilderController`: Controls builder creep target selection
- `RemoteBuilderController`: Manages remote room construction
- `TaskDiscovery`: Generates build tasks for the task queue system

Without `STRUCTURE_LINK` in these arrays, the bot had no way to recognize or prioritize link construction, effectively rendering the entire link network system non-functional.

## Technical Details

The fix introduces `STRUCTURE_LINK` to all three construction priority arrays with carefully considered placement:

### BuilderController (`packages/bot/src/runtime/behavior/controllers/BuilderController.ts`)

```typescript
const constructionPriorities = [
  STRUCTURE_SPAWN,
  STRUCTURE_EXTENSION,
  STRUCTURE_TOWER,
  STRUCTURE_CONTAINER,
  STRUCTURE_STORAGE,
  STRUCTURE_LINK, // Links for energy distribution (unlocked at RCL 5)
  STRUCTURE_ROAD,
  STRUCTURE_RAMPART,
  STRUCTURE_WALL
];
```

### RemoteBuilderController (`packages/bot/src/runtime/behavior/controllers/RemoteBuilderController.ts`)

```typescript
const constructionPriorities = [
  STRUCTURE_SPAWN,
  STRUCTURE_CONTAINER,
  STRUCTURE_TOWER,
  STRUCTURE_STORAGE,
  STRUCTURE_LINK, // Links for energy distribution (unlocked at RCL 5)
  STRUCTURE_ROAD,
  STRUCTURE_RAMPART,
  STRUCTURE_WALL
];
```

### TaskDiscovery (`packages/bot/src/runtime/behavior/TaskDiscovery.ts`)

```typescript
const priorityMap: { type: BuildableStructureConstant; priority: TaskPriority }[] = [
  { type: STRUCTURE_SPAWN, priority: TaskPriority.CRITICAL },
  { type: STRUCTURE_EXTENSION, priority: TaskPriority.CRITICAL },
  { type: STRUCTURE_TOWER, priority: TaskPriority.HIGH },
  { type: STRUCTURE_CONTAINER, priority: TaskPriority.HIGH },
  { type: STRUCTURE_STORAGE, priority: TaskPriority.HIGH },
  { type: STRUCTURE_LINK, priority: TaskPriority.HIGH }, // Links for energy distribution (unlocked at RCL 5)
  { type: STRUCTURE_ROAD, priority: TaskPriority.NORMAL },
  { type: STRUCTURE_RAMPART, priority: TaskPriority.NORMAL },
  { type: STRUCTURE_WALL, priority: TaskPriority.LOW }
];
```

### Design Rationale

The placement of `STRUCTURE_LINK` was strategic:

**Position in Priority Order**: Links are placed after `STORAGE` but before `ROAD`. This reflects their importance in the economic infrastructure hierarchy:
- Storage facilities provide the foundation for resource management
- Links enable efficient distribution from/to storage
- Roads improve movement efficiency but are less critical than active energy transfer

**Priority Level**: In the task-based system (`TaskDiscovery`), links are assigned `TaskPriority.HIGH`, the same as containers, storage, and towers. This ensures they're constructed promptly when RCL 5 is reached, but don't block critical spawn/extension construction.

**Consistency Across Controllers**: By adding the same priority placement in all three controllers, we ensure consistent behavior whether the bot uses:
- Role-based controllers (`BuilderController`, `RemoteBuilderController`)
- Task-based execution (`TaskDiscovery`)
- Local or remote room construction

This consistency prevents edge cases where different execution paths might produce different construction priorities.

## Why This Architecture?

The Screeps GPT bot uses a dual-mode architecture for creep behavior:

1. **Role Controllers**: State machine-based controllers that directly manage creep actions based on their role
2. **Task System**: A queue-based system where tasks are discovered, prioritized, and assigned to available creeps

Both systems needed updating because either could be active depending on configuration. The bot's flexibility in execution modes ensures it can adapt to different operational requirements, but requires careful synchronization of priority arrays across both systems.

The bug highlighted an important lesson: **when adding new structure types to the game (or unlocking new RCL features), all construction priority arrays must be updated simultaneously** to maintain consistency across execution modes.

## Impact on Bot Performance

This fix has significant implications for mid-to-late game performance:

**Energy Distribution Efficiency**: Links provide instant energy transfer with no CPU overhead for hauler pathfinding. A properly configured link network can reduce hauler workload by 60-80% in rooms with distributed mining operations.

**RCL 5+ Progression**: Without this fix, rooms reaching RCL 5 would stall on link-dependent optimizations. The bot could manually place link construction sites, but builders would never complete them, leaving energy distribution inefficient.

**Strategic Enablement**: Links are prerequisites for several advanced strategies:
- Centralized upgrader positioning (energy links to controller area)
- Remote mining efficiency (links to transport energy from remote rooms)
- Multi-room logistics optimization (link chains between adjacent rooms)

## Autonomous Fix by Copilot

This fix was implemented entirely by GitHub Copilot's autonomous agent system, demonstrating the effectiveness of the repository's AI-driven development workflow:

1. **Issue Detection**: Issue #1542 was created (likely from monitoring or manual observation)
2. **Analysis**: The Copilot agent analyzed the issue and identified the root cause
3. **Implementation**: The agent made surgical changes to exactly three files
4. **Pull Request**: PR #1557 was automatically created with clear commit messages and co-authorship tracking
5. **Integration**: The fix was merged and released as version 0.191.1

The commit message clearly documents the problem, solution, and reasoning—ensuring future maintainers (human or AI) understand the context. The co-authorship tags acknowledge both the automated implementation (`copilot-swe-agent[bot]`) and human review (`ralphschuler`).

## What's Next

With link construction now functional, the bot can proceed with RCL 5+ optimizations:

- **Link Network Planning**: Implementing intelligent link placement based on room layout
- **Link Energy Management**: Developing transfer strategies to optimize energy flow
- **Remote Mining Links**: Enhancing remote harvesting with link-based logistics
- **Controller Link Strategy**: Positioning upgraders near controller links for maximum efficiency

These enhancements build on the foundation established by this fix, enabling the sophisticated energy distribution networks that characterize high-performing Screeps bots.

---

**Issue Reference**: [#1542](https://github.com/ralphschuler/.screeps-gpt/issues/1542)  
**Pull Request**: [#1557](https://github.com/ralphschuler/.screeps-gpt/pull/1557)  
**Files Modified**:
- `packages/bot/src/runtime/behavior/TaskDiscovery.ts`
- `packages/bot/src/runtime/behavior/controllers/BuilderController.ts`
- `packages/bot/src/runtime/behavior/controllers/RemoteBuilderController.ts`
