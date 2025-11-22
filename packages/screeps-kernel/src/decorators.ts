/**
 * Decorator-based process and protocol registration system.
 * Provides @process and @protocol decorators for automatic registration.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ProcessConfig, Process, ProtocolConfig } from "./types.js";
import { ProcessRegistry } from "./ProcessRegistry.js";
import { ProtocolRegistry } from "./ProtocolRegistry.js";

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

/**
 * Class decorator for registering a protocol mixin with the kernel.
 * Automatically registers the decorated class in the ProtocolRegistry.
 * Protocols are combined at runtime and attached to the ProcessContext.
 *
 * @example
 * ```typescript
 * @protocol({ name: 'MessageProtocol' })
 * export class MessageProtocol {
 *   sendMessage(target: string, message: string): void {
 *     // Protocol logic for sending messages
 *   }
 *   
 *   getMessages(target: string): string[] {
 *     // Protocol logic for retrieving messages
 *   }
 * }
 * ```
 *
 * @param config Protocol configuration
 * @returns Class decorator function
 */
export function protocol(config: ProtocolConfig) {
  return function <T extends new (...args: any[]) => any>(constructor: T): T {
    // Validate config
    if (!config.name || typeof config.name !== "string") {
      throw new Error("@protocol decorator requires a non-empty 'name' property");
    }

    // Register the protocol with the global registry
    const registry = ProtocolRegistry.getInstance();
    registry.register({
      name: config.name,
      constructor: constructor
    });

    // Return the original constructor
    return constructor;
  };
}
