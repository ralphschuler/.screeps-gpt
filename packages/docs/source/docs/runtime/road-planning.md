# Automated Road Planning and Building System

## Overview

The automated road planning system analyzes creep traffic patterns and automatically plans, builds, and maintains road networks to optimize creep movement efficiency. This system can reduce energy costs for creep movement by up to 50% on roads compared to plain terrain.

## Architecture

The system consists of three main components coordinated by the `InfrastructureManager`:

### 1. TrafficManager

Tracks creep movements and identifies high-traffic routes:

- **Traffic Recording**: Monitors every creep movement position
- **Traffic Decay**: Gradually fades old traffic patterns (every 50 ticks by default)
- **High-Traffic Identification**: Identifies frequently-used paths above a threshold
- **Memory Persistence**: Stores traffic data efficiently in Memory

### 2. RoadPlanner

Plans optimal road networks based on traffic and room layout:

- **Path-Based Planning**: Connects key structures (spawns, sources, controllers)
- **Traffic-Based Planning**: Plans roads on high-traffic routes
- **Priority Calculation**: Assigns priority based on traffic volume
- **Repair Identification**: Identifies damaged roads needing repair

### 3. InfrastructureManager

Coordinates the road planning system:

- **Periodic Planning**: Plans roads every 100 ticks per room (configurable)
- **Traffic Decay**: Applies decay every 50 ticks (configurable)
- **CPU Budgeting**: Integrated into kernel with CPU guards
- **Memory Management**: Handles persistence and cleanup

## Configuration

The system is configured through the `InfrastructureManager`:

```typescript
const manager = new InfrastructureManager({
  logger: console,
  memory: Memory.infrastructure,
  roadPlanningInterval: 100, // Ticks between road planning
  trafficDecayInterval: 50, // Ticks between traffic decay
  maxRoadsPerTick: 1, // Max construction sites per tick
  enableTrafficAnalysis: true // Enable traffic tracking
});
```

## Integration

### Kernel Integration

The `InfrastructureManager` is integrated into the kernel run loop:

```typescript
// In kernel.ts
this.infrastructureManager.run(game);
```

The system runs after construction planning but before behavior execution, with CPU guards to prevent timeout.

### Task System Integration

Roads are automatically integrated with the task system:

- **Road Construction**: `BuildAction` handles road construction sites
- **Road Repair**: `RepairAction` prioritizes road repairs (NORMAL priority vs LOW for other structures)
- **Task Generation**: `TaskManager` generates up to 2 road repair tasks per tick

## Usage

### Traffic Recording

Traffic is automatically recorded when creeps move:

```typescript
// Automatic recording happens in kernel loop
creep.moveTo(target); // Movement is tracked automatically
```

### Manual Traffic Analysis

You can query traffic data for debugging or monitoring:

```typescript
// Get traffic at a specific position
const traffic = trafficManager.getTrafficAt(pos);

// Get high-traffic positions
const highTraffic = infrastructureManager.getHighTrafficPositions(threshold);
```

### Road Planning

Road planning happens automatically but can be customized:

```typescript
// Auto-plan roads based on room layout and traffic
const result = roadPlanner.autoPlaceRoads(room, game);

// Plan roads from high-traffic areas
const trafficPlans = roadPlanner.planRoadsFromTraffic(room, threshold);

// Identify roads needing repair
const damagedRoads = roadPlanner.identifyRepairNeeds(room, healthThreshold);

// Prioritize repairs by traffic
const prioritized = roadPlanner.prioritizeRepairs(damagedRoads);
```

## Memory Structure

The system uses the following Memory structure:

```typescript
Memory.infrastructure = {
  traffic: {
    movementRequests: {},
    trafficData: {
      "W1N1:25:25": { count: 42, lastUpdated: 12345 }
      // ... more positions
    }
  },
  roadPlanning: {
    lastPlanned: {
      W1N1: 12300 // Last tick roads were planned
      // ... more rooms
    }
  }
};
```

## Performance Considerations

### CPU Efficiency

The system is designed for minimal CPU impact:

- **Periodic Execution**: Road planning runs every 100 ticks per room
- **Rate Limiting**: Maximum 1 construction site per tick
- **CPU Guards**: Execution stops if CPU threshold exceeded
- **Efficient Storage**: Traffic data uses position keys for O(1) access

### Memory Optimization

Traffic data is automatically managed:

- **Decay System**: Old traffic patterns fade over time
- **Cleanup Threshold**: Positions with very low traffic are removed
- **Compact Storage**: Uses position keys instead of full objects

### Expected CPU Usage

- **Traffic Recording**: ~0.1 CPU per creep per tick
- **Traffic Decay**: ~0.5 CPU per 50 ticks (for 100 tracked positions)
- **Road Planning**: ~2-5 CPU per room per 100 ticks
- **Total**: <5% of CPU budget under normal conditions

## Monitoring

### Console Commands

Monitor the road planning system in-game:

```javascript
// Check traffic at a position
Memory.infrastructure.traffic.trafficData["W1N1:25:25"];

// View high-traffic positions
const mgr = Game.kernel.infrastructureManager;
const highTraffic = mgr.getHighTrafficPositions(10);
console.log(JSON.stringify(highTraffic));

// Check when roads were last planned
Memory.infrastructure.roadPlanning.lastPlanned;
```

### Visual Debugging

Traffic patterns can be visualized using room visuals:

```javascript
// In console
const mgr = Game.kernel.infrastructureManager;
const highTraffic = mgr.getHighTrafficPositions(10);
for (const { pos, count } of highTraffic) {
  const room = Game.rooms[pos.roomName];
  if (room) {
    room.visual.circle(pos, {
      radius: 0.5,
      fill: "transparent",
      stroke: "#ff0000",
      strokeWidth: 0.1 * (count / 10), // Thicker lines for higher traffic
      opacity: 0.7
    });
    room.visual.text(`${count}`, pos.x, pos.y - 0.5, {
      color: "#ff0000",
      font: 0.4
    });
  }
}
```

## Troubleshooting

### Roads Not Being Built

1. **Check Planning Interval**: Ensure enough ticks have passed since last planning
2. **Check Construction Sites**: Maximum 100 construction sites per player
3. **Check CPU Usage**: High CPU usage may skip infrastructure planning
4. **Check Room Ownership**: Only owned rooms get road planning

### High Memory Usage

1. **Check Traffic Data Size**: Use `Object.keys(Memory.infrastructure.traffic.trafficData).length`
2. **Adjust Decay Rate**: Increase `trafficDecayRate` to fade traffic faster
3. **Adjust Cleanup Threshold**: Increase `trafficCleanupThreshold` to remove low-traffic positions sooner

### Roads Not Being Repaired

1. **Check Task System**: Ensure task system is operational
2. **Check Builder Creeps**: Ensure builders with WORK parts exist
3. **Check Health Threshold**: Default is 80%, adjust if needed
4. **Check Priority**: Roads get NORMAL priority, may be delayed by HIGH priority tasks

## Future Enhancements

Potential improvements for the road planning system:

1. **Remote Room Support**: Extend to plan roads in remote mining rooms
2. **Inter-Room Routes**: Plan highways between owned rooms
3. **Traffic Prediction**: Use historical data to predict future traffic patterns
4. **Dynamic Planning**: Adjust planning interval based on room activity
5. **Visual Debugging**: Built-in room visual support for traffic heatmaps
6. **Statistics**: Track road usage, construction costs, and efficiency gains

## Related Documentation

- [Task System Architecture](./task-system.md)
- [Construction Management](./construction-management.md)
- [CPU Optimization Strategies](./operations/cpu-optimization-strategies.md)
- [Memory Management](./memory-management.md)
