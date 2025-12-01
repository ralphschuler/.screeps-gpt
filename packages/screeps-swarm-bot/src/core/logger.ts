import { Logger } from "@ralphschuler/screeps-logger";

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Central logging factory to keep consistent metadata and level filtering.
 */
export function createLogger(minLevel: LogLevel = "info", meta: Record<string, unknown> = {}): Logger {
  const base = new Logger({ minLevel });
  return Object.keys(meta).length ? base.child(meta) : base;
}

/**
 * Helper to log with subsystem + room context.
 */
export function roomLogger(system: string, roomName?: string, minLevel: LogLevel = "info"): Logger {
  return createLogger(minLevel, { system, room: roomName });
}
