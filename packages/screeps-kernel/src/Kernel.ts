/**
 * Core kernel implementation with process scheduling and lifecycle management.
 * Executes registered processes in priority order with CPU budget protection.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { KernelConfig, GameContext, Logger, MetricsCollector, Process } from "./types.js";
import { ProcessRegistry } from "./ProcessRegistry.js";
import { ProtocolRegistry } from "./ProtocolRegistry.js";
import { createProcessContext, NoOpLogger, NoOpMetricsCollector } from "./ProcessContext.js";

/**
 * Custom TypeScript kernel with decorator-based process management.
 * Inspired by screeps-microkernel patterns, adapted for TypeScript.
 */
export class Kernel {
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly cpuEmergencyThreshold: number;
  private readonly registry: ProcessRegistry;
  private readonly protocolRegistry: ProtocolRegistry;
  private combinedProtocol: Record<string, unknown> | null = null;

  /**
   * Create a new kernel instance.
   * @param config Kernel configuration options
   */
  public constructor(config: KernelConfig = {}) {
    this.logger = config.logger ?? new NoOpLogger();
    this.metrics = config.metrics ?? new NoOpMetricsCollector();
    this.cpuEmergencyThreshold = config.cpuEmergencyThreshold ?? 0.9;
    this.registry = ProcessRegistry.getInstance();
    this.protocolRegistry = ProtocolRegistry.getInstance();
  }

  /**
   * Execute one tick of the kernel scheduler.
   * Runs all registered processes in priority order with CPU protection.
   *
   * @param game Game state interface
   * @param memory Global memory object (typed via generics at call site)
   */
  public run<TMemory = any>(game: GameContext, memory: TMemory): void {
    const processes = this.registry.getAll();

    if (processes.length === 0) {
      this.logger.warn?.("[Kernel] No processes registered. Use @process decorator to register processes.");
      return;
    }

    // Initialize protocols on first run (lazy initialization)
    if (this.combinedProtocol === null) {
      this.combinedProtocol = this.protocolRegistry.combineProtocols();
      const protocolCount = this.protocolRegistry.size();
      if (protocolCount > 0) {
        this.logger.log?.(`[Kernel] Initialized ${protocolCount} protocol(s)`);
      }
    }

    // Create execution context with combined protocol
    const context = createProcessContext(game, memory, this.logger, this.metrics, this.combinedProtocol);

    // Track execution metrics
    let processesRun = 0;
    let processesFailed = 0;
    let processesSkipped = 0;

    // Execute processes in priority order
    for (const descriptor of processes) {
      // Check CPU budget before executing each process
      if (game.cpu.getUsed() > game.cpu.limit * this.cpuEmergencyThreshold) {
        this.logger.warn?.(
          `[Kernel] CPU threshold exceeded (${game.cpu.getUsed().toFixed(2)}/${game.cpu.limit}), ` +
            `skipping remaining processes`
        );
        processesSkipped = processes.length - processesRun - processesFailed;
        break;
      }

      try {
        // Get or create process instance
        const process = this.getProcessInstance(descriptor);

        // Execute process
        const startCpu = game.cpu.getUsed();
        this.metrics.begin(`process.${descriptor.name}`);

        process.run(context);

        this.metrics.end(`process.${descriptor.name}`);
        const cpuUsed = game.cpu.getUsed() - startCpu;
        this.metrics.record(`process.${descriptor.name}.cpu`, cpuUsed);

        processesRun++;
      } catch (error) {
        processesFailed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error?.(`[Kernel] Process '${descriptor.name}' failed: ${errorMessage}`);

        // Log stack trace if available
        if (error instanceof Error && error.stack) {
          this.logger.error?.(`[Kernel] Stack trace: ${error.stack}`);
        }
      }
    }

    // Log execution summary
    if (processesSkipped > 0 || processesFailed > 0) {
      this.logger.warn?.(
        `[Kernel] Tick ${game.time} completed: ${processesRun} run, ${processesFailed} failed, ${processesSkipped} skipped`
      );
    } else {
      this.logger.log?.(`[Kernel] Tick ${game.time} completed: ${processesRun} processes executed successfully`);
    }
  }

  /**
   * Get or create a process instance based on its descriptor.
   * Singletons are cached, non-singletons are created fresh each tick.
   *
   * @param descriptor Process descriptor
   * @returns Process instance
   */
  private getProcessInstance(descriptor: {
    name: string;
    singleton: boolean;
    constructor: new () => Process;
    instance?: Process;
  }): Process {
    if (descriptor.singleton) {
      // Return cached instance or create new one
      if (!descriptor.instance) {
        descriptor.instance = new descriptor.constructor();
      }
      return descriptor.instance;
    } else {
      // Create fresh instance for each tick
      return new descriptor.constructor();
    }
  }

  /**
   * Get the number of registered processes.
   */
  public getProcessCount(): number {
    return this.registry.size();
  }

  /**
   * Get all registered process names sorted by priority.
   */
  public getProcessNames(): string[] {
    return this.registry.getAll().map(p => p.name);
  }
}
