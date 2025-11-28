---
title: "Release 0.175.1: Combat Priority Fix - Attackers Now Spawned Before Claimers"
date: 2025-11-28T00:35:33.000Z
categories:
  - Release Notes
tags:
  - release
  - bug-fix
  - combat
  - spawn-logic
  - runtime
---

We're excited to announce release 0.175.1, a targeted bug fix that improves spawn queue prioritization when your bot needs to handle both combat and expansion simultaneously. This release ensures attackers spawn before claimers, reflecting the time-sensitive nature of combat operations.

## Key Features

- **Fixed spawn priority logic** - Attackers now correctly prioritized over claimers when both are pending
- **Enhanced regression test coverage** - Added comprehensive 351-line test suite validating all priority scenarios
- **Improved combat responsiveness** - Attack operations no longer delayed by expansion spawning

## The Problem

Prior to this release, when both attack flags (indicating hostile threats) and expansion requests (requesting new room claims) were active, the spawn queue would continue prioritizing claimer creeps even after spawning one. This meant that urgent combat operations requiring attacker creeps could be significantly delayed while the bot attempted to spawn claimers for territorial expansion.

The root cause was in `RoleControllerManager.ts`'s spawn priority logic, which had separate conditional branches for `needsClaimers` and combat mode, but no explicit handling for the scenario where both `needsAttackers` and `needsClaimers` were true simultaneously. The existing code would fall through to the claimer priority branch, ignoring pending attack operations.

## Technical Details

### Implementation Changes

The fix introduces two new conditional branches in `RoleControllerManager.ensureRoleMinimums()` within `packages/bot/src/runtime/behavior/RoleControllerManager.ts`:

**1. Combined Attack + Expansion Scenario:**
```typescript
} else if (needsAttackers && needsClaimers) {
  // Attack flags pending with expansion: prioritize attackers over claimers
  // Attackers should spawn before claimers since attacks are typically more urgent
  roleOrder = baseRoleOrder.filter(r => r !== "attacker" && r !== "claimer");
  roleOrder.splice(1, 0, "attacker"); // Attackers second (after harvesters)
  roleOrder.splice(2, 0, "claimer");  // Claimers third
```

**2. Attack-Only Scenario:**
```typescript
} else if (needsAttackers) {
  // Attack flags pending: prioritize attackers (second after harvesters)
  roleOrder = baseRoleOrder.filter(r => r !== "attacker");
  roleOrder.splice(1, 0, "attacker");
```

### Design Rationale

**Why prioritize attackers over claimers?**

Combat operations are inherently time-sensitive. Hostile creeps can deal damage to structures and your own creeps, potentially causing significant setbacks. In contrast, expansion operations are strategic investments that can be delayed by a few ticks without meaningful impact.

By spawning attackers before claimers, the bot can:
- Respond to hostile threats faster
- Minimize damage to infrastructure
- Protect energy reserves and production capacity
- Complete expansion only after immediate threats are neutralized

**Why use splice() with hardcoded indices?**

This approach maintains consistency with existing code patterns in `RoleControllerManager`. The splice-based insertion provides explicit, readable priority ordering:
1. Harvesters (always first - economy foundation)
2. Attackers (when needed - combat response)
3. Claimers (when needed - expansion)
4. Remaining roles (builders, upgraders, repairers, etc.)

### Updated Priority Matrix

The spawn priority logic now handles four distinct scenarios:

| Condition | Priority Order |
|-----------|----------------|
| **Combat mode** (hostile creeps in owned rooms) | harvester → attacker → healer → claimer → ... |
| **Attack + Expansion** (both flags present) | harvester → **attacker** → claimer → ... |
| **Attack only** (attack flags present) | harvester → **attacker** → ... |
| **Expansion only** (claim flags present) | harvester → claimer → ... |
| **Normal operation** | harvester → upgrader → builder → ... |

## Bug Fixes

**Issue #1461: Spawn queue continued prioritizing claimers after spawning one**

When both attack flags and expansion requests were active, claimers would continue spawning in priority position even with attackers pending. This fix ensures attackers always take precedence, enabling faster combat response.

**Root Cause:** Missing conditional branch for `needsAttackers && needsClaimers` scenario  
**Resolution:** Added explicit handling with attacker-first priority  
**Related Issue:** Closes #1427 (spawn priority investigation)  

## Testing & Validation

This release includes a comprehensive regression test suite (`tests/regression/attacker-priority-over-claimer.test.ts`) with 351 lines of validation code covering:

- **Baseline scenarios:** Claimer-only, attacker-only, and normal operation priority ordering
- **Combined scenarios:** Simultaneous attack and expansion requests with correct priority enforcement
- **Edge cases:** Empty role orders, missing harvesters, combat mode interactions
- **Integration validation:** Full spawn queue ordering with realistic game state

The test suite uses detailed mock objects simulating:
- Multiple rooms with varying threat levels
- Attack flags with different colors
- Expansion requests via `Memory.expansion`
- Energy capacity and spawn state
- Controller and source availability

**Test Results:**
```
Test Files  76 passed | 1 skipped (77)
     Tests  654 passed | 32 skipped (686)
```

All existing tests continue to pass, confirming no regressions in existing behavior.

## Impact

### Operational Benefits

1. **Faster Combat Response:** Attackers spawn immediately when threats are detected, rather than waiting for claimer spawns to complete
2. **Improved Tactical Flexibility:** The bot can handle simultaneous defense and expansion scenarios more effectively
3. **Reduced Vulnerability Window:** Hostile creeps have less time to damage infrastructure before defenders arrive
4. **Better Resource Allocation:** Energy spent on spawning reflects actual threat priorities

### Performance Considerations

This change has **zero CPU overhead** - it's purely a logic reordering that happens once per spawn cycle during role minimum calculation. Memory usage is unchanged.

### Strategic Implications

This fix enables more aggressive multi-front strategies where the bot can:
- Defend existing rooms while simultaneously claiming new territory
- Respond to opportunistic attack opportunities without abandoning expansion plans
- Maintain territorial pressure while ensuring home defense

## What's Next

This release demonstrates the value of comprehensive regression testing in catching behavioral edge cases. Future improvements to spawn prioritization might include:

- **Dynamic priority scoring** based on threat assessment (hostile creep count, body composition)
- **Energy-aware prioritization** that considers spawn energy availability
- **Multi-room coordination** for distributing spawning across multiple spawns
- **Configurable priority weights** for custom strategic tuning

For now, this surgical fix addresses the immediate issue while maintaining code simplicity and clarity.

## Related References

- **Source Code:** `packages/bot/src/runtime/behavior/RoleControllerManager.ts` (lines 545-556)
- **Test Suite:** `tests/regression/attacker-priority-over-claimer.test.ts`
- **Pull Request:** [#1461](https://github.com/ralphschuler/.screeps-gpt/pull/1461)
- **Related Issue:** [#1427](https://github.com/ralphschuler/.screeps-gpt/issues/1427)

---

**Contributors:**  
- Copilot (GitHub Copilot SWE Agent)
- ralphschuler (Review and merge)

**Deployment:**  
Version 0.175.1 is automatically deployed to the PTR environment and production servers via CI/CD pipeline.
