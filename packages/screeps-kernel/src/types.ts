/**
 * Core type definitions for the custom TypeScript kernel.
 * Provides interfaces for process configuration, context, and lifecycle.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Configuration for a process registered via @process decorator.
 */
export interface ProcessConfig {
  /** Unique name for the process */
  name: string;
  /** Execution priority (higher values run first) */
  priority: number;
  /** If true, only one instance of this process will be created and reused */
  singleton?: boolean;
}

/**
 * Internal descriptor for a registered process.
 */
export interface ProcessDescriptor<TMemory = any> {
  /** Unique name for the process */
  name: string;
  /** Execution priority (higher values run first) */
  priority: number;
  /** If true, only one instance exists */
  singleton: boolean;
  /** Constructor function for the process */
  constructor: new () => Process<TMemory>;
  /** Cached singleton instance (if singleton is true) */
  instance?: Process<TMemory>;
}

/**
 * Generic type-safe execution context passed to processes.
 * TMemory allows compile-time type checking for memory structures.
 * TProtocol allows compile-time type checking for protocol methods.
 */
export interface ProcessContext<TMemory = any, TProtocol = any> {
  /** Game state interface */
  game: GameContext;
  /** Type-safe memory reference */
  memory: TMemory;
  /** Logger interface for diagnostic output */
  logger: Logger;
  /** Metrics collector for performance tracking */
  metrics: MetricsCollector;
  /** Type-safe protocol interface for inter-process communication */
  protocol: TProtocol;
}

/**
 * Minimal GameContext interface for kernel independence.
 * Processes should import full GameContext from runtime if needed.
 */
export interface GameContext {
  /** Current game tick */
  time: number;
  /** CPU tracking interface */
  cpu: {
    getUsed(): number;
    limit: number;
    bucket: number;
  };
  /** Creeps indexed by name */
  creeps: Record<string, any>;
  /** Spawns indexed by name */
  spawns: Record<string, any>;
  /** Rooms indexed by name */
  rooms: Record<string, any>;
}

/**
 * Logger interface for diagnostic output.
 */
export interface Logger {
  log?(message: string): void;
  warn?(message: string): void;
  error?(message: string): void;
}

/**
 * Metrics collector interface for performance tracking.
 */
export interface MetricsCollector {
  /** Record a metric value */
  record(name: string, value: number): void;
  /** Begin tracking a duration */
  begin(name: string): void;
  /** End tracking a duration */
  end(name: string): void;
}

/**
 * Process interface that all decorated processes must implement.
 * Generic TMemory allows type-safe memory access.
 * Generic TProtocol allows type-safe protocol access.
 */
export interface Process<TMemory = any, TProtocol = any> {
  /**
   * Execute the process for one tick.
   * @param ctx Type-safe execution context
   */
  run(ctx: ProcessContext<TMemory, TProtocol>): void;
}

/**
 * Configuration for a protocol registered via @protocol decorator.
 */
export interface ProtocolConfig {
  /** Unique name for the protocol */
  name: string;
}

/**
 * Internal descriptor for a registered protocol.
 */
export interface ProtocolDescriptor {
  /** Unique name for the protocol */
  name: string;
  /** Constructor function for the protocol */
  constructor: new () => any;
  /** Cached singleton instance */
  instance?: any;
}

/**
 * Kernel configuration options.
 */
export interface KernelConfig {
  /** Custom logger instance */
  logger?: Logger;
  /** Custom metrics collector */
  metrics?: MetricsCollector;
  /** CPU emergency threshold (0-1) to prevent timeout */
  cpuEmergencyThreshold?: number;
}
