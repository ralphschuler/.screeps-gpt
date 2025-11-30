# Packages Documentation Guide

This directory contains the core packages for the Screeps GPT AI system. This guide defines the TSDoc/JSDoc documentation standards for all TypeScript source files.

## Package Overview

| Package             | Purpose                        | Priority |
| ------------------- | ------------------------------ | -------- |
| `bot/`              | Core Screeps AI implementation | High     |
| `screeps-kernel/`   | Runtime kernel and scheduling  | High     |
| `screeps-agent/`    | Autonomous development agent   | High     |
| `screeps-mcp/`      | MCP server integration         | High     |
| `utilities/`        | Build and deployment scripts   | High     |
| `screeps-async/`    | Async task management          | Medium   |
| `screeps-cache/`    | Caching utilities              | Medium   |
| `screeps-metrics/`  | Performance metrics collection | Medium   |
| `screeps-profiler/` | CPU profiler                   | Medium   |
| `screeps-logger/`   | Logging infrastructure         | Medium   |
| `screeps-events/`   | Event bus and handlers         | Medium   |
| `screeps-swarm-bot/`| Swarm-intelligence bot scaffold| Medium   |
| `screeps-xstate/`   | State machine implementation   | Lower    |
| `screeps-xtree/`    | Behavior tree library          | Lower    |
| `screeps-tasks/`    | Task management system         | Lower    |
| `pserver/`          | Private server configuration   | Lower    |
| `console/`          | Console commands               | Lower    |
| `dashboard/`        | Dashboard UI                   | Lower    |
| `docs/`             | Hexo documentation site        | Lower    |

## TSDoc/JSDoc Standards

All exported classes, interfaces, types, and functions **must** have TSDoc comments. This ensures:

- Better IDE IntelliSense and autocomplete
- Easier onboarding for new contributors
- Self-documenting code that reduces tribal knowledge
- Automated API documentation generation

### Basic Template

````typescript
/**
 * Brief one-line description of the class/function.
 *
 * Detailed explanation of purpose, behavior, and usage context.
 * Include any important notes about side effects or constraints.
 *
 * @example
 * ```typescript
 * const instance = new MyClass();
 * instance.doSomething();
 * ```
 *
 * @param paramName - Parameter description
 * @returns Description of return value
 * @throws {ErrorType} When specific error condition occurs
 * @see RelatedClass for related functionality
 */
````

### Required Documentation Elements

#### Classes

Document purpose, responsibilities, and usage patterns:

```typescript
/**
 * Manages bootstrap phase detection and completion for first-room resource optimization.
 * Bootstrap phase prioritizes harvester spawning to quickly establish energy infrastructure.
 *
 * Entry Conditions:
 * - No bootstrap flag exists in Memory (first run)
 * - Room has minimal infrastructure (controller level < 2)
 *
 * Exit Conditions:
 * - Controller reaches target level (default: 2)
 * - Sufficient harvesters exist (default: 4)
 * - Energy infrastructure is stable (extensions available and filled)
 */
export class BootstrapPhaseManager {
  // ...
}
```

#### Methods

Document behavior, parameters, return values, and side effects:

```typescript
/**
 * Validates Game object at runtime to ensure it conforms to GameContext interface.
 * Replaces unsafe type casting with explicit runtime validation.
 *
 * @param game - Game object from Screeps API
 * @returns Validated GameContext object
 * @throws {TypeError} if Game object is missing required properties
 */
function validateGameContext(game: Game): GameContext {
  // ...
}
```

#### Interfaces and Types

Document structure purpose and field descriptions:

```typescript
/**
 * Configuration for bootstrap phase detection.
 * Controls when the initial resource gathering phase ends.
 */
export interface BootstrapConfig {
  /** Controller level required to exit bootstrap phase (default: 2) */
  targetControllerLevel?: number;
  /** Minimum harvester count required to exit bootstrap (default: 4) */
  minHarvesterCount?: number;
  /** Minimum energy available to consider room stable (default: 300) */
  minEnergyAvailable?: number;
}
```

#### Complex Logic

Add inline comments explaining non-obvious algorithms:

```typescript
// Check CPU budget before executing each process
// This prevents the bot from exceeding the CPU limit and losing ticks
if (game.cpu.getUsed() > game.cpu.limit * this.cpuEmergencyThreshold) {
  this.logger.warn?.(`[Kernel] CPU threshold exceeded, skipping remaining processes`);
  break;
}
```

### Documentation Tags Reference

| Tag           | Usage                                    |
| ------------- | ---------------------------------------- |
| `@param`      | Document function/method parameters      |
| `@returns`    | Document return value                    |
| `@throws`     | Document exceptions that can be thrown   |
| `@example`    | Provide usage examples                   |
| `@see`        | Reference related classes/functions      |
| `@deprecated` | Mark deprecated code with migration path |
| `@internal`   | Mark internal APIs not for external use  |
| `@public`     | Explicitly mark public APIs              |
| `@readonly`   | Mark read-only properties                |
| `@default`    | Document default parameter values        |
| `@template`   | Document generic type parameters         |

### Style Guidelines

1. **Be concise**: First line should be a brief summary under 80 characters
2. **Use active voice**: "Validates the game object" not "The game object is validated"
3. **Document the "why"**: Explain non-obvious design decisions
4. **Include examples**: For complex or frequently-used APIs
5. **Keep it updated**: Update docs when behavior changes
6. **No redundant comments**: Don't state the obvious (e.g., `/** Gets the name */` for `getName()`)

### What NOT to Document

- Private helper functions with obvious behavior
- Simple getters/setters without side effects
- Internal implementation details that may change
- Already well-documented library usage

## ESLint Validation

The repository uses `eslint-plugin-jsdoc` to enforce documentation standards:

```javascript
// eslint.config.mjs
{
  rules: {
    'jsdoc/require-jsdoc': ['warn', {
      require: {
        FunctionDeclaration: true,
        ClassDeclaration: true,
        MethodDefinition: false  // Only public methods
      },
      publicOnly: true
    }],
    'jsdoc/require-description': 'warn',
    'jsdoc/require-param-description': 'warn',
    'jsdoc/require-returns-description': 'warn'
  }
}
```

The rules are set to `warn` to allow incremental adoption without blocking PRs.

## API Documentation Generation

TypeDoc can generate browsable API documentation from TSDoc comments:

```bash
# Generate API docs (when configured)
yarn docs:api

# Output goes to docs/api/
```

## Related Documentation

- [`AGENTS.md`](../AGENTS.md) - Agent guidelines with code documentation standards
- [`DOCS.md`](../DOCS.md) - Developer guide
- [`packages/docs/`](./docs/) - Hexo documentation site
