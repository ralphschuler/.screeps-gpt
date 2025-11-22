/**
 * Singleton registry for managing protocol mixins registered via decorators.
 * Maintains a collection of protocol classes that can be combined into a unified protocol.
 */

import type { ProtocolDescriptor } from "./types.js";

/**
 * Global registry for decorator-based protocol registration.
 * Uses singleton pattern to ensure consistent state across imports.
 */
export class ProtocolRegistry {
  private static instance: ProtocolRegistry | null = null;
  private protocols: Map<string, ProtocolDescriptor> = new Map();

  private constructor() {}

  /**
   * Get the singleton instance of the registry.
   */
  public static getInstance(): ProtocolRegistry {
    if (!ProtocolRegistry.instance) {
      ProtocolRegistry.instance = new ProtocolRegistry();
    }
    return ProtocolRegistry.instance;
  }

  /**
   * Register a protocol descriptor.
   * @param descriptor Protocol configuration and constructor
   * @throws {Error} if a protocol with the same name is already registered
   */
  public register(descriptor: ProtocolDescriptor): void {
    if (this.protocols.has(descriptor.name)) {
      throw new Error(`Protocol '${descriptor.name}' is already registered`);
    }
    this.protocols.set(descriptor.name, descriptor);
  }

  /**
   * Unregister a protocol by name.
   * @param name Protocol name to unregister
   * @returns true if protocol was found and removed, false otherwise
   */
  public unregister(name: string): boolean {
    return this.protocols.delete(name);
  }

  /**
   * Get a protocol descriptor by name.
   * @param name Protocol name
   * @returns Protocol descriptor or undefined if not found
   */
  public get(name: string): ProtocolDescriptor | undefined {
    return this.protocols.get(name);
  }

  /**
   * Get all registered protocols.
   * @returns Array of protocol descriptors
   */
  public getAll(): ProtocolDescriptor[] {
    return Array.from(this.protocols.values());
  }

  /**
   * Clear all registered protocols.
   * Useful for testing.
   */
  public clear(): void {
    this.protocols.clear();
  }

  /**
   * Get the number of registered protocols.
   */
  public size(): number {
    return this.protocols.size;
  }

  /**
   * Combine all registered protocols into a single protocol object.
   * Creates instances of all protocol classes and merges their methods.
   * @returns Combined protocol object with all methods from registered protocols
   */
  public combineProtocols(): Record<string, unknown> {
    const combined: Record<string, unknown> = {};

    for (const descriptor of this.protocols.values()) {
      // Get or create instance
      if (!descriptor.instance) {
        descriptor.instance = new descriptor.constructor();
      }

      // Copy all methods and properties from the protocol instance
      const instance = descriptor.instance;
      const prototype = Object.getPrototypeOf(instance);
      
      // Get all property names from the prototype chain (except constructor)
      const propertyNames = Object.getOwnPropertyNames(prototype).filter(
        name => name !== "constructor"
      );

      // Copy methods to combined object
      for (const propName of propertyNames) {
        const propDescriptor = Object.getOwnPropertyDescriptor(prototype, propName);
        if (propDescriptor && typeof propDescriptor.value === "function") {
          // Bind the method to the original instance to preserve 'this' context
          combined[propName] = propDescriptor.value.bind(instance);
        }
      }

      // Also copy instance properties
      const instanceKeys = Object.keys(instance);
      for (const key of instanceKeys) {
        if (!(key in combined)) {
          const value = (instance as Record<string, unknown>)[key];
          if (typeof value === "function") {
            combined[key] = value.bind(instance);
          } else {
            combined[key] = value;
          }
        }
      }
    }

    return combined;
  }
}
