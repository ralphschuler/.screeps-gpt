/**
 * Type-safe execution context implementation.
 * Wraps game state, memory, logger, and metrics for process execution.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ProcessContext, GameContext, Logger, MetricsCollector } from "./types.js";

/**
 * Default no-op logger implementation.
 */
export class NoOpLogger implements Logger {
  public log(_message: string): void {}
  public warn(_message: string): void {}
  public error(_message: string): void {}
}

/**
 * Default no-op metrics collector implementation.
 */
export class NoOpMetricsCollector implements MetricsCollector {
  public record(_name: string, _value: number): void {}
  public begin(_name: string): void {}
  public end(_name: string): void {}
}

/**
 * Create a type-safe process context.
 * @param game Game state interface
 * @param memory Memory reference (typed via generics)
 * @param logger Logger instance (optional, defaults to no-op)
 * @param metrics Metrics collector instance (optional, defaults to no-op)
 * @returns Type-safe process context
 */
export function createProcessContext<TMemory = any>(
  game: GameContext,
  memory: TMemory,
  logger?: Logger,
  metrics?: MetricsCollector
): ProcessContext<TMemory> {
  return {
    game,
    memory,
    logger: logger ?? new NoOpLogger(),
    metrics: metrics ?? new NoOpMetricsCollector()
  };
}
