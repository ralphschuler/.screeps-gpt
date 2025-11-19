/**
 * Singleton registry for managing process descriptors registered via decorators.
 * Maintains a collection of process definitions and their metadata.
 */

import type { ProcessDescriptor } from "./types.js";

/**
 * Global registry for decorator-based process registration.
 * Uses singleton pattern to ensure consistent state across imports.
 */
export class ProcessRegistry {
  private static instance: ProcessRegistry | null = null;
  private processes: Map<string, ProcessDescriptor> = new Map();

  private constructor() {}

  /**
   * Get the singleton instance of the registry.
   */
  public static getInstance(): ProcessRegistry {
    if (!ProcessRegistry.instance) {
      ProcessRegistry.instance = new ProcessRegistry();
    }
    return ProcessRegistry.instance;
  }

  /**
   * Register a process descriptor.
   * @param descriptor Process configuration and constructor
   * @throws {Error} if a process with the same name is already registered
   */
  public register(descriptor: ProcessDescriptor): void {
    if (this.processes.has(descriptor.name)) {
      throw new Error(`Process '${descriptor.name}' is already registered`);
    }
    this.processes.set(descriptor.name, descriptor);
  }

  /**
   * Unregister a process by name.
   * @param name Process name to unregister
   * @returns true if process was found and removed, false otherwise
   */
  public unregister(name: string): boolean {
    return this.processes.delete(name);
  }

  /**
   * Get a process descriptor by name.
   * @param name Process name
   * @returns Process descriptor or undefined if not found
   */
  public get(name: string): ProcessDescriptor | undefined {
    return this.processes.get(name);
  }

  /**
   * Get all registered processes sorted by priority (highest first).
   * @returns Array of process descriptors sorted by priority
   */
  public getAll(): ProcessDescriptor[] {
    return Array.from(this.processes.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Clear all registered processes.
   * Useful for testing.
   */
  public clear(): void {
    this.processes.clear();
  }

  /**
   * Get the number of registered processes.
   */
  public size(): number {
    return this.processes.size;
  }
}
