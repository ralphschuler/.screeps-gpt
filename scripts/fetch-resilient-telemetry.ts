import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

interface TelemetryResult {
  success: boolean;
  source: "stats_api" | "console" | "none";
  error?: string;
  botAlive?: boolean;
  botStatus?: string;
}

/**
 * Execute a script and capture its output
 */
async function executeScript(scriptPath: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("npx", ["tsx", scriptPath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", exitCode => {
      resolve({ exitCode: exitCode || 0, stdout, stderr });
    });

    proc.on("error", error => {
      reject(error);
    });
  });
}

/**
 * Fetch telemetry with resilient fallback strategy
 *
 * Strategy:
 * 0. Check bot aliveness first (using world-status API)
 * 1. Try Stats API first (primary source, historical data)
 * 2. If Stats API fails, fall back to console telemetry (redundant source, real-time data)
 * 3. If both fail, create comprehensive failure snapshot
 */
async function fetchResilientTelemetry(): Promise<TelemetryResult> {
  console.log("=== Resilient Telemetry Collection ===");
  console.log("Strategy: Bot Aliveness Check → Stats API → Console Fallback → Failure Snapshot\n");

  // Phase 0: Check bot aliveness using world-status API
  console.log("Phase 0: Checking bot aliveness...");
  let botAlive = false;
  let botStatus = "unknown";

  try {
    const alivenessResult = await executeScript("scripts/check-bot-aliveness.ts");

    if (alivenessResult.exitCode === 0) {
      console.log("✓ Bot is ACTIVE (world-status: normal)");
      botAlive = true;
      botStatus = "normal";
    } else if (alivenessResult.exitCode === 1) {
      console.log("⚠ Bot needs intervention (world-status: lost or empty)");
      botAlive = false;
      botStatus = "needs_spawn";
    } else {
      console.log("? Unable to determine bot aliveness (API error)");
      botStatus = "unknown";
    }
    console.log(alivenessResult.stdout);
  } catch (error) {
    console.log("✗ Bot aliveness check failed with exception:", error);
  }

  console.log();

  // Phase 1: Try Stats API
  console.log("Phase 1: Attempting Stats API telemetry...");
  try {
    const statsResult = await executeScript("scripts/fetch-screeps-stats.mjs");

    if (statsResult.exitCode === 0) {
      console.log("✓ Stats API telemetry successful");
      console.log(statsResult.stdout);

      // Check if stats are actually empty but bot is alive
      if (botAlive) {
        try {
          const fs = await import("node:fs/promises");
          const statsPath = resolve("reports", "screeps-stats", "latest.json");
          const statsContent = await fs.readFile(statsPath, "utf-8");
          const statsData = JSON.parse(statsContent);

          // Check if stats payload is empty
          if (statsData.payload && statsData.payload.stats && Object.keys(statsData.payload.stats).length === 0) {
            console.log("\n⚠️  IMPORTANT: Stats API returned empty data but bot is ACTIVE");
            console.log("   This indicates a stats collection issue in the bot code, NOT a bot lifecycle failure.");
            console.log("   The bot is executing normally but Memory.stats is not being populated.");
          }
        } catch (err) {
          // Ignore errors in this validation step
        }
      }

      return { success: true, source: "stats_api", botAlive, botStatus };
    }

    console.log("✗ Stats API telemetry failed (exit code: " + statsResult.exitCode + ")");
    console.log("Stats API stderr:", statsResult.stderr);
  } catch (error) {
    console.log("✗ Stats API telemetry failed with exception:", error);
  }

  // Phase 2: Fall back to Console Telemetry
  console.log("\nPhase 2: Falling back to Console telemetry...");
  try {
    const consoleResult = await executeScript("scripts/fetch-console-telemetry.ts");

    if (consoleResult.exitCode === 0) {
      console.log("✓ Console telemetry successful (fallback activated)");
      console.log(consoleResult.stdout);

      // Add metadata indicating this is fallback data
      const outputDir = resolve("reports", "screeps-stats");
      const filePath = resolve(outputDir, "latest.json");
      const fs = await import("node:fs/promises");
      const content = await fs.readFile(filePath, "utf-8");
      const snapshot = JSON.parse(content);
      snapshot.fallback_activated = true;
      snapshot.primary_source_failed = true;
      await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2));

      return { success: true, source: "console", botAlive, botStatus };
    }

    console.log("✗ Console telemetry failed (exit code: " + consoleResult.exitCode + ")");
    console.log("Console stderr:", consoleResult.stderr);
  } catch (error) {
    console.log("✗ Console telemetry failed with exception:", error);
  }

  // Phase 3: Both sources failed - create comprehensive failure snapshot
  console.log("\nPhase 3: Both telemetry sources failed - creating failure snapshot");

  const outputDir = resolve("reports", "screeps-stats");
  mkdirSync(outputDir, { recursive: true });
  const filePath = resolve(outputDir, "latest.json");

  const failureSnapshot = {
    status: "all_sources_unavailable",
    failureType: "infrastructure_failure",
    timestamp: new Date().toISOString(),
    error: "Both Stats API and Console telemetry sources failed",
    attempted_sources: ["stats_api", "console"],
    resilience_status: "critical",
    bot_aliveness: botAlive ? "active" : botStatus === "needs_spawn" ? "needs_spawn" : "unknown",
    bot_status: botStatus,
    recommendation: botAlive
      ? "Bot is ACTIVE but telemetry collection failed. This is a monitoring infrastructure issue, not a bot lifecycle issue."
      : "Verify Screeps credentials (SCREEPS_TOKEN) and connectivity. Check Screeps infrastructure status."
  };

  writeFileSync(filePath, JSON.stringify(failureSnapshot, null, 2));
  console.error("⚠ Comprehensive failure snapshot saved to:", filePath);

  return { success: false, source: "none", error: "All telemetry sources failed", botAlive, botStatus };
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const result = await fetchResilientTelemetry();

  console.log("\n=== Telemetry Collection Result ===");
  console.log(`Success: ${result.success}`);
  console.log(`Source: ${result.source}`);
  console.log(`Bot Alive: ${result.botAlive ?? "unknown"}`);
  console.log(`Bot Status: ${result.botStatus ?? "unknown"}`);

  if (!result.success) {
    console.error(`Error: ${result.error}`);

    // If bot is alive but telemetry failed, this is a monitoring issue, not critical
    if (result.botAlive) {
      console.log("\n✓ Bot is ACTIVE despite telemetry collection failure");
      console.log("  This is a monitoring infrastructure issue, not a bot lifecycle failure");
      process.exit(0);
    }

    process.exit(1);
  }

  // Exit with success code 0 even if using fallback
  // The monitoring system will check the snapshot metadata
  process.exit(0);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
}

export { fetchResilientTelemetry };
export type { TelemetryResult };
