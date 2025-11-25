---
title: User Controls
date: 2025-11-25
category: runtime
tags:
  - user-controls
  - flag-commands
  - console
  - runtime
---

# User Controls

This guide explains how to interact with and control the Screeps bot without code changes.

## Overview

The bot provides several user-facing control mechanisms:

1. **Flag Commands** - Strategic directives via in-game flags
2. **Console Commands** (future) - Direct bot control via game console
3. **Memory Flags** - Runtime configuration via Memory object

## Flag Commands

**Purpose:** Direct bot behavior through visual flag placement in the game world.

**Quick Start:**
1. Place a flag in the game using the flag tool
2. Set primary color for command type (Red=Attack, Blue=Claim, etc.)
3. Set secondary color for priority (Red=High, Orange=Medium, White=Low)
4. Bot will parse and validate the command each tick
5. Visual feedback shows command status near the flag

**See:** [Flag Commands Documentation](./flag-commands.md) for detailed reference.

### Common Use Cases

#### Claiming a New Room

```
1. Scout nearby rooms to find expansion target
2. Place flag with Blue primary, Red secondary near controller
3. Wait for bot to spawn claimer and claim controller
4. Remove flag once room is claimed
```

#### Remote Mining Setup

```
1. Identify remote room with energy sources
2. Place flag with Green primary, Orange secondary near source
3. Bot will assign haulers to transport energy
4. Flag persists to maintain mining operation
```

#### Attack Coordination

```
1. Choose hostile target (structure or room)
2. Place flag with Red primary, Red secondary on target
3. Bot dispatches attack creeps to location
4. Remove flag to cease attack
```

## Memory Configuration

**Purpose:** Runtime configuration without code deployment.

### Experimental Features

Enable/disable features via Memory:

```javascript
// Enable experimental features
Memory.experimentalFeatures = {
  roomVisuals: true,    // Enable room visual overlays (default: true)
  // Add future experimental features here
};

// Disable specific feature
Memory.experimentalFeatures.roomVisuals = false;
```

### Manual Overrides

Temporarily override bot behavior:

```javascript
// Force bootstrap mode off
Memory.bootstrap.isActive = false;

// Disable specific room operations
Memory.rooms['W1N1'].skipDefense = true;
```

**⚠️ Warning:** Manual Memory edits may conflict with bot logic. Use sparingly and document changes.

## Console Commands (Future)

Planned console commands for direct bot control:

### Flag Management

```javascript
// List all active flag commands
listFlags()
// Output: [{name: "ClaimW2N1", type: "CLAIM", status: "VALID"}]

// Get details on specific flag
explainFlag("ClaimW2N1")
// Output: Command type, prerequisites, validation status

// Cancel flag command
cancelFlag("ClaimW2N1")
// Output: Command removed, flag deleted

// Show flag command help
flagHelp()
// Output: Available commands and color conventions
```

### Room Management

```javascript
// Get room status
roomStatus("W1N1")
// Output: Energy, creeps, structures, health score

// Force room action
claimRoom("W2N1")    // Spawn claimer and claim
expandRoom("W2N1")   // Colonize room
abandonRoom("W2N1")  // Unclaim and evacuate
```

### Creep Management

```javascript
// List creeps by role
listCreeps("harvester")
// Output: [{name: "harvester1", role: "harvester", room: "W1N1"}]

// Reassign creep role
reassignCreep("builder1", "repairer")

// Suicide creep (emergency cleanup)
suicideCreep("stuck_creep")
```

## Best Practices

### Flag Usage

1. **Use descriptive names**: `ClaimW2N1` not `Flag1`
2. **Remove completed flags**: Keep flag list clean
3. **Check validation**: Look for visual feedback before expecting action
4. **Test in safe areas**: Verify bot behavior before critical operations

### Memory Safety

1. **Backup before edits**: `JSON.stringify(Memory)` to console
2. **Small incremental changes**: Test one change at a time
3. **Document overrides**: Add comments or track in separate file
4. **Revert if issues**: Keep known-good Memory state

### Console Commands

1. **Use help commands**: `flagHelp()`, `help()` to discover features
2. **Verify before execution**: Check command parameters
3. **Monitor results**: Watch for expected behavior changes
4. **Report bugs**: Document unexpected command behavior

## Limitations

### Current Limitations

- **No task generation**: Flags store commands but don't yet create high-priority tasks
- **Manual flag removal**: Bot doesn't auto-delete completed command flags
- **Limited validation**: Prerequisites are basic checks
- **No console commands**: Direct console control not yet implemented

### Security Considerations

- **Flags are public**: All players see your flags - avoid revealing strategy
- **Memory is private**: Memory edits are safe from other players
- **Console is private**: Future console commands won't reveal information

## Troubleshooting

### Flag Not Working

1. Check visual feedback near flag for validation errors
2. Verify bot has required creeps/resources (check Memory.flagCommands)
3. Ensure flag colors match documented conventions
4. Review console logs for flag interpretation messages

### Memory Changes Reverted

1. Bot may overwrite manual edits - check process code
2. Global reset clears Memory - flags/code persist
3. Some Memory fields managed by specific processes

### Unexpected Behavior

1. Check recent flag placements for conflicts
2. Review Memory for manual overrides
3. Monitor console logs for errors
4. Remove test flags that might be active

## Related Documentation

- [Flag Commands](./flag-commands.md) - Comprehensive flag system reference
- [Runtime Architecture](./index.md) - System overview
- [Operations](./operations/) - Advanced bot management

---

*User controls enable strategic oversight without code deployment, combining the best of human decision-making with autonomous execution.*
