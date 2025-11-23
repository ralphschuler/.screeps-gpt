---
title: "Release 0.137.7: ColonyManager Memory Loading Hotfix"
date: 2025-11-23T02:17:07.000Z
categories:
  - Release Notes
tags:
  - release
  - hotfix
  - bug-fix
  - colony-management
  - memory-system
---

We're pleased to announce the immediate availability of Screeps GPT version 0.137.7, a focused hotfix release that addresses a critical memory loading bug in the ColonyManager system. This release ensures proper state restoration when loading colony data from memory, preventing duplicate entries and maintaining data integrity across game ticks.

## Key Fix

**ColonyManager Memory Loading Bug**: Fixed array state restoration to prevent accumulation of duplicate entries when loading from Memory.

## Technical Details

### The Problem

The ColonyManager class, introduced as part of our Phase 5 multi-room and global management features, manages colony expansion, inter-shard communication, and global resource coordination. When persisting state to Memory and reloading it across ticks, the `loadFromMemory()` method was appending data to existing arrays without first clearing them.

This caused a critical bug where:
- Expansion requests would accumulate duplicates on each tick
- Inter-shard messages would be replicated repeatedly
- Memory usage would grow linearly with each game tick
- Colony coordination logic would process the same items multiple times

### Root Cause Analysis

The issue was located in `packages/bot/src/runtime/planning/ColonyManager.ts` within the `loadFromMemory()` private method. The original implementation used the spread operator to push memory data into instance arrays:

```typescript
if (this.memoryRef.expansionQueue) {
  this.expansionQueue.push(...this.memoryRef.expansionQueue);
}
```

However, the method did not clear the arrays before loading, meaning that if `loadFromMemory()` was called multiple times (which can happen during bot reinitialization or code updates), the same data would be appended repeatedly.

### The Solution

The fix adds explicit array clearing before loading data from memory:

```typescript
if (this.memoryRef.expansionQueue) {
  this.expansionQueue.length = 0;  // Clear existing entries
  this.expansionQueue.push(...this.memoryRef.expansionQueue);
}

if (this.memoryRef.shardMessages) {
  this.shardMessages.length = 0;  // Clear existing entries
  this.shardMessages.push(...this.memoryRef.shardMessages);
}
```

This ensures idempotent loading behavior - calling `loadFromMemory()` multiple times produces the same result as calling it once, which is the expected behavior for state restoration.

**Why This Approach**: We use `.length = 0` instead of reassigning the array (`this.expansionQueue = []`) because:
1. It maintains the same array reference, preserving any external references to the array
2. It's the standard pattern used throughout the Screeps GPT codebase for in-place array clearing
3. It provides better memory efficiency by reusing the existing array allocation

### Files Changed

- `packages/bot/src/runtime/planning/ColonyManager.ts`: Added array clearing logic in `loadFromMemory()` method

### Design Rationale

The ColonyManager is a critical component for multi-room empire coordination in Phase 5 of bot development. State persistence is essential because:

1. **Code Updates**: When uploading new code to Screeps, global objects are recreated but Memory persists
2. **Respawn Recovery**: After respawn events, the bot needs to restore its colony coordination state
3. **CPU Management**: Rebuilding state from scratch on every tick would be CPU-intensive

The idempotent loading pattern ensures that regardless of how many times the constructor is called or state is restored, the colony manager maintains consistent, accurate state. This is particularly important for:

- **Expansion Queue**: Prevents duplicate room claiming attempts that would waste CPU and credits
- **Inter-Shard Messages**: Avoids sending the same resource requests or status updates multiple times
- **Claimed Rooms Tracking**: Maintains accurate set of controlled rooms for resource allocation

## Impact

This hotfix has immediate positive impacts on:

1. **Memory Efficiency**: Prevents unbounded memory growth in colony coordination data structures
2. **CPU Optimization**: Eliminates redundant processing of duplicate expansion requests and messages
3. **Data Integrity**: Ensures accurate colony state representation across game ticks and code updates
4. **Multi-Room Scaling**: Enables reliable expansion coordination without state corruption
5. **Inter-Shard Communication**: Prevents message duplication in global coordination systems

For bots actively using the ColonyManager for expansion (typically RCL 4+ with multiple rooms), this fix prevents a gradual performance degradation that would occur as duplicate entries accumulated over time.

## Breaking Changes

None. This is a backward-compatible bug fix that maintains the existing ColonyManager API and behavior.

## Deployment Notes

This release was deployed as an emergency hotfix without a corresponding changelog entry, reflecting its critical nature. The fix was merged directly to main and tagged as v0.137.7 on November 23, 2025 at 02:17 UTC.

The rapid deployment process demonstrates our commitment to maintaining bot stability and addressing critical issues promptly, even outside the standard release cycle.

## What's Next

While this release focuses narrowly on fixing the memory loading bug, ongoing development continues on:

- Enhanced colony coordination algorithms for optimal resource distribution
- Advanced expansion heuristics for target room selection
- Inter-shard communication protocol improvements
- Multi-room defense coordination

As always, our monitoring infrastructure (PTR telemetry, bot snapshots, health tracking) will validate the effectiveness of this fix in production environments.

---

**Upgrade Instructions**: Simply deploy the latest code. No configuration changes or manual interventions required.

**Verification**: After deployment, you can verify the fix by checking Memory.colony data structures remain stable in size across multiple ticks, rather than growing with each tick.
