---
title: "Release 0.139.3: Tower Repair System Restored"
date: 2025-11-24T00:03:29.074Z
categories:
  - Release Notes
tags:
  - release
  - bug-fix
  - defense
  - infrastructure
---

We're pleased to announce the release of version 0.139.3, which addresses a critical issue in the defensive infrastructure system. This release restores the tower repair functionality that was inadvertently disabled, ensuring your base's infrastructure receives proper maintenance during peacetime.

## Key Fix: Tower Repair System

**Problem:** Towers were not repairing damaged structures (roads, containers, ramparts, etc.) when no hostile creeps were present in the room. This led to gradual infrastructure degradation over time, reducing base efficiency and creating maintenance debt that had to be addressed manually or through dedicated repairer creeps.

**Root Cause:** The DefenseCoordinator was only invoking TowerManager.run() when threats were detected. While this made sense from a defensive optimization perspective, it prevented towers from performing their secondary function—infrastructure maintenance—during normal operations.

**Solution:** Modified DefenseCoordinator to call TowerManager.run() unconditionally on every tick, regardless of threat status. This ensures towers can fulfill both their defensive and maintenance roles appropriately.

## Technical Details

### Design Rationale

The original implementation optimized for CPU efficiency by skipping tower logic entirely when no threats were present. However, this optimization was too aggressive. Towers serve dual purposes in Screeps:

1. **Primary role:** Defend against hostile creeps with ATTACK action
2. **Secondary role:** Maintain infrastructure with REPAIR action

By gating all tower behavior behind threat detection, we effectively disabled the secondary role. The fix recognizes that tower management should be continuous, with the TowerManager itself responsible for deciding between defensive and maintenance actions based on current conditions.

### Implementation Changes

The changes were made to `packages/bot/src/runtime/behavior/DefenseCoordinator.ts`:

**Before:**
```typescript
if (threatLevel !== ThreatLevel.NONE) {
  this.towerManager.run(room);
}
```

**After:**
```typescript
// Always run tower manager - it handles both defense and repair
this.towerManager.run(room);
```

This simple change delegates action priority to the TowerManager, which already has logic to:
- Prioritize attacking hostile creeps when present
- Reserve 500 energy for defense to ensure readiness
- Repair damaged infrastructure during peacetime

### Energy Efficiency

The fix maintains the existing energy efficiency safeguards in TowerManager:
- Towers reserve 500 energy for emergency defense
- Repair actions only occur when energy exceeds this threshold
- Repair priority follows a logical hierarchy (critical structures first)

This means towers won't leave your base defenseless by spending all their energy on repairs. The 500-energy buffer ensures quick response capability when threats appear.

### Test Coverage

We've added comprehensive test coverage to prevent regression:
- **Unit tests:** Validate that DefenseCoordinator calls TowerManager.run() in all threat scenarios
- **Repair-only scenarios:** Verify towers perform repairs when no hostiles are present
- **Energy reservation:** Confirm the 500-energy defense buffer is respected during repairs

The test suite now includes specific scenarios for peaceful rooms with damaged infrastructure, ensuring this functionality remains intact in future releases.

## Impact

### Infrastructure Maintenance
Your base's infrastructure will now receive continuous maintenance from towers during peacetime. Roads, containers, ramparts, and other structures will be kept in good repair without requiring dedicated repairer creeps or manual intervention.

### Operational Efficiency
By leveraging towers for dual-purpose operations, the bot can allocate CPU and creep resources more efficiently. Repairer creeps can focus on remote rooms or specialized maintenance tasks, while towers handle base infrastructure.

### Defense Readiness
The 500-energy reservation system ensures defense capabilities remain uncompromised. Towers will immediately switch from repair to defense when threats appear, maintaining base security.

## Related Issue

This release resolves issue [#1275](https://github.com/ralphschuler/screeps-gpt/issues/1275): "Towers not repairing structures when no hostile creeps present."

## Looking Forward

This fix is part of our ongoing commitment to robust defensive infrastructure. Future enhancements to the defense system will maintain this dual-purpose philosophy, ensuring towers contribute to both security and maintenance.

The addition of repair-only test scenarios also strengthens our regression suite, providing better coverage for edge cases in defensive systems. As we continue to expand the bot's capabilities, this comprehensive testing approach will help prevent similar issues from emerging.

---

*For more details about this release, see the [CHANGELOG](https://github.com/ralphschuler/screeps-gpt/blob/main/CHANGELOG.md#01393---2025-11-24).*
