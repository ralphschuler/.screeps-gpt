import process from "node:process";
import { ScreepsAPI } from "screeps-api";

interface ConsoleResponse {
  ok: number;
  data: string;
  error?: string;
}

/**
 * Start profiler data collection via console command
 * This script executes Profiler.start() in the Screeps console to begin
 * automated profiler data collection for the monitoring workflow.
 */
async function startProfiler(): Promise<void> {
  const token = process.env.SCREEPS_TOKEN;
  const hostname = process.env.SCREEPS_HOST || "screeps.com";
  const protocol = process.env.SCREEPS_PROTOCOL || "https";
  const port = process.env.SCREEPS_PORT ? parseInt(process.env.SCREEPS_PORT, 10) : undefined;
  const path = process.env.SCREEPS_PATH || "/";
  const shard = process.env.SCREEPS_SHARD || "shard3";

  if (!token) {
    throw new Error("Missing SCREEPS_TOKEN environment variable");
  }

  const api = new ScreepsAPI({ token, hostname, protocol, port, path });

  // Console command to check profiler status and start if needed
  const profilerStartCommand = `
    (function() {
      if (typeof global.Profiler === 'undefined') {
        return JSON.stringify({ error: 'Profiler not available - check deployment' });
      }
      
      // Check if profiler is already running
      if (typeof Memory.profiler !== 'undefined' && Memory.profiler.start !== undefined) {
        return JSON.stringify({ 
          status: 'already_running', 
          startTick: Memory.profiler.start,
          message: 'Profiler is already collecting data'
        });
      }
      
      // Start profiler
      try {
        global.Profiler.start();
        return JSON.stringify({ 
          status: 'started', 
          startTick: Game.time,
          message: 'Profiler data collection started successfully'
        });
      } catch (err) {
        return JSON.stringify({ 
          error: 'Failed to start profiler: ' + err.message 
        });
      }
    })()
  `.trim();

  console.log(`Starting profiler on ${hostname} shard ${shard}...`);

  try {
    const response = (await api.console(profilerStartCommand, shard)) as ConsoleResponse;

    if (!response.ok) {
      throw new Error(response.error || "Console command failed");
    }

    const result = JSON.parse(response.data) as
      | { error: string }
      | { status: string; startTick: number; message: string };

    if ("error" in result) {
      console.log(`⚠ ${result.error}`);
      console.log("  Note: Profiler auto-starts on first tick after deployment");
      console.log("  If profiler is unavailable, check PROFILER_ENABLED build flag");
      process.exit(1);
    }

    if (result.status === "already_running") {
      console.log(`✓ ${result.message}`);
      console.log(`  Start tick: ${result.startTick}`);
      console.log("  Profiler data will be collected by fetch-profiler-console.ts");
    } else if (result.status === "started") {
      console.log(`✓ ${result.message}`);
      console.log(`  Start tick: ${result.startTick}`);
      console.log("  Profiler will collect data over subsequent ticks");
      console.log("  Run fetch-profiler-console.ts after 100+ ticks to retrieve data");
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to start profiler: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    await startProfiler();
    console.log("\n✓ Profiler start command completed successfully");
  } catch (error) {
    console.error("\n✗ Failed to start profiler:");
    if (error instanceof Error) {
      console.error(`  Error: ${error.message}`);
    } else {
      console.error(`  Error: ${String(error)}`);
    }
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

export { startProfiler };
