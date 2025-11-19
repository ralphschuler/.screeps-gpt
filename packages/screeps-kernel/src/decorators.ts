/**
 * Decorator-based process registration system.
 * Provides @process decorator for automatic process registration.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ProcessConfig, Process } from "./types.js";
import { ProcessRegistry } from "./ProcessRegistry.js";

/**
 * Class decorator for registering a process with the kernel.
 * Automatically registers the decorated class in the ProcessRegistry.
 *
 * @example
 * ```typescript
 * @process({ name: 'BehaviorController', priority: 50, singleton: true })
 * export class BehaviorController implements Process {
 *   run(ctx: ProcessContext): void {
 *     // Process logic
 *   }
 * }
 * ```
 *
 * @param config Process configuration
 * @returns Class decorator function
 */
export function process(config: ProcessConfig) {
  return function <T extends new (...args: any[]) => Process>(constructor: T): T {
    // Validate config
    if (!config.name || typeof config.name !== "string") {
      throw new Error("@process decorator requires a non-empty 'name' property");
    }
    if (typeof config.priority !== "number") {
      throw new Error("@process decorator requires a numeric 'priority' property");
    }

    // Register the process with the global registry
    const registry = ProcessRegistry.getInstance();
    registry.register({
      name: config.name,
      priority: config.priority,
      singleton: config.singleton ?? false,
      constructor: constructor as new () => Process
    });

    // Return the original constructor
    return constructor;
  };
}
