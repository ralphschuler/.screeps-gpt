import type { EventBus } from "./EventBus.js";

/**
 * Base class for components that emit events.
 * Provides convenience methods for event emission.
 */
export class EventEmitter {
  public constructor(protected readonly eventBus: EventBus) {}

  /**
   * Emit an event through the event bus
   * @param eventType - The type of event to emit
   * @param data - The event payload data
   * @param source - Optional source component identifier (defaults to constructor name)
   */
  protected emitEvent<T = unknown>(eventType: string, data: T, source?: string): void {
    this.eventBus.emit(eventType, data, source ?? this.constructor.name);
  }
}
