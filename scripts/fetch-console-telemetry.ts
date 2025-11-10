import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { ScreepsAPI } from "screeps-api";

interface ConsoleTelemetry {
  cpu: {
    used: number;
    limit: number;
    bucket: number;
  };
  gcl: {
    level: number;
    progress: number;
    progressTotal: number;
  };
  rooms: Array<{
    name: string;
    rcl: number;
    energy: number;
    energyCapacity: number;
    storage?: number;
  }>;
  creeps: {
    total: number;
    byRole: Record<string, number>;
  };
  resources: {
    energy: number;
  };
}

interface ConsoleResponse {
  ok: number;
  data: string;
  error?: string;
}

/**
 * Execute a console command with retry logic
 */
async function executeConsoleCommand(
  api: ScreepsAPI,
  command: string,
  shard: string,
  retries = 3,
  delayMs = 1000
): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = (await api.console(command, shard)) as ConsoleResponse;

      if (!response.ok) {
        throw new Error(response.error || "Console command failed");
      }

      return response.data;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }

      const waitTime = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
      console.log(`  Retry ${attempt}/${retries} after ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

/**
 * Validate expression size before sending to API
 */
function validateExpressionSize(expression: string, maxSize = 1000): void {
  if (expression.length > maxSize) {
    throw new Error(`Expression size (${expression.length} chars) exceeds limit (${maxSize} chars)`);
  }
}

/**
 * Fetch telemetry data directly from bot console using chunked queries
 * This serves as a fallback when the Stats API is unavailable
 *
 * Uses multiple smaller console commands to avoid "expression size too large" errors
 */
async function fetchConsoleTelemetry(): Promise<ConsoleTelemetry> {
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

  console.log(`Fetching console telemetry from ${hostname} shard ${shard}...`);
  console.log(`Using chunked queries to avoid expression size limits`);

  try {
    // Query 1: CPU metrics
    const cpuCommand = `JSON.stringify({used:Game.cpu.getUsed(),limit:Game.cpu.limit,bucket:Game.cpu.bucket})`;
    validateExpressionSize(cpuCommand);
    console.log(`  Fetching CPU metrics...`);
    const cpuData = await executeConsoleCommand(api, cpuCommand, shard);
    const cpu = JSON.parse(cpuData);

    // Query 2: GCL metrics
    const gclCommand = `JSON.stringify({level:Game.gcl.level,progress:Game.gcl.progress,progressTotal:Game.gcl.progressTotal})`;
    validateExpressionSize(gclCommand);
    console.log(`  Fetching GCL metrics...`);
    const gclData = await executeConsoleCommand(api, gclCommand, shard);
    const gcl = JSON.parse(gclData);

    // Query 3: Room summary
    const roomsCommand = `JSON.stringify(Object.values(Game.rooms).filter(r=>r.controller&&r.controller.my).map(r=>({name:r.name,rcl:r.controller.level,energy:r.energyAvailable,energyCapacity:r.energyCapacityAvailable,storage:r.storage?r.storage.store.energy:undefined})))`;
    validateExpressionSize(roomsCommand, 1200); // Slightly larger limit for rooms
    console.log(`  Fetching room data...`);
    const roomsData = await executeConsoleCommand(api, roomsCommand, shard);
    const rooms = JSON.parse(roomsData);

    // Query 4: Creep statistics
    const creepsCommand = `JSON.stringify({total:Object.keys(Game.creeps).length,byRole:Object.values(Game.creeps).reduce((a,c)=>{const r=c.memory.role||'unknown';a[r]=(a[r]||0)+1;return a},{})})`;
    validateExpressionSize(creepsCommand, 1200); // Slightly larger limit for creeps
    console.log(`  Fetching creep statistics...`);
    const creepsData = await executeConsoleCommand(api, creepsCommand, shard);
    const creeps = JSON.parse(creepsData);

    // Query 5: Resource summary
    const resourcesCommand = `JSON.stringify({energy:Object.values(Game.rooms).filter(r=>r.controller&&r.controller.my&&r.storage).reduce((s,r)=>s+(r.storage?r.storage.store.energy:0),0)})`;
    validateExpressionSize(resourcesCommand);
    console.log(`  Fetching resource summary...`);
    const resourcesData = await executeConsoleCommand(api, resourcesCommand, shard);
    const resources = JSON.parse(resourcesData);

    // Combine all results
    const telemetry: ConsoleTelemetry = {
      cpu,
      gcl,
      rooms,
      creeps,
      resources
    };

    console.log(`✓ Console telemetry collected successfully (5 chunked queries)`);
    console.log(`  CPU: ${telemetry.cpu.used.toFixed(2)}/${telemetry.cpu.limit} (bucket: ${telemetry.cpu.bucket})`);
    console.log(`  GCL: ${telemetry.gcl.level} (${telemetry.gcl.progress}/${telemetry.gcl.progressTotal})`);
    console.log(`  Rooms: ${telemetry.rooms.length} controlled`);
    console.log(`  Creeps: ${telemetry.creeps.total} total`);
    console.log(`  Energy: ${telemetry.resources.energy} stored`);

    return telemetry;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch console telemetry: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Convert console telemetry to Stats API compatible format
 * This allows the monitoring system to work with either data source
 */
function convertToStatsFormat(telemetry: ConsoleTelemetry): {
  fetchedAt: string;
  endpoint: string;
  source: string;
  payload: {
    ok: number;
    stats: Record<string, { cpu: { used: number; limit: number }; resources: { energy: number } }>;
  };
} {
  // Create a single tick entry with current timestamp
  const tick = Date.now().toString();

  return {
    fetchedAt: new Date().toISOString(),
    endpoint: "console://(direct bot telemetry)",
    source: "console",
    payload: {
      ok: 1,
      stats: {
        [tick]: {
          cpu: {
            used: telemetry.cpu.used,
            limit: telemetry.cpu.limit
          },
          resources: {
            energy: telemetry.resources.energy
          }
        }
      }
    }
  };
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    // Fetch telemetry from console
    const telemetry = await fetchConsoleTelemetry();

    // Convert to Stats API compatible format
    const snapshot = convertToStatsFormat(telemetry);

    // Save to standard location for monitoring system
    const outputDir = resolve("reports", "screeps-stats");
    mkdirSync(outputDir, { recursive: true });
    const filePath = resolve(outputDir, "latest.json");
    writeFileSync(filePath, JSON.stringify(snapshot, null, 2));

    console.log(`✓ Console telemetry snapshot saved to: ${filePath}`);
  } catch (error) {
    console.error("Failed to fetch console telemetry:");
    if (error instanceof Error) {
      console.error(`  Error: ${error.message}`);
    } else {
      console.error(`  Error: ${String(error)}`);
    }

    // Create failure snapshot
    try {
      const outputDir = resolve("reports", "screeps-stats");
      mkdirSync(outputDir, { recursive: true });
      const filePath = resolve(outputDir, "latest.json");

      const failureSnapshot = {
        status: "console_unavailable",
        failureType: "console_error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        attempted_endpoint: "console://(direct bot telemetry)",
        source: "console"
      };

      writeFileSync(filePath, JSON.stringify(failureSnapshot, null, 2));
      console.error(`⚠ Failure snapshot saved to: ${filePath}`);
    } catch (snapshotError) {
      console.error("Failed to create failure snapshot:", snapshotError);
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

export { fetchConsoleTelemetry, convertToStatsFormat };
export type { ConsoleTelemetry };
