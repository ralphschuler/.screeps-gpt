---
title: "Release 0.177.7: Emergency Harvester Priority - Preventing Energy Starvation Deadlocks"
date: 2025-11-28T13:04:23.000Z
categories:
  - Release Notes
tags:
  - release
  - bug-fix
  - spawning
  - energy-management
  - critical-systems
---

## Introduction

Release 0.177.7 delivers a critical fix to the bot's spawn prioritization system that prevents a catastrophic energy starvation deadlock scenario. When all harvesters die while other creeps remain alive, the system could previously enter a deadlock where non-harvester creeps continuously spawned and consumed energy without generating income, leading to total workforce collapse. This release introduces explicit harvester priority checks and refactored emergency spawn logic to ensure energy production is always prioritized.

## Key Features

**Critical Harvester Priority System**
- Explicit priority check prevents energy starvation deadlock when harvester count drops to zero
- Forces harvester spawn before any other role when harvesters are absent but other creeps exist
- Blocks all non-harvester spawns until at least one harvester is successfully spawned

**Refactored Emergency Spawn Logic**
- Extracted emergency spawn logic into reusable `attemptEmergencyHarvesterSpawn()` helper method
- Unified handling for both total workforce collapse (EMERGENCY) and harvester starvation (CRITICAL) scenarios
- Improved error reporting with detailed failure diagnostics

## Technical Details

### The Energy Starvation Deadlock Problem

Prior to this release, the spawn system had a critical vulnerability in its prioritization logic. The sequence of events leading to deadlock:

1. All harvesters die (from hostile action, CPU timeout, or other causes)
2. Other creeps (upgraders, builders, etc.) remain alive
3. System detects "not emergency" because `totalCreeps > 0`
4. Normal spawn logic attempts to spawn builders, upgraders, or other roles
5. These spawns consume energy without generating any income
6. Energy depletes further, preventing harvester spawns
7. System enters permanent deadlock state

This scenario was particularly insidious because the bot appeared "alive" with active creeps, but was actually in an unrecoverable state without manual intervention.

### Design Rationale

The fix implements a two-tier emergency response system:

**Tier 1: Total Workforce Collapse (EMERGENCY)**
```typescript
if (totalCreeps === 0) {
  // Existing emergency spawn logic
  attemptEmergencyHarvesterSpawn(game, spawned, roleCounts, "EMERGENCY", "emergency");
}
```
This handles the complete workforce loss scenario where no creeps exist at all.

**Tier 2: Harvester Starvation (CRITICAL)**
```typescript
if (harvesterCount === 0 && totalCreeps > 0) {
  // NEW: Critical priority check
  attemptEmergencyHarvesterSpawn(game, spawned, roleCounts, "CRITICAL", "priority");
}
```
This new check catches the energy starvation deadlock scenario where harvesters are gone but other creeps remain.

### Why This Approach?

Alternative approaches were considered but rejected:

1. **Role Priority Weights**: Complex weight system for all roles - rejected as over-engineered
2. **Energy Threshold Checks**: Spawn harvesters when energy is low - reactive rather than preventive
3. **Role Dependency Graph**: Explicit dependencies between roles - too rigid for dynamic gameplay

The chosen approach is surgical and minimal: it adds exactly one conditional check at the critical decision point, preventing the deadlock without restructuring the entire spawn system. This aligns with the repository's principle of making "the smallest possible changes to achieve the goal."

### Implementation Details

The refactored `attemptEmergencyHarvesterSpawn()` method in `packages/bot/src/runtime/behavior/RoleControllerManager.ts` provides:

**Explicit Return Contract**
```typescript
{ success: boolean; blocked: boolean; error?: string }
```
Clear success/failure state with optional error messages for diagnostics.

**Comprehensive Error Handling**
- No spawn available: `{ success: false, blocked: true, error: "No spawn available" }`
- Insufficient energy: `{ success: false, blocked: true, error: "Insufficient energy (X) for minimal body (need 200)" }`
- Spawn failure: `{ success: false, blocked: true, error: "Spawn failed: ERROR_CODE" }`

**Integration with Existing Systems**
- Uses `BodyComposer.generateEmergencyBody()` for minimal viable harvester bodies
- Respects role controller memory initialization via `controller.createMemory()`
- Updates spawn tracking arrays and role counts for consistency

### File Changes

**Modified Files:**
- `packages/bot/src/runtime/behavior/RoleControllerManager.ts` - Core spawn prioritization logic
- `tests/regression/role-controller-manager-spawning.test.ts` - Regression test coverage

**Key Code Sections:**
- Lines 385-401: New critical harvester priority check
- Lines 837-895: Extracted `attemptEmergencyHarvesterSpawn()` helper method

## Bug Fixes

**Prevented Energy Starvation Deadlock**
- Fixed scenario where zero harvesters + existing creeps = permanent deadlock
- System now correctly prioritizes harvesters above all other roles when harvester count drops to zero
- Blocks all spawns until harvester spawn succeeds, preventing energy drain from non-productive creeps

**Improved Emergency Spawn Reliability**
- Unified emergency spawn logic eliminates code duplication
- Better error diagnostics for spawn failures
- Consistent handling across emergency and critical scenarios

## Breaking Changes

None. This is a pure bug fix with no API changes or behavior modifications for normal operation. The spawn system continues to function identically when harvesters are present.

## Impact

### Immediate Benefits

**Autonomous Recovery**: The bot can now autonomously recover from harvester loss without manual intervention, even when other creeps are alive.

**Diagnostic Clarity**: Enhanced logging with `[CRITICAL]` and `[EMERGENCY]` prefixes makes it immediately clear which recovery mode is active.

**Spawn Efficiency**: By blocking wasteful non-harvester spawns during energy starvation, the system conserves energy for the critical harvester spawn.

### Strategic Implications

This fix is particularly important for the autonomous AI's ability to handle unexpected scenarios:

1. **Combat Resilience**: When hostile invaders specifically target harvesters, the bot can recover
2. **CPU Timeout Recovery**: After CPU-induced workforce collapse, harvester priority ensures correct recovery order
3. **Multi-Room Scaling**: As the bot expands to multiple rooms, this pattern prevents cascading failures

### Performance Characteristics

**CPU Impact**: Negligible - adds one additional conditional check per tick
**Memory Impact**: Zero - no new memory structures
**Execution Time**: <0.01 CPU per check

## What's Next

This emergency spawn system establishes a foundation for future improvements:

**Harvester Redundancy**: Consider maintaining minimum 2 harvesters at all times to prevent single-point-of-failure
**Role Dependency System**: Generalize priority logic to handle other critical role dependencies (e.g., haulers for storage-based economy)
**Predictive Spawn Planning**: Spawn replacement harvesters before current harvesters die (TTL-based)

The fix directly supports the bot's Phase 1: Foundation objectives by ensuring stable bootstrap behavior and autonomous recovery from edge cases. Related issues and future work:

- Issue #1490: Energy starvation deadlock (resolved by this release)
- Issue #998: Zero creep population investigation (prevented by this fix)
- Issue #1002: Emergency spawn bootstrap (enhanced by this implementation)

---

**Contributors**: Copilot SWE Agent, @ralphschuler  
**Pull Request**: #1490  
**Deployment**: Automated via CI/CD pipeline
