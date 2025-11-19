/**
 * @ralphschuler/screeps-kernel
 *
 * Custom TypeScript kernel with decorator-based API for Screeps AI automation.
 * Inspired by screeps-microkernel patterns, designed for type safety and modularity.
 *
 * @example Basic Usage
 * ```typescript
 * import { Kernel, process, ProcessContext } from '@ralphschuler/screeps-kernel';
 *
 * // Define a process with decorator
 * @process({ name: 'MyProcess', priority: 100, singleton: true })
 * class MyProcess {
 *   run(ctx: ProcessContext): void {
 *     ctx.logger.log('Hello from MyProcess!');
 *   }
 * }
 *
 * // Bootstrap kernel
 * const kernel = new Kernel({ logger: console });
 * export const loop = () => kernel.run(Game, Memory);
 * ```
 */

// Core kernel
export { Kernel } from "./Kernel.js";

// Decorators
export { process } from "./decorators.js";

// Registry
export { ProcessRegistry } from "./ProcessRegistry.js";

// Context utilities
export { createProcessContext, NoOpLogger, NoOpMetricsCollector } from "./ProcessContext.js";

// Type definitions
export type {
  ProcessConfig,
  ProcessDescriptor,
  ProcessContext,
  Process,
  GameContext,
  Logger,
  MetricsCollector,
  KernelConfig
} from "./types.js";
