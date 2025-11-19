# @ralphschuler/screeps-logger

Structured logger with timestamp support for Screeps runtime.

## Features

- ✅ Structured logging with configurable levels
- ✅ Timestamp support using Game.time
- ✅ Context attachment for rich log entries
- ✅ Child loggers with inherited context
- ✅ Configurable output formatting
- ✅ TypeScript strict mode
- ✅ Deterministic output for testing

## Installation

```bash
npm install @ralphschuler/screeps-logger
```

## Quick Start

```typescript
import { Logger } from "@ralphschuler/screeps-logger";

const logger = new Logger();

logger.info("Spawning creep");
logger.warn("Low energy", { room: "W1N1", energy: 100 });
logger.error("Spawn failed", { error: "ERR_NOT_ENOUGH_ENERGY" });
```

## Log Levels

The logger supports four log levels in order of severity:

- `debug` - Detailed debugging information
- `info` - General informational messages (default minimum)
- `warn` - Warning messages
- `error` - Error messages

## Configuration

### Minimum Log Level

Filter logs by setting a minimum level:

```typescript
// Only log warnings and errors
const logger = new Logger({ minLevel: "warn" });

logger.debug("Not shown");
logger.info("Not shown");
logger.warn("Shown");
logger.error("Shown");
```

### Formatting Options

Control the output format:

```typescript
const logger = new Logger({
  includeTimestamp: false, // Hide timestamps
  includeLevel: false // Hide level prefix
});

logger.info("Clean message");
// Output: Clean message
```

Default output format:

```typescript
logger.info("Message", { key: "value" });
// Output: [12345] [INFO] Message {"key":"value"}
```

## Context

### Adding Context

Add structured data to log entries:

```typescript
logger.info("Creep spawned", {
  creepName: "Harvester1",
  room: "W1N1",
  cost: 300
});
// Output: [12345] [INFO] Creep spawned {"creepName":"Harvester1","room":"W1N1","cost":300}
```

### Child Loggers

Create child loggers with inherited context:

```typescript
const roomLogger = logger.child({ room: "W1N1" });

roomLogger.info("Energy harvested", { amount: 50 });
// Output: [12345] [INFO] Energy harvested {"room":"W1N1","amount":50}

roomLogger.warn("Low energy", { current: 100, needed: 300 });
// Output: [12346] [WARN] Low energy {"room":"W1N1","current":100,"needed":300}
```

Child context is merged with per-log context:

```typescript
const creepLogger = roomLogger.child({ creep: "Harvester1" });

creepLogger.debug("Moving to source", { sourceId: "abc123" });
// Output: [12347] [DEBUG] Moving to source {"room":"W1N1","creep":"Harvester1","sourceId":"abc123"}
```

## Usage Examples

### Basic Room Logger

```typescript
import { Logger } from "@ralphschuler/screeps-logger";

export function runRoom(room: Room): void {
  const logger = new Logger().child({ room: room.name });

  logger.info("Processing room");

  if (room.energyAvailable < 300) {
    logger.warn("Low energy", { available: room.energyAvailable });
  }

  logger.info("Room processed");
}
```

### Spawn Manager with Logging

```typescript
import { Logger } from "@ralphschuler/screeps-logger";

export class SpawnManager {
  private readonly logger: Logger;

  public constructor(spawnName: string) {
    this.logger = new Logger().child({ spawn: spawnName });
  }

  public spawnCreep(role: string, body: BodyPartConstant[]): void {
    const spawn = Game.spawns[spawnName];
    const result = spawn.spawnCreep(body, `${role}_${Game.time}`);

    if (result === OK) {
      this.logger.info("Creep spawned", { role, bodySize: body.length });
    } else {
      this.logger.error("Spawn failed", { role, error: result });
    }
  }
}
```

### Debug Logging

```typescript
// Development mode - show all logs
const logger = new Logger({ minLevel: "debug" });

logger.debug("Pathfinding calculation", {
  from: { x: 25, y: 25 },
  to: { x: 35, y: 15 },
  cost: 125
});

// Production mode - only warnings and errors
const logger = new Logger({ minLevel: "warn" });
```

### Testing Support

The logger accepts a custom console implementation for testing:

```typescript
import { Logger } from "@ralphschuler/screeps-logger";

const mockConsole = { log: vi.fn() };
const logger = new Logger({}, mockConsole);

logger.info("Test message");

expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining("[INFO] Test message"));
```

## API Reference

### Logger

#### Constructor

```typescript
new Logger(options?: LoggerOptions, consoleImpl?: Pick<Console, "log">)
```

- `options` - Configuration options
- `consoleImpl` - Custom console implementation (for testing)

#### Methods

```typescript
logger.debug(message: string, context?: Record<string, unknown>): void
logger.info(message: string, context?: Record<string, unknown>): void
logger.warn(message: string, context?: Record<string, unknown>): void
logger.error(message: string, context?: Record<string, unknown>): void
logger.log(level: LogLevel, message: string, context?: Record<string, unknown>): void
logger.child(context: Record<string, unknown>): Logger
```

### LoggerOptions

```typescript
interface LoggerOptions {
  minLevel?: LogLevel; // Default: "info"
  includeTimestamp?: boolean; // Default: true
  includeLevel?: boolean; // Default: true
}
```

### LogLevel

```typescript
type LogLevel = "debug" | "info" | "warn" | "error";
```

### LogEntry

```typescript
interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}
```

## Best Practices

1. **Use child loggers** for component-specific logging with consistent context
2. **Set appropriate log levels** in production to reduce CPU usage
3. **Include relevant context** to make logs more useful for debugging
4. **Use semantic log levels** - debug for detailed traces, info for normal operations, warn for issues, error for failures
5. **Keep messages concise** and put details in context objects

## Performance

The logger is designed for minimal CPU overhead:

- Level filtering happens before formatting
- Timestamps use `Game.time` (constant per tick) when available
- Context serialization only occurs for logged messages
- No external dependencies

## License

MIT © OpenAI Automations
