import { ScreepsAPI } from "screeps-api";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

interface WorldStatusResponse {
  ok: number;
  status: "normal" | "lost" | "empty";
}

interface ScreepsRawUserAPI {
  worldStatus(): Promise<WorldStatusResponse>;
}

interface ScreepsRawAPI {
  user: ScreepsRawUserAPI;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isScreepsRawAPI(raw: unknown): raw is ScreepsRawAPI {
  if (!isRecord(raw)) {
    return false;
  }

  const user = (raw as { user?: unknown }).user;
  if (!isRecord(user)) {
    return false;
  }

  const { worldStatus } = user;
  return typeof worldStatus === "function";
}

function ensureRawApi(api: ScreepsAPI): ScreepsRawAPI {
  const rawCandidate = (api as { raw?: unknown }).raw;
  if (isScreepsRawAPI(rawCandidate)) {
    return rawCandidate;
  }
  throw new Error("ScreepsAPI raw interface is missing expected methods");
}

/**
 * Check bot aliveness using the world-status API
 *
 * This provides a definitive answer about whether the bot is active in the game,
 * independent of Memory.stats availability.
 *
 * Returns:
 * - "active": Bot has spawns and is executing (status: "normal")
 * - "respawn_needed": Bot lost all spawns (status: "lost")
 * - "spawn_placement_needed": Bot respawned but spawn not placed (status: "empty")
 * - "unknown": API call failed or returned unexpected status
 */
async function checkBotAliveness(): Promise<{
  aliveness: "active" | "respawn_needed" | "spawn_placement_needed" | "unknown";
  status?: string;
  error?: string;
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

  try {
    console.log(`🔍 Checking bot aliveness on ${hostname}:${port}${path}...`);

    const api = new ScreepsAPI({ token, hostname, protocol, port, path });
    const raw = ensureRawApi(api);

    const statusResult = await raw.user.worldStatus();

    if (!statusResult.ok) {
      return {
        aliveness: "unknown",
        error: "API returned ok: 0 (failed to retrieve world status)"
      };
    }

    const { status } = statusResult;
    console.log(`📊 Bot status: ${status}`);

    // Map status to aliveness
    if (status === "normal") {
      console.log("✅ Bot is ACTIVE and executing in game");
      return { aliveness: "active", status };
    } else if (status === "lost") {
      console.log("⚠️ Bot lost all spawns - respawn needed");
      return { aliveness: "respawn_needed", status };
    } else if (status === "empty") {
      console.log("⚠️ Bot respawned but spawn not placed yet");
      return { aliveness: "spawn_placement_needed", status };
    } else {
      console.log(`❓ Unknown bot status: ${status}`);
      return { aliveness: "unknown", status };
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
