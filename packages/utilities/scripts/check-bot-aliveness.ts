import { ScreepsAPI } from "screeps-api";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

interface ConsoleResponse {
  ok: number;
  data: string;
  error?: string;
}

interface MemoryStatsData {
  creeps?: Record<string, unknown>;
  rooms?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Check Memory.stats via API to determine bot aliveness
 * This is the authoritative source - if Memory.stats shows creeps/rooms, bot is definitely active
 */
async function checkMemoryStats(
  hostname: string,
  protocol: string,
  port: number,
  path: string,
  shard: string,
  token: string
): Promise<{
  aliveness: "active" | "respawn_needed" | "spawn_placement_needed" | "unknown";
  status?: string;
  error?: string;
  source: "memory_stats";
} | null> {
  try {
    console.log("📊 Checking Memory.stats via API...");

    const baseHost = `${protocol}://${hostname}${port !== 443 && port !== 80 ? `:${port}` : ""}`;
    const basePath = `${baseHost}${path.replace(/\/$/, "")}/api`;
    const endpoint = `${basePath}/user/memory?path=stats&shard=${shard}`;

    const response = await fetch(endpoint, {
      headers: {
        "X-Token": token,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      console.log(`  ⚠ Memory.stats API returned ${response.status}, will use console fallback`);
      return null;
    }

    const responseData = await response.json();

    // Handle gzipped data (prefixed with "gz:")
    let stats: MemoryStatsData;
    if (responseData.data && typeof responseData.data === "string" && responseData.data.startsWith("gz:")) {
      // Decompress gzipped data
      const zlib = await import("node:zlib");
      const { promisify } = await import("node:util");
      const gunzip = promisify(zlib.gunzip);

      const compressed = Buffer.from(responseData.data.slice(3), "base64");
      const decompressed = await gunzip(compressed);
      stats = JSON.parse(decompressed.toString());
    } else {
      // Non-gzipped response
      stats = responseData.data || responseData;
    }

    if (!stats || typeof stats !== "object") {
      console.log("  ⚠ Memory.stats is empty or invalid, will use console fallback");
      return null;
    }

    // Analyze Memory.stats to determine aliveness
    const creepCount = stats.creeps ? Object.keys(stats.creeps).length : 0;
    const roomCount = stats.rooms ? Object.keys(stats.rooms).length : 0;

    console.log(`  📊 Memory.stats: ${creepCount} creeps, ${roomCount} rooms`);

    // If we have creeps, bot is definitely active (authoritative!)
    if (creepCount > 0) {
      console.log("  ✅ Bot is ACTIVE (Memory.stats shows active creeps)");
      return {
        aliveness: "active",
        status: "active_with_creeps",
        source: "memory_stats"
      };
    }

    // If we have rooms but no creeps, might need respawn
    if (roomCount > 0 && creepCount === 0) {
      console.log("  ⚠ Bot has rooms but no creeps (may need respawn)");
      return {
        aliveness: "respawn_needed",
        status: "rooms_no_creeps",
        source: "memory_stats"
      };
    }

    // If no creeps and no rooms, spawn placement needed
    if (roomCount === 0 && creepCount === 0) {
      console.log("  ⚠ Bot has no rooms or creeps (spawn placement needed)");
      return {
        aliveness: "spawn_placement_needed",
        status: "no_presence",
        source: "memory_stats"
      };
    }

    // Unknown state
    console.log("  ❓ Unable to determine bot state from Memory.stats");
    return null;
  } catch (error) {
    console.log("  ⚠ Failed to check Memory.stats:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Check bot aliveness using Memory.stats as primary source with console API fallback
 *
 * Strategy:
 * 1. First check Memory.stats (authoritative source) - if bot has creeps/rooms, it's active
 * 2. Fall back to console API if Memory.stats unavailable
 * 3. Cross-validate to detect false positives (console empty but Memory.stats shows activity)
 *
 * This fixes false positives where console returns empty response but bot is actually active.
 *
 * Returns:
 * - "active": Bot has spawns/creeps and is executing
 * - "respawn_needed": Bot lost all spawns
 * - "spawn_placement_needed": Bot respawned but spawn not placed
 * - "unknown": API call failed or returned unexpected status
 */
async function checkBotAliveness(): Promise<{
  aliveness: "active" | "respawn_needed" | "spawn_placement_needed" | "unknown";
  status?: string;
  error?: string;
  source?: "memory_stats" | "console";
}> {
  const token = process.env.SCREEPS_TOKEN;
  if (!token) {
    return {
      aliveness: "unknown",
      error: "SCREEPS_TOKEN environment variable not set"
    };
  }

  const hostname = process.env.SCREEPS_HOST || "screeps.com";
  const protocol = process.env.SCREEPS_PROTOCOL || "https";
  const port = Number(process.env.SCREEPS_PORT || 443);
  const path = process.env.SCREEPS_PATH || "/";
  const shard = process.env.SCREEPS_SHARD || "shard3";

  try {
    console.log(`🔍 Checking bot aliveness on ${hostname}:${port}${path} (${shard})...`);

    // Phase 1: Check Memory.stats (authoritative source)
    const memoryStatsResult = await checkMemoryStats(hostname, protocol, port, path, shard, token);
    if (memoryStatsResult) {
      console.log("✓ Using Memory.stats as authoritative source");
      return memoryStatsResult;
    }

    // Phase 2: Fall back to console API
    console.log("ℹ Memory.stats unavailable, falling back to console API");
    const api = new ScreepsAPI({ token, hostname, protocol, port, path });

    // Check if we have spawns using the documented console API
    const command = `
      JSON.stringify({
        hasSpawns: !!Object.keys(Game.spawns).length,
        spawnCount: Object.keys(Game.spawns).length,
        rooms: Object.keys(Game.rooms).filter(r => Game.rooms[r].controller?.my).length
      })
    `.trim();
    const response = (await api.console(command, shard)) as ConsoleResponse;

    if (!response.ok) {
      return {
        aliveness: "unknown",
        error: response.error || "Console command failed"
      };
    }

    // Defensive parsing: handle undefined/empty responses when bot has no game presence
    let data;
    try {
      // FIX: Check for undefined/null response.data first
      if (
        response.data === undefined ||
        response.data === null ||
        response.data === "undefined" ||
        response.data === "" ||
        response.data === "null"
      ) {
        console.log("⚠️  Console returned undefined/empty response, treating as no spawns");
        console.log(`   Raw response: "${response.data || "<undefined>"}"`);
        return {
          aliveness: "spawn_placement_needed",
          status: "empty",
          error: "Console returned empty response - bot may have no game presence",
          source: "console"
        };
      }

      data = JSON.parse(response.data);

      // Validate parsed structure
      if (typeof data !== "object" || data === null) {
        console.log("⚠️  Console returned non-object response, treating as no spawns");
        // FIX: Add null-safe access before substring()
        const safeResponse = response.data || "<no response data>";
        console.log(
          `   Raw response: "${typeof safeResponse === "string" ? safeResponse.substring(0, 200) : String(safeResponse)}"`
        );
        return {
          aliveness: "spawn_placement_needed",
          status: "invalid",
          error: "Console returned invalid response structure",
          source: "console"
        };
      }
    } catch (parseError) {
      console.error("❌ JSON parse failed:", parseError);
      // FIX: Add null-safe access before substring()
      const safeResponse = response.data || "<no response data>";
      console.error(
        `   Raw response (first 200 chars): "${typeof safeResponse === "string" ? safeResponse.substring(0, 200) : String(safeResponse)}"`
      );
      return {
        aliveness: "unknown",
        error: `JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      };
    }

    console.log(`📊 Bot status: spawns=${data.spawnCount}, rooms=${data.rooms}`);

    // Determine aliveness based on spawn count
    if (data.hasSpawns && data.spawnCount > 0) {
      console.log("✅ Bot is ACTIVE and executing in game");
      return { aliveness: "active", status: "normal", source: "console" };
    } else if (data.rooms > 0 && data.spawnCount === 0) {
      console.log("⚠️ Bot has rooms but no spawns - respawn may be needed");
      return { aliveness: "respawn_needed", status: "lost", source: "console" };
    } else if (data.rooms === 0 && data.spawnCount === 0) {
      console.log("⚠️ Bot has no rooms or spawns - respawn placement needed");
      return { aliveness: "spawn_placement_needed", status: "empty", source: "console" };
    } else {
      console.log(`❓ Unknown bot status: spawns=${data.spawnCount}, rooms=${data.rooms}`);
      return { aliveness: "unknown", status: "unknown", source: "console" };
    }
  } catch (error) {
    console.error("❌ Failed to check bot aliveness:");
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
      // Log response data if available (for API errors)
      const apiError = error as Error & { response?: { status?: number; data?: unknown } };
      if (apiError.response) {
        console.error(`   Status: ${apiError.response.status}`);
        console.error(`   Response data:`, apiError.response.data);
      }
    } else {
      console.error(`   Error: ${String(error)}`);
    }
    return {
      aliveness: "unknown",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const result = await checkBotAliveness();

  // Save result to reports for monitoring
  const outputDir = resolve("reports", "copilot");
  mkdirSync(outputDir, { recursive: true });
  const filePath = resolve(outputDir, "bot-aliveness.json");

  const snapshot = {
    timestamp: new Date().toISOString(),
    aliveness: result.aliveness,
    status: result.status || null,
    error: result.error || null,
    source: result.source || null,
    interpretation: {
      active: result.aliveness === "active" ? "Bot is executing game logic and has active spawns" : null,
      respawn_needed:
        result.aliveness === "respawn_needed" ? "Bot has lost all spawns and requires respawn action" : null,
      spawn_placement_needed:
        result.aliveness === "spawn_placement_needed"
          ? "Bot has respawned but spawn location needs to be selected"
          : null,
      unknown:
        result.aliveness === "unknown" ? `Unable to determine bot status: ${result.error || "Unknown error"}` : null
    }
  };

  writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  console.log(`\n💾 Aliveness snapshot saved to: ${filePath}`);

  // Print summary
  console.log("\n=== Bot Aliveness Summary ===");
  console.log(`Aliveness: ${result.aliveness}`);
  console.log(`Status: ${result.status || "N/A"}`);
  console.log(`Source: ${result.source || "N/A"}`);

  if (result.error) {
    console.log(`Error: ${result.error}`);
  }

  // Exit with appropriate code
  // 0 = bot is active (success)
  // 1 = bot needs intervention (respawn/spawn placement)
  // 2 = unable to determine (API error)
  if (result.aliveness === "active") {
    process.exit(0);
  } else if (result.aliveness === "respawn_needed" || result.aliveness === "spawn_placement_needed") {
    process.exit(1);
  } else {
    process.exit(2);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("Unexpected error:", error);
    process.exit(2);
  });
}

export { checkBotAliveness };
