# Creep Communication System

The creep communication system provides visual feedback for creep actions using `creep.say()` and room visuals. This helps with debugging, monitoring, and understanding bot behavior directly in the Screeps game client.

## Overview

The `CreepCommunicationManager` provides configurable visual communication for creeps:

- **Visual Indicators**: Emoji-based action feedback using `creep.say()`
- **Room Visuals**: Optional lines and circles showing task goals
- **CPU Management**: Built-in CPU budget tracking to minimize overhead
- **Configurable Verbosity**: Four levels from disabled to verbose
- **Runtime Configuration**: Toggle via Memory without redeployment

## Configuration

### Verbosity Levels

| Level      | Description        | Behavior                        |
| ---------- | ------------------ | ------------------------------- |
| `disabled` | No communication   | Creeps don't say anything       |
| `minimal`  | Critical info only | Role and error states only      |
| `normal`   | Standard feedback  | Actions with emojis (default)   |
| `verbose`  | Detailed feedback  | Actions with additional context |

### Memory Configuration

Configure via `Memory.creepCommunication`:

```typescript
// In Screeps console
Memory.creepCommunication = {
  verbosity: "normal", // or "disabled", "minimal", "verbose"
  enableRoomVisuals: false // Enable visual lines/circles
};
```

### Build-Time Configuration

Configure via `BehaviorController` options in `src/main.ts`:

```typescript
const kernel = createKernel({
  behavior: new BehaviorController({
    enableCreepCommunication: true // Master toggle
    // ... other options
  })
});
```

## Visual Indicators

### Action Emojis

| Action  | Emoji | Roles                                       |
| ------- | ----- | ------------------------------------------- |
| Harvest | ⛏️    | harvester, remoteMiner, stationaryHarvester |
| Deliver | 📦    | harvester, remoteMiner, hauler              |
| Upgrade | ⚡    | harvester, upgrader                         |
| Build   | 🔨    | builder                                     |
| Repair  | 🔧    | builder                                     |
| Gather  | 🔍    | builder, upgrader                           |
| Travel  | 🚶    | remoteMiner, stationaryHarvester            |
| Pickup  | 📥    | hauler                                      |
| Full    | ✅    | All (when store is full)                    |
| Empty   | 🔋    | All (when store is empty)                   |
| Stuck   | ❌    | All (when creep.memory.stuck)               |
| Error   | ⚠️    | All (general errors)                        |

### Room Visuals

When `enableRoomVisuals: true`:

- **Task Lines**: Dashed lines from creep to target
- **Target Circles**: Circle indicators at task destinations
- **Custom Colors**: Color-coded by task type

## Usage Examples

### Basic Setup

Communication is enabled by default with `normal` verbosity. Creeps will automatically display their current actions.

### Disable in Production

```javascript
// Disable communication to save CPU
Memory.creepCommunication = { verbosity: "disabled" };
```

### Enable Verbose Mode for Debugging

```javascript
// Show detailed information
Memory.creepCommunication = {
  verbosity: "verbose",
  enableRoomVisuals: true
};
```

### Minimal Mode for High Creep Count

```javascript
// Reduce visual clutter
Memory.creepCommunication = { verbosity: "minimal" };
```

## Role-Specific Communication

### Harvester

- `⛏️` - Mining from source
- `📦` - Delivering to spawns/extensions/containers
- `⚡` - Upgrading controller (fallback)
- `✅` - Storage full

### Upgrader

- `🔍` - Gathering energy from containers/storage
- `⚡` - Upgrading controller

### Builder

- `🔍` - Gathering energy
- `🔨` - Building construction sites
- `🔧` - Repairing damaged structures

### Remote Miner

- `🚶` - Traveling to remote room
- `⛏️` - Mining in remote room
- `📦` - Returning and delivering energy

### Stationary Harvester

- `🚶` - Moving to source position
- `⛏️` - Harvesting at stationary position

### Hauler

- `📥` - Picking up energy from containers
- `📦` - Delivering to spawns/extensions/towers

## CPU Impact

### Performance Characteristics

- **Default CPU Budget**: 0.1 CPU per tick
- **Per-Call Cost**: ~0.002-0.005 CPU per say()
- **Typical Overhead**: <1% with 50 creeps
- **Room Visuals**: Additional 0.01-0.02 CPU per visual

### CPU Monitoring

Access CPU usage statistics:

```javascript
// In console (requires access to manager instance)
const stats = communicationManager.getCpuUsage();
console.log(`Communication CPU: ${stats.used.toFixed(3)}/${stats.budget} (${stats.percentage.toFixed(1)}%)`);
```

### Optimization Tips

1. **Disable in Production**: Set `verbosity: "disabled"` for high-performance scenarios
2. **Minimal Mode**: Use `minimal` verbosity for essential feedback only
3. **Room Visuals**: Keep `enableRoomVisuals: false` unless actively debugging
4. **Per-Role**: Consider per-role communication if needed (future enhancement)

## Implementation Details

### Architecture

```
BehaviorController
  └─ CreepCommunicationManager (singleton)
       ├─ Configuration (Memory.creepCommunication)
       ├─ CPU Tracking (per-tick budget)
       └─ Emoji Mapping (action → emoji)

Role Functions (runHarvester, etc.)
  └─ getComm() → communicationManager.say()
```

### Integration Points

Communication is integrated into:

- `src/runtime/behavior/BehaviorController.ts` - Role execution
- `src/runtime/behavior/CreepCommunicationManager.ts` - Core manager
- `types.d.ts` - Memory configuration types

### Code Example

```typescript
// In role behavior function
const comm = getComm();

// Basic action
comm?.say(creep, "harvest");

// With additional text (verbose mode)
comm?.say(creep, "deliver", "spawn");

// Resource status
comm?.sayResourceStatus(creep, true, 75); // "✅ 75%"

// Error state
comm?.sayError(creep, "pathfind");

// Room visual (if enabled)
comm?.drawTaskGoal(creep, target.pos, "#00ff00");
```

## Troubleshooting

### Creeps Not Saying Anything

1. Check `Memory.creepCommunication.verbosity` is not `"disabled"`
2. Verify `BehaviorController` has `enableCreepCommunication: true`
3. Ensure you're using the role-based system (not task system)

### High CPU Usage

1. Disable room visuals: `enableRoomVisuals: false`
2. Reduce verbosity: `verbosity: "minimal"`
3. Check CPU budget: Increase if needed via manager config

### Messages Cut Off

Messages are truncated to 10 characters (Screeps API limit). Use `verbose` mode only when needed.

## Future Enhancements

Potential improvements tracked in issue #[your-issue-number]:

- Per-role communication configuration
- Task system integration (#478)
- Advanced room visual patterns
- Communication statistics dashboard
- Dynamic CPU budget adjustment

## Related Documentation

- [Behavior System](./behavior-system.md)
- [Task System](./task-system.md)
- [CPU Optimization](../performance/cpu-optimization.md)
- [Memory Management](../memory/overview.md)
