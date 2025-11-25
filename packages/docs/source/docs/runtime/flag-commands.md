---
title: Flag Commands
date: 2025-11-25
category: runtime
tags:
  - flag-commands
  - user-control
  - runtime
---

# Flag Command System

The flag command system enables players to direct bot behavior through in-game flag placement without code changes. Flags are interpreted as commands based on their color combinations.

## Overview

**Purpose:** Provide a user interface for strategic directives that override autonomous bot decisions.

**Integration:** Flag commands are processed by `FlagCommandProcess` (priority 15) and stored in `Memory.flagCommands` for consumption by other systems.

**Visibility:** Flag visuals show command status (valid/invalid, prerequisites) when room visuals are enabled.

## Color Conventions

### Primary Color (Command Type)

| Color | Command | Description |
|-------|---------|-------------|
| 🟥 **Red** | ATTACK | Attack or raid the target location |
| 🟦 **Blue** | CLAIM | Claim the room controller |
| 🟩 **Green** | REMOTE_MINE | Set up remote mining operation |
| 🟨 **Yellow** | EXPAND | Expand/colonize the room |
| ⬜ **White** | SCOUT | Scout and observe the area |
| 🟪 **Purple** | DEFEND | Priority defense area |
| 🟧 **Orange** | BUILD | Focus construction in area |
| 🟤 **Brown** | RESERVE | Reserve the room controller |

### Secondary Color (Priority Level)

| Color | Priority | Effect |
|-------|----------|--------|
| ⬜ **White** | LOW | Process when resources available |
| 🟧 **Orange** | MEDIUM | Higher priority than autonomous tasks |
| 🟥 **Red** | HIGH | Urgent - override normal operations |

## Command Examples

### Claim a Room

**Setup:**
1. Place flag in target room near controller
2. Primary color: **Blue** (CLAIM)
3. Secondary color: **Red** (HIGH priority)

**Prerequisites:**
- Claimer creep available or spawnable
- Sufficient GCL for additional room
- Stable energy reserves (>10k in storage or >300 in room)

**Result:** Bot will spawn claimer if needed and attempt to claim the controller.

### Remote Mining

**Setup:**
1. Place flag near energy source in remote room
2. Primary color: **Green** (REMOTE_MINE)
3. Secondary color: **Orange** (MEDIUM priority)

**Prerequisites:**
- Hauler creeps available
- Stable energy reserves

**Result:** Bot will assign haulers to transport energy from the remote source.

### Attack Target

**Setup:**
1. Place flag on target structure or in hostile room
2. Primary color: **Red** (ATTACK)
3. Secondary color: **Red** (HIGH priority)

**Prerequisites:**
- Attack creeps (attacker/warrior/ranger roles) available
- Stable energy reserves

**Result:** Bot will direct attack creeps to the flagged location.

### Scout Room

**Setup:**
1. Place flag in unexplored room
2. Primary color: **White** (SCOUT)
3. Secondary color: **White** (LOW priority)

**Prerequisites:**
- Any mobile creep available

**Result:** Bot will send a creep to explore and gather intel on the room.

## Command Lifecycle

### 1. Interpretation Phase

**Process:** `FlagCommandProcess` (Priority 15)
- Runs before behavior execution
- Parses all Game.flags each tick
- Validates command feasibility
- Stores in `Memory.flagCommands`

### 2. Acknowledgment

Commands are acknowledged when:
- First parsed and validated
- Stored in Memory with timestamp
- Prerequisites checked

### 3. Execution

Commands are executed by:
- Behavior system for creep assignments
- Task system for priority tasking
- Other systems based on command type

### 4. Completion

Commands can be removed by:
- **Manual:** Delete the flag in-game
- **Automatic:** Task completion (future enhancement)
- **Console:** `cancelFlag(name)` command (future enhancement)

## Memory Structure

```typescript
Memory.flagCommands = {
  "ClaimW2N1": {
    type: "CLAIM",
    priority: "HIGH",
    roomName: "W2N1",
    pos: { x: 25, y: 25 },
    acknowledged: true,
    valid: true,
    validationReason: undefined,
    acknowledgedAt: 12345
  },
  "RemoteMineW3N2": {
    type: "REMOTE_MINE",
    priority: "MEDIUM",
    roomName: "W3N2",
    pos: { x: 10, y: 15 },
    acknowledged: true,
    valid: false,
    validationReason: "Prerequisites not met: No remote hauler creeps available",
    acknowledgedAt: 12346
  }
}
```

## Visual Feedback

Room visuals are enabled by default and show flag command status near each flag:

**Valid Command:**
```
✓ CLAIM
HIGH Priority
```

**Invalid Command:**
```
⚠️ REMOTE_MINE
Prerequisites not met: No remote hauler creeps available
```

## Validation Rules

### Command-Specific Prerequisites

**CLAIM:**
- Claimer creep available
- GCL level permits additional room
- Stable energy reserves

**REMOTE_MINE:**
- Hauler or remoteHauler creeps available
- Stable energy reserves

**ATTACK:**
- Attacker/warrior/ranger creeps available
- Stable energy reserves

**RESERVE:**
- Reserver creep available
- Stable energy reserves

**Other Commands:**
- Stable energy reserves (minimum requirement)

### General Prerequisites

All commands require one of:
- Storage with >10,000 energy
- Room with >300 energyAvailable

## Console Integration (Future)

Planned console commands for flag management:

```javascript
// List all active flag commands
listFlags()

// Explain what a specific flag does
explainFlag("ClaimW2N1")

// Cancel a flag command
cancelFlag("ClaimW2N1")

// Display help for flag commands
flagHelp()
```

## Implementation Details

### Key Files

**Core Implementation:**
- `packages/bot/src/runtime/commands/FlagCommandInterpreter.ts` - Command parsing and validation
- `packages/bot/src/runtime/processes/FlagCommandProcess.ts` - Kernel process integration

**Visual Feedback:**
- `packages/bot/src/runtime/visuals/RoomVisualManager.ts` - Flag command visualization

### Integration Points

**Kernel Integration:**
- Process priority: 15 (before BehaviorProcess at 50)
- Registered via `@process` decorator
- Imported in `runtime/processes/index.ts`

**Visual Integration:**
- `RoomVisualManager.renderFlagCommands()` displays status near flags
- Only renders when `showFlagCommands` config enabled

## Limitations

### Current Limitations

1. **No Task Generation:** Commands are stored but not yet converted to tasks
2. **No Automatic Removal:** Flags must be manually deleted
3. **No Console Commands:** Management via console not yet implemented
4. **Basic Validation:** Prerequisites are simple checks, not comprehensive

### Operational Security

⚠️ **Warning:** Flags are visible to all players in the game. Avoid placing flags in sensitive locations or use generic names to prevent strategy leakage.

## Best Practices

### Naming Conventions

Use descriptive flag names that indicate purpose:
- `ClaimW2N1` - Clear room target
- `RemoteMineW3N2_TopSource` - Specific source
- `AttackInvader_E5S3` - Target type and location

### Priority Assignment

- **HIGH (Red):** Emergency situations, critical objectives
- **MEDIUM (Orange):** Standard operations, planned expansion
- **LOW (White):** Exploration, optional objectives

### Energy Management

Before placing high-priority flags:
1. Check storage levels (>10k recommended)
2. Ensure stable harvesting operations
3. Verify spawning capacity available

## Testing

Flag commands can be tested without deployment:

1. **Place test flags** in local server or PTR
2. **Check Memory** via console: `JSON.stringify(Memory.flagCommands, null, 2)`
3. **Verify visuals** with room visuals enabled
4. **Monitor logs** for acknowledgment messages

## Future Enhancements

### Planned Features

1. **Task Generation:** Convert flag commands to high-priority tasks
2. **Auto-Removal:** Remove flags when objectives completed
3. **Console Commands:** Management functions for listing/canceling
4. **Advanced Validation:** Distance checks, cost estimation, conflict detection
5. **Multi-Flag Coordination:** Combine flags for complex operations
6. **Flag Templates:** Predefined command combinations

### Integration Opportunities

- **Task System:** High-priority task generation from flags
- **Empire Planning:** Override expansion target selection
- **Defense System:** Priority defense zones
- **Remote Operations:** Automated remote room management

## Troubleshooting

### Flag Not Recognized

**Problem:** Flag placed but no command in Memory
**Solutions:**
- Verify primary color matches command type
- Check flag exists in `Game.flags`
- Review logs for parsing errors

### Invalid Command

**Problem:** Command marked invalid in Memory
**Solutions:**
- Check `validationReason` in Memory
- Verify prerequisites (creeps, GCL, energy)
- Ensure stable bot operations before placing flag

### No Visual Feedback

**Problem:** Flag command status not displayed
**Solutions:**
- Verify room visuals not disabled: Check `Memory.experimentalFeatures.roomVisuals !== false`
- Verify `showFlagCommands` config enabled (default: true)
- Check CPU budget not exhausted (visuals skip if CPU usage > 90%)

## Related Documentation

- [Runtime Architecture](./index.md) - System overview
- [Energy Economy](./energy-economy.md) - Energy management
- [Task System](./operations/task-system.md) - Task-based execution (future)

---

*Flag commands provide strategic control without code deployment, enabling real-time human-AI collaboration.*
