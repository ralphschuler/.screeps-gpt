/**
 * Screeps Bot - Main Entry Point
 *
 * This module serves as the application entry point for the Screeps AI bot.
 * It initializes core systems (kernel, profiler, event bus) and defines the main
 * game loop that executes every tick.
 *
 * Key responsibilities:
 * - Initialize and configure the runtime kernel
 * - Set up profiler for CPU monitoring (when enabled)
 * - Subscribe to runtime events for debugging
 * - Expose global utilities for console access (Profiler, Diagnostics, EventBus)
 * - Execute the main game loop with proper error handling
 * - Manage phased initialization after deployment/restart to prevent CPU bucket drain
 *
 * @module main
 * @see {@link Kernel} for process scheduling and lifecycle management
 * @see {@link packages/README.md} for TSDoc documentation standards
 * @see {@link packages/docs/source/docs/runtime/initialization.md} for initialization system docs
 */

import { Kernel } from "@ralphschuler/screeps-kernel";
import type { GameContext } from "@runtime/types/GameContext";
import { init as initProfiler } from "@ralphschuler/screeps-profiler";
import { Diagnostics } from "@runtime/utils/Diagnostics";
import { logger } from "@runtime/utils/logger";
import { EventTypes } from "@ralphschuler/screeps-events";
import { globalEventBus } from "@runtime/events/globalEventBus";
import { InitializationManager } from "@runtime/bootstrap/InitializationManager";

// Import protocol modules to trigger @protocol decorator registration
import "@runtime/protocols";

// Import process modules to trigger @process decorator registration
import "@runtime/processes";

/**
 * Global flag to track if profiler has been initialized.
 * Used to avoid redundant initialization checks on every tick.
 * Resets on code reload (global re-creation), which is the desired behavior.
 */
let profilerInitialized = false;

/**
 * Maximum number of profiler entries to retain in Memory.profiler.data.
 * Entries with lowest cumulative CPU time are pruned when this limit is exceeded.
 * This prevents unbounded memory growth during long-running profiler sessions.
 * @see https://github.com/ralphschuler/.screeps-gpt/issues/1490
 */
const MAX_PROFILER_ENTRIES = 500;

/**
 * Interval (in ticks) between profiler retention policy enforcement.
 * Running every tick would add unnecessary CPU overhead; running every 100 ticks
 * provides a good balance between memory control and performance.
 */
const PROFILER_RETENTION_INTERVAL = 100;

// Initialize profiler instance first - needed by registerInitPhases
const profilerInstance = initProfiler();

// Create kernel instance using screeps-kernel
const kernel = new Kernel({
  logger: console,
  cpuEmergencyThreshold: 0.9
});

// Create initialization manager for phased startup
// This spreads initialization workload across multiple ticks to prevent CPU bucket drain
const initManager = new InitializationManager(
  {
    minBucketLevel: 500, // Minimum bucket required to proceed with init
    cpuSafetyMargin: 0.8, // Use 80% of CPU limit for init phases
    maxInitTicks: 10 // Force complete after 10 ticks
  },
  console
);

/**
 * Global flag to track if initialization phases have been registered.
 * Used to avoid redundant phase registration on every tick.
 * Resets on code reload (global re-creation), which is the desired behavior.
 */
let initPhasesRegistered = false;

/**
 * Ensures Memory.stats exists with a minimal structure.
 * This prevents TypeError crashes when external console automation (screeps-mcp probes,
 * monitoring scripts) attempts to write to Memory.stats between ticks or after memory resets.
 * Called from multiple locations to ensure defensive initialization.
 */
function ensureMemoryStats(): void {
  Memory.stats ??= {
    time: Game.time,
    cpu: { used: 0, limit: 0, bucket: 0 },
    creeps: { count: 0 },
    rooms: { count: 0 }
  };
}

/**
 * Register initialization phases with the manager.
 * Phases are sorted by priority (lower = earlier execution).
 * CPU estimates are conservative to ensure safe execution within budget.
 */
function registerInitPhases(): void {
  if (initPhasesRegistered) {
    return;
  }

  // Phase 0 (Tick 1): Critical systems only
  // Memory structure validation is minimal CPU - just ensures Memory objects exist
  initManager.registerPhase({
    name: "memory-validation",
    priority: 0,
    cpuEstimate: 1,
    execute: () => {
      // Ensure critical Memory structures exist
      ensureMemoryStats();
      Memory.profiler ??= { data: {}, total: 0 };
      logger.info("[Init Phase] Memory structures validated", { component: "Initialization" });
    }
  });

  // Phase 1 (Tick 1-2): Profiler setup
  // Profiler initialization is lightweight if already running
  initManager.registerPhase({
    name: "profiler-setup",
    priority: 10,
    cpuEstimate: 2,
    execute: () => {
      if (__PROFILER_ENABLED__ === "true") {
        // Only start profiler if not already running
        // profilerInitialized is set after this phase completes in the main loop
        if (Memory.profiler?.start === undefined) {
          profilerInstance.start();
          logger.info("[Init Phase] Profiler auto-started", { component: "Initialization" });
        }
      }
    }
  });

  // Phase 2 (Tick 2-3): Event bus subscriptions
  // Subscribe to runtime events for monitoring and debugging
  initManager.registerPhase({
    name: "event-subscriptions",
    priority: 20,
    cpuEstimate: 1,
    execute: () => {
      // Event subscriptions are already registered at module load time
      // This phase confirms they're ready
      logger.info("[Init Phase] Event bus ready", { component: "Initialization" });
    }
  });

  // Phase 3 (Tick 3+): Console diagnostics
  // Expose global utilities for console access
  // Note: This is also done at module load for immediate availability,
  // but this phase ensures they're re-exposed after any Memory resets
  initManager.registerPhase({
    name: "console-diagnostics",
    priority: 30,
    cpuEstimate: 1,
    execute: () => {
      // Globals are already exposed at module load time (lines 201-209)
      // This phase just confirms the initialization is complete
      logger.info("[Init Phase] Console diagnostics confirmed", { component: "Initialization" });
    }
  });

  initPhasesRegistered = true;
}

// Subscribe to runtime events for monitoring and debugging
// These subscriptions are only active when profiler is enabled to minimize CPU overhead
if (__PROFILER_ENABLED__ === "true") {
  const eventLogger = logger.child({ source: "EventBus" });

  globalEventBus.subscribe(EventTypes.HOSTILE_DETECTED, event => {
    eventLogger.info(
      `Hostiles detected in ${event.data.roomName}: ` +
        `${event.data.hostileCount} hostiles from [${event.data.hostileUsernames.join(", ")}]`
    );
  });

  globalEventBus.subscribe(EventTypes.ENERGY_DEPLETED, event => {
    eventLogger.info(
      `Energy depleted in ${event.data.roomName}: ${event.data.structureType} ${event.data.structureId}`
    );
  });

  globalEventBus.subscribe(EventTypes.ENERGY_RESTORED, event => {
    eventLogger.info(
      `Energy restored in ${event.data.roomName}: ` +
        `${event.data.structureType} ${event.data.structureId} (${event.data.energyAmount} energy)`
    );
  });
}

// Expose profiler and diagnostics globally for console access
if (typeof global !== "undefined") {
  global.Profiler = profilerInstance;
  global.Diagnostics = Diagnostics;
  global.EventBus = globalEventBus;
} else if (typeof window !== "undefined") {
  window.Profiler = profilerInstance;
  window.Diagnostics = Diagnostics;
  window.EventBus = globalEventBus;
}

/**
 * Validates Game object at runtime to ensure it conforms to GameContext interface.
 * Replaces unsafe type casting with explicit runtime validation.
 * @param game - Game object from Screeps API
 * @returns Validated GameContext object
 * @throws {TypeError} if Game object is missing required properties
 */
function validateGameContext(game: Game): GameContext {
  if (!game.cpu) {
    throw new TypeError("Invalid Game object: missing cpu interface");
  }
  if (!game.creeps) {
    throw new TypeError("Invalid Game object: missing creeps");
  }
  if (!game.spawns) {
    throw new TypeError("Invalid Game object: missing spawns");
  }
  if (!game.rooms) {
    throw new TypeError("Invalid Game object: missing rooms");
  }
  // Type assertion is now safe after explicit runtime validation
  return game as GameContext;
}

/**
 * Ensures profiler is running if enabled at build time.
 * Uses a global flag to avoid redundant checks on every tick.
 * Only runs initialization on first call or after Memory reset.
 */
function ensureProfilerRunning(): void {
  if (__PROFILER_ENABLED__ !== "true") {
    return;
  }

  // Skip initialization if already done and Memory.profiler exists
  // This avoids redundant checks on every tick
  if (profilerInitialized && Memory.profiler !== undefined) {
    return;
  }

  // Initialize Memory.profiler if not present (handles Memory resets)
  Memory.profiler ??= {
    data: {},
    total: 0
  };

  // Auto-start profiler if not already running
  if (Memory.profiler.start === undefined) {
    profilerInstance.start();
    logger.info(`Profiler auto-started data collection (tick: ${Game.time})`, { component: "Profiler" });
  }

  // Mark as initialized after successful setup
  profilerInitialized = true;
}

/**
 * Applies retention policy to profiler data to prevent unbounded memory growth.
 * When the number of profiled functions exceeds MAX_PROFILER_ENTRIES, the least
 * significant entries (lowest total CPU time) are pruned.
 *
 * This function is called periodically (every PROFILER_RETENTION_INTERVAL ticks)
 * to minimize CPU overhead while still preventing memory bloat.
 *
 * @see https://github.com/ralphschuler/.screeps-gpt/issues/1490
 */
function applyProfilerRetentionPolicy(): void {
  if (__PROFILER_ENABLED__ !== "true") {
    return;
  }

  // Only run retention policy periodically to minimize overhead
  if (Game.time % PROFILER_RETENTION_INTERVAL !== 0) {
    return;
  }

  // Skip if profiler memory doesn't exist or has no data
  if (!Memory.profiler?.data) {
    return;
  }

  const entries = Object.entries(Memory.profiler.data);
  const entryCount = entries.length;

  // Only apply retention if we exceed the limit
  if (entryCount <= MAX_PROFILER_ENTRIES) {
    return;
  }

  // Sort by total CPU time (descending) to keep the most significant entries
  entries.sort((a, b) => b[1].time - a[1].time);

  // Keep top MAX_PROFILER_ENTRIES entries
  const entriesToKeep = entries.slice(0, MAX_PROFILER_ENTRIES);
  const prunedCount = entryCount - MAX_PROFILER_ENTRIES;

  // Rebuild data object with only the retained entries
  Memory.profiler.data = Object.fromEntries(entriesToKeep);

  logger.info(`Profiler retention: pruned ${prunedCount} entries, kept ${MAX_PROFILER_ENTRIES} (tick: ${Game.time})`, {
    component: "Profiler"
  });
}

/**
 * Main game loop executed by the Screeps runtime every tick.
 *
 * This function is the entry point for all bot logic. It performs:
 * 1. Phased initialization (spreads startup across multiple ticks to protect CPU bucket)
 * 2. Profiler initialization (if enabled at build time)
 * 3. Defensive Memory.stats initialization (before external probes)
 * 4. Game context validation
 * 5. Kernel execution with all registered processes
 *
 * **Phased Initialization:**
 * After deployment or server restart, initialization is spread across multiple ticks
 * to prevent CPU bucket drain. This protects the bot from immediate timeout cascades
 * during the critical post-restart period.
 *
 * **Memory.stats Defensive Initialization:**
 * Memory.stats is defensively initialized here to prevent crashes from external
 * console automation (screeps-mcp health probes, monitoring scripts) that may
 * attempt to write to Memory.stats (e.g., Memory.stats.mcpTest) before the main
 * loop runs or between ticks after memory resets.
 *
 * StatsCollector (in MetricsProcess, priority 10) remains the domain owner and
 * will populate Memory.stats with full telemetry data during kernel execution.
 * This early initialization provides a safety net without violating single-responsibility.
 *
 * Errors are caught and logged to prevent the bot from crashing.
 * The kernel manages process scheduling and CPU budget protection.
 *
 * @example
 * ```typescript
 * // This function is called automatically by the Screeps runtime
 * // Export it from main.ts:
 * export { loop };
 * ```
 *
 * @see packages/docs/source/docs/runtime/initialization.md
 */
export const loop = (): void => {
  try {
    // Register initialization phases (once per global reload)
    registerInitPhases();

    // Validate game context early - needed for initialization
    const gameContext = validateGameContext(Game);

    // Phased initialization: spread startup workload across multiple ticks
    // This prevents CPU bucket drain after deployment or server restart
    if (initManager.needsInitialization(Memory)) {
      const initResult = initManager.tick(gameContext, Memory);

      if (initResult.complete) {
        // Initialization complete - proceed to normal operation this tick
        // Set profilerInitialized flag now that profiler-setup phase completed
        if (__PROFILER_ENABLED__ === "true") {
          profilerInitialized = true;
        }
        logger.info(
          `[Main] Initialization complete, resuming normal operations (tick ${Game.time})`,
          { component: "Initialization" }
        );
      } else {
        // Still initializing - skip kernel execution to preserve CPU budget
        // Defensive Memory.stats init still needed for external probes
        ensureMemoryStats();
        return;
      }
    }

    // Normal operation: profiler and kernel execution
    // Ensure profiler is running on every tick
    // This handles Memory resets and ensures continuous data collection
    ensureProfilerRunning();

    // Apply profiler retention policy periodically to prevent memory bloat
    // Runs every PROFILER_RETENTION_INTERVAL ticks to minimize CPU overhead
    applyProfilerRetentionPolicy();

    // Defensive initialization: ensure Memory.stats exists BEFORE kernel runs
    // This prevents TypeError crashes when external console automation (screeps-mcp probes,
    // monitoring scripts) attempts to write to Memory.stats between ticks or after memory resets.
    // StatsCollector will populate this with full telemetry data during MetricsProcess execution.
    ensureMemoryStats();

    kernel.run(gameContext, Memory);
  } catch (error) {
    // Enhanced error handling with specific error classification
    // Use logger.errorObject() to safely serialize errors and prevent primitive conversion issues
    if (error instanceof TypeError) {
      logger.errorObject(error, "[Type Error]");
    } else if (error instanceof Error) {
      logger.errorObject(error, "[Runtime Error]");
    } else {
      logger.errorObject(error, "[Unknown Error]");
    }
  }
};
