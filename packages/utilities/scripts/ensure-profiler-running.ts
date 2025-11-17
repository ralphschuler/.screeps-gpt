import process from "node:process";
import { ScreepsAPI } from "screeps-api";

interface ConsoleResponse {
  ok: number;
  data: string;
  error?: string;
}

/**
 * Ensures the profiler is running via console command.
 * This script acts as a backup to the auto-start feature in main.ts.
 *
 * Steps:
 * 1. Check if profiler is initialized (Memory.profiler exists)
 * 2. Check if profiler is already running (Memory.profiler.start is defined)
 * 3. If not running, execute Profiler.start() via console
 *
 * This script is idempotent - safe to run multiple times.
 */

async function ensureProfilerRunning(): Promise<void> {
  const token = process.env.SCREEPS_TOKEN;
  const hostname = process.env.SCREEPS_HOST || "screeps.com";
  const protocol = process.env.SCREEPS_PROTOCOL || "https";
  const port = process.env.SCREEPS_PORT ? parseInt(process.env.SCREEPS_PORT, 10) : undefined;
  const path = process.env.SCREEPS_PATH || "/";
  const shard = process.env.SCREEPS_SHARD || "shard3";

  if (!token) {
    throw new Error("Missing SCREEPS_TOKEN environment variable");
  }

  console.log(`Checking profiler status on ${hostname} shard ${shard}...`);

  const api = new ScreepsAPI({ token, hostname, protocol, port, path });

  // Check if profiler is already running
  const checkCommand = `
    (function() {
      if (typeof Memory.profiler === 'undefined') {
        return JSON.stringify({ status: 'not_initialized' });
      }
      if (Memory.profiler.start !== undefined) {
        return JSON.stringify({ status: 'running', startTick: Memory.profiler.start });
      }
      return JSON.stringify({ status: 'stopped' });
    })()
  `.trim();

  try {
    const checkResponse = (await api.console(checkCommand, shard)) as ConsoleResponse;

    if (!checkResponse.ok) {
      throw new Error(checkResponse.error || "Console command failed");
    }

    const status = JSON.parse(checkResponse.data) as
      | { status: "running"; startTick: number }
      | { status: "stopped" }
      | { status: "not_initialized" };

    if (status.status === "running") {
      console.log(`✓ Profiler is already running (started at tick ${status.startTick})`);
      console.log("  No action needed");
      return;
    }

    if (status.status === "not_initialized") {
      console.log("⚠ Profiler not initialized in Memory");
      console.log("  This indicates the code may not have been deployed with PROFILER_ENABLED=true");
      console.log("  Or the bot hasn't completed its first tick yet");
      console.log("  Will attempt to start profiler anyway...");
    }

    if (status.status === "stopped") {
      console.log("⚠ Profiler is initialized but not running");
      console.log("  Starting profiler via console...");
    }

    // Start the profiler
    const startCommand = `
      (function() {
        if (typeof Profiler === 'undefined') {
          return JSON.stringify({ success: false, error: 'Profiler not available' });
        }
        const result = Profiler.start();
        return JSON.stringify({ success: true, message: result });
      })()
    `.trim();

    const startResponse = (await api.console(startCommand, shard)) as ConsoleResponse;

    if (!startResponse.ok) {
      throw new Error(startResponse.error || "Failed to start profiler");
    }

    const startResult = JSON.parse(startResponse.data) as
      | { success: true; message: string }
      | { success: false; error: string };

    if (!startResult.success) {
      console.error(`❌ Failed to start profiler: ${startResult.error}`);
      console.error("  This may indicate:");
      console.error("  - Code was built with PROFILER_ENABLED=false");
      console.error("  - Profiler global is not exposed");
      console.error("  - There's an issue with the profiler initialization");
      process.exit(1);
    }

    console.log(`✓ Profiler started successfully`);
    console.log(`  Message: ${startResult.message}`);
    console.log("  Profiler will now collect CPU usage data on each tick");
  } catch (error) {
    console.error("❌ Failed to ensure profiler is running:");
    if (error instanceof Error) {
      console.error(`  Error: ${error.message}`);
      // Log response data if available (for API errors)
      const apiError = error as Error & { response?: { status?: number; data?: unknown } };
      if (apiError.response) {
        console.error(`  Status: ${apiError.response.status}`);
        console.error(`  Response data:`, apiError.response.data);
      }
    } else {
      console.error(`  Error: ${String(error)}`);
    }
    throw error;
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    await ensureProfilerRunning();
    console.log("\n✓ Profiler check complete");
  } catch (_error) {
    console.error("\n❌ Profiler check failed");
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
}

export { ensureProfilerRunning };
