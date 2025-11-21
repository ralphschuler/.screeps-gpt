import { EventBus } from "@ralphschuler/screeps-events";

/**
 * Global EventBus instance for inter-component communication.
 *
 * @remarks
 * This EventBus is created at module scope and persists across game ticks in the Screeps environment.
 * - Event handlers accumulate and persist across ticks.
 * - The EventBus instance itself is never cleared between ticks.
 * - This is intentional per the "In-Memory Only" design, and differs from typical Screeps patterns where most state is ephemeral.
 * - Future maintainers should be aware that any event subscriptions or state attached to this bus will persist until the module is reloaded (e.g., code upload or server reset).
 */
export const globalEventBus = new EventBus();
