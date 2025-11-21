import type { GameEvent, EventHandler, UnsubscribeFunction } from "./types.js";

/**
 * Lightweight, type-safe event bus optimized for Screeps.
 * Provides synchronous event emission with error isolation.
 * All events are in-memory only and do not persist across ticks.
 */
export class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  /**
   * Subscribe to events of a specific type
   * @param eventType - The event type to listen for
   * @param handler - The handler function to call when event is emitted
   * @returns Unsubscribe function that removes this handler
   */
  public subscribe<T = unknown>(eventType: string, handler: EventHandler<T>): UnsubscribeFunction {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    const handlers = this.handlers.get(eventType)!;
    handlers.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      const currentHandlers = this.handlers.get(eventType);
      if (currentHandlers) {
        currentHandlers.delete(handler as EventHandler);
      }
    };
  }

  /**
   * Emit an event to all subscribed handlers
   * @param eventType - The type of event to emit
   * @param data - The event payload data
   * @param source - Optional source component identifier
   */
  public emit<T = unknown>(eventType: string, data: T, source?: string): void {
    const handlers = this.handlers.get(eventType);
    if (!handlers || handlers.size === 0) {
      return;
    }

    const event: GameEvent<T> = {
      type: eventType,
      data,
      tick: Game.time,
      ...(source && { source })
    };

    // Execute all handlers, isolating errors so one failure doesn't crash others
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error) {
        console.log(`[EventBus] Handler error for ${eventType}: ${error}`);
      }
    }
  }

  /**
   * Clear handlers for a specific event type or all events
   * @param eventType - Optional event type to clear. If not provided, clears all handlers
   */
  public clear(eventType?: string): void {
    if (eventType) {
      this.handlers.delete(eventType);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Get the number of handlers subscribed to an event type
   * @param eventType - The event type to check
   * @returns Number of subscribed handlers
   */
  public getHandlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }

  /**
   * Get all registered event types
   * @returns Array of event type strings
   */
  public getEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}
