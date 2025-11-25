// Declare global for Screeps compatibility (available in both Node.js and Screeps)
declare const global: any;

import { safeSerialize } from "./safeSerialize";

/**
 * Console interface for logging output
 */
export interface ConsoleInterface {
  log(message: string): void;
}

/**
 * Log level for structured logging
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Structured log entry with timestamp and level
 */
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Options for structured logger
 */
export interface LoggerOptions {
  /**
   * Minimum log level to output
   * Default: "info"
   */
  minLevel?: LogLevel;

  /**
   * Whether to include timestamps in log output
   * Default: true
   */
  includeTimestamp?: boolean;

  /**
   * Whether to include log level prefix
   * Default: true
   */
  includeLevel?: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * Structured logger with timestamp support for Screeps AI.
 * Implements deterministic output for testability.
 */
export class Logger {
  private readonly options: Required<LoggerOptions>;
  private readonly consoleImpl: ConsoleInterface;

  public constructor(options: LoggerOptions = {}, consoleImpl?: ConsoleInterface) {
    this.options = {
      minLevel: options.minLevel ?? "info",
      includeTimestamp: options.includeTimestamp ?? true,
      includeLevel: options.includeLevel ?? true
    };
    // Use provided console implementation or create a safe default
    // Access console from global for Screeps compatibility

    this.consoleImpl =
      consoleImpl ?? ((typeof global !== "undefined" ? (global as any).console : undefined) || { log: () => {} });
  }

  /**
   * Logs a debug message
   */
  public debug(message: string, context?: Record<string, unknown>): void {
    this.log("debug", message, context);
  }

  /**
   * Logs an info message
   */
  public info(message: string, context?: Record<string, unknown>): void {
    this.log("info", message, context);
  }

  /**
   * Logs a warning message
   */
  public warn(message: string, context?: Record<string, unknown>): void {
    this.log("warn", message, context);
  }

  /**
   * Logs an error message
   */
  public error(message: string, context?: Record<string, unknown>): void {
    this.log("error", message, context);
  }

  /**
   * Logs an error object with automatic safe serialization.
   * Handles Error objects, Zod errors, and complex objects safely.
   * @param error - The error or value to log
   * @param prefix - Optional prefix for the error message
   * @param context - Optional additional context
   */
  public errorObject(error: unknown, prefix?: string, context?: Record<string, unknown>): void {
    const serialized = safeSerialize(error);
    const message = prefix ? `${prefix} ${serialized}` : serialized;
    this.log("error", message, context);
  }

  /**
   * Core logging method with level filtering and formatting
   */
  public log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.options.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: typeof Game !== "undefined" ? Game.time : Date.now(),
      level,
      message,
      ...(context !== undefined && { context })
    };

    const formatted = this.formatLogEntry(entry);
    this.consoleImpl.log(formatted);
  }

  /**
   * Formats a log entry for console output
   */
  private formatLogEntry(entry: LogEntry): string {
    const parts: string[] = [];

    if (this.options.includeTimestamp) {
      parts.push(`[${entry.timestamp}]`);
    }

    if (this.options.includeLevel) {
      parts.push(`[${entry.level.toUpperCase()}]`);
    }

    parts.push(entry.message);

    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(JSON.stringify(entry.context));
    }

    return parts.join(" ");
  }

  /**
   * Creates a child logger with additional context
   */
  public child(context: Record<string, unknown>): Logger {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new ContextLogger(this, context);
  }
}

/**
 * Logger that adds context to all log entries
 */
class ContextLogger extends Logger {
  private readonly parentLogger: Logger;
  private readonly context: Record<string, unknown>;

  public constructor(parent: Logger, context: Record<string, unknown>) {
    // Pass dummy console since we delegate to parent
    super({}, { log: () => {} });
    this.parentLogger = parent;
    this.context = context;
  }

  public override log(level: LogLevel, message: string, additionalContext?: Record<string, unknown>): void {
    const mergedContext = {
      ...this.context,
      ...(additionalContext ?? {})
    };
    this.parentLogger.log(level, message, mergedContext);
  }
}
