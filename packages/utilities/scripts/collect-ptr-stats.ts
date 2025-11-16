import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { fetchResilientTelemetry } from "./fetch-resilient-telemetry.js";

interface PTRStatsMetadata {
  collectedAt: string;
  source: "stats_api" | "console" | "none";
  success: boolean;
  error?: string;
  fallbackActivated: boolean;
}

interface PTRStats {
  metadata: PTRStatsMetadata;
  stats: Record<string, unknown> | null;
  raw?: unknown;
}

/**
 * Collect PTR stats with multi-source fallback and save to copilot reports directory
 *
 * This script orchestrates the resilient telemetry collection and saves the results
 * to the expected location for PTR monitoring and analysis.
 */
async function collectPTRStats(): Promise<void> {
  console.log("=== PTR Stats Collection ===");
  console.log("Collecting telemetry with multi-source fallback...\n");

  const collectedAt = new Date().toISOString();

  try {
    // Use resilient telemetry collection
    const result = await fetchResilientTelemetry();

    // Read the generated stats file
    const statsPath = resolve("reports", "screeps-stats", "latest.json");
    let statsContent: Record<string, unknown> | null = null;
    let source: "stats_api" | "console" | "none" = result.source;
    let fallbackActivated = false;

    try {
      const statsData = readFileSync(statsPath, "utf-8");
      const parsed = JSON.parse(statsData);

      // Check if this is a fallback or failure response
      if (parsed.status === "all_sources_unavailable") {
        statsContent = null;
        source = "none";
      } else if (parsed.fallback_activated || parsed.source === "console") {
        statsContent = parsed.payload?.stats || parsed;
        source = "console";
        fallbackActivated = parsed.fallback_activated || false;
      } else if (parsed.payload?.stats) {
        statsContent = parsed.payload.stats;
        source = "stats_api";
      } else {
        statsContent = parsed;
      }
    } catch (readError) {
      console.warn("Failed to read generated stats file:", readError);
      statsContent = null;
      source = "none";
    }

    // Create PTR stats object with metadata
    const ptrStats: PTRStats = {
      metadata: {
        collectedAt,
        source,
        success: result.success,
        error: result.error,
        fallbackActivated
      },
      stats: statsContent,
      raw: statsContent ? undefined : { reason: "No data available" }
    };

    // Save to PTR stats location
    const outputDir = resolve("reports", "copilot");
    mkdirSync(outputDir, { recursive: true });
    const outputPath = resolve(outputDir, "ptr-stats.json");
    writeFileSync(outputPath, JSON.stringify(ptrStats, null, 2));

    console.log(`\n✓ PTR stats saved to: ${outputPath}`);
    console.log(`  Source: ${source}`);
    console.log(`  Success: ${result.success}`);
    console.log(`  Fallback activated: ${fallbackActivated}`);

    if (!result.success) {
      console.error(`\n⚠ Collection failed: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Failed to collect PTR stats:");
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
    } else {
      console.error(`   Error: ${String(error)}`);
    }

    // Create failure PTR stats
    const outputDir = resolve("reports", "copilot");
    mkdirSync(outputDir, { recursive: true });
    const outputPath = resolve(outputDir, "ptr-stats.json");

    const failurePtrStats: PTRStats = {
      metadata: {
        collectedAt,
        source: "none",
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fallbackActivated: false
      },
      stats: null,
      raw: { error: error instanceof Error ? error.message : String(error) }
    };

    writeFileSync(outputPath, JSON.stringify(failurePtrStats, null, 2));
    console.error(`\n⚠ Failure PTR stats saved to: ${outputPath}`);

    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  collectPTRStats().catch(error => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
}

export { collectPTRStats };
