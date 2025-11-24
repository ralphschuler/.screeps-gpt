import { Logger } from "@ralphschuler/screeps-logger";

/**
 * Centralized logger instance for the bot runtime.
 * Configured with appropriate log levels and formatting for Screeps environment.
 *
 * Usage:
 * ```typescript
 * import { logger } from "@runtime/utils/logger";
 *
 * logger.info("Bot started");
 * logger.errorObject(error, "Failed to process:");
 * ```
 */
export const logger = new Logger({
  minLevel: "info",
  includeTimestamp: true,
  includeLevel: true
});

/**
 * Creates a child logger with component context.
 * Useful for adding consistent context to all logs from a specific module.
 *
 * @param component - Component name to include in logs
 * @returns Child logger with component context
 *
 * @example
 * ```typescript
 * const moduleLogger = createComponentLogger("StatsCollector");
 * moduleLogger.info("Starting collection"); // [INFO] Starting collection {"component":"StatsCollector"}
 * ```
 */
export function createComponentLogger(component: string): Logger {
  return logger.child({ component });
}
