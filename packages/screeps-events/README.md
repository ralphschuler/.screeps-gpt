# @ralphschuler/screeps-events

Event propagation system for inter-component communication in Screeps.

## Features

- **Type-safe**: Full TypeScript support with typed events
- **Lightweight**: Minimal overhead (<0.05 CPU per event)
- **Error isolation**: Handler errors don't crash other handlers
- **Synchronous**: Handlers execute immediately
- **In-memory**: No Memory persistence (ephemeral per tick)
- **Minimal API**: Subscribe, emit, clear - no complex patterns

## Installation

```bash
yarn add @ralphschuler/screeps-events
```

## Usage

### Basic Event Bus

```typescript
import { EventBus, EventTypes } from "@ralphschuler/screeps-events";

// Create event bus instance
const eventBus = new EventBus();

// Subscribe to events
const unsubscribe = eventBus.subscribe(EventTypes.CREEP_SPAWNED, event => {
  console.log(`Creep ${event.data.creepName} spawned in ${event.data.spawnName}`);
});

// Emit events
eventBus.emit(
  EventTypes.CREEP_SPAWNED,
  {
    creepName: "Harvester1",
    role: "harvester",
    spawnName: "Spawn1"
  },
  "SpawnManager"
);

// Unsubscribe when done
unsubscribe();
```

### Using EventEmitter Base Class

```typescript
import { EventEmitter, EventTypes } from "@ralphschuler/screeps-events";

class TowerManager extends EventEmitter {
  run(tower: StructureTower): void {
    if (tower.store.energy === 0) {
      this.emitEvent(EventTypes.ENERGY_DEPLETED, {
        roomName: tower.room.name,
        structureType: STRUCTURE_TOWER,
        structureId: tower.id
      });
    }
  }
}

// Initialize with event bus
const towerManager = new TowerManager(eventBus);
```

### Type-Safe Event Handling

```typescript
import type { CreepSpawnedEvent } from "@ralphschuler/screeps-events";

eventBus.subscribe<CreepSpawnedEvent>(EventTypes.CREEP_SPAWNED, event => {
  // event.data is typed as CreepSpawnedEvent
  const { creepName, role, spawnName } = event.data;
  console.log(`${role} ${creepName} spawned in ${spawnName}`);
});
```

### Integration with Runtime

```typescript
// In main.ts or kernel initialization
import { EventBus } from "@ralphschuler/screeps-events";

export const globalEventBus = new EventBus();

// Pass to managers
class BehaviorController {
  constructor(private eventBus: EventBus) {
    // Subscribe to events
    this.eventBus.subscribe(EventTypes.HOSTILE_DETECTED, event => {
      this.handleHostileDetection(event.data);
    });
  }
}
```

## API Reference

### EventBus

**`subscribe<T>(eventType: string, handler: EventHandler<T>): UnsubscribeFunction`**

Subscribe to events of a specific type. Returns an unsubscribe function.

**`emit<T>(eventType: string, data: T, source?: string): void`**

Emit an event to all subscribed handlers.

**`clear(eventType?: string): void`**

Clear handlers for a specific event type or all events.

**`getHandlerCount(eventType: string): number`**

Get the number of handlers subscribed to an event type.

**`getEventTypes(): string[]`**

Get all registered event types.

### EventEmitter

**`emitEvent<T>(eventType: string, data: T, source?: string): void`**

Protected method for subclasses to emit events through the event bus.

### Built-in Event Types

- `EventTypes.CREEP_SPAWNED` - Creep spawned
- `EventTypes.CREEP_DIED` - Creep died
- `EventTypes.ENERGY_DEPLETED` - Energy depleted in structure
- `EventTypes.ENERGY_RESTORED` - Energy restored in structure
- `EventTypes.HOSTILE_DETECTED` - Hostile detected in room
- `EventTypes.CONTROLLER_UPGRADE` - Controller upgraded
- `EventTypes.CONSTRUCTION_STARTED` - Construction started
- `EventTypes.CONSTRUCTION_COMPLETED` - Construction completed

## Design Decisions

### In-Memory Only

Events are not persisted to Memory. They are ephemeral and only exist for the current tick. This keeps the event system lightweight and avoids Memory overhead.

### Synchronous Execution

Event handlers execute synchronously when events are emitted. This ensures predictable execution order and simplifies debugging.

### Error Isolation

If an event handler throws an error, it is caught and logged, but other handlers continue to execute. This prevents one faulty handler from crashing the entire event system.

### CPU Efficiency

The event system is optimized for minimal CPU overhead:

- Simple Map-based handler storage
- No async operations or queuing
- Lightweight event object creation
- Target: <0.05 CPU per event emission

## Use Cases

1. **Spawn Events**: Notify analytics when creeps spawn/die
2. **Energy Alerts**: Coordinate energy distribution across managers
3. **Defense Coordination**: Tower/rampart managers react to hostile detection
4. **Infrastructure Milestones**: Emit events for construction completion
5. **Telemetry Collection**: Stats collector subscribes to all events for monitoring

## License

MIT
