import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Check if sufficient data exists to establish performance baselines
 *
 * Requirements:
 * - Minimum 48 snapshots (24-48 hours at 30min intervals)
 * - Snapshots must contain valid performance data
 * - Collection period must span at least 24 hours
 *
 * Exit codes:
 * - 0: Ready to establish baselines (48+ valid snapshots)
 * - 1: Not ready (insufficient data or error)
 */
function checkBaselineReadiness(): void {
  console.log("Checking baseline readiness...\n");

  const snapshotsDir = resolve("reports", "bot-snapshots");
  const baselinesPath = resolve("reports", "monitoring", "baselines.json");

  // Check if baselines already exist with high confidence
  if (existsSync(baselinesPath)) {
    try {
      const content = readFileSync(baselinesPath, "utf-8");
      const baselines = JSON.parse(content);

      if (baselines.metadata?.confidenceLevel === "high") {
        console.log("✓ Baselines already established with high confidence");
        console.log(`  Data points: ${baselines.dataPointCount}`);
        console.log(`  Generated: ${baselines.generatedAt}`);
        console.log(`  Duration: ${baselines.collectionPeriod?.durationHours || 0} hours\n`);
        console.log("Status: Baselines are current (no update needed)");
        process.exit(0);
      } else {
        console.log(`Current baseline confidence: ${baselines.metadata?.confidenceLevel || "unknown"}`);
        console.log(`Current data points: ${baselines.dataPointCount || 0}\n`);
      }
    } catch (error) {
      console.warn("Warning: Could not read existing baselines file:", error);
    }
  }

  // Check if snapshots directory exists
  if (!existsSync(snapshotsDir)) {
    console.log("❌ Snapshots directory not found");
    console.log("   Path: reports/bot-snapshots/");
    console.log("\nStatus: Not ready (snapshots directory missing)");
    process.exit(1);
  }

  // Read all snapshot files
  let files: string[] = [];
  try {
    files = readdirSync(snapshotsDir)
      .filter(f => f.endsWith(".json"))
      .sort();
  } catch (error) {
    console.error("❌ Failed to read snapshots directory:", error);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log("❌ No snapshot files found");
    console.log("   Directory: reports/bot-snapshots/");
    console.log("\nStatus: Not ready (no snapshots collected yet)");
    process.exit(1);
  }

  console.log(`Found ${files.length} snapshot file(s)`);

  // Load and validate snapshots
  let validSnapshots = 0;
  let timestamps: number[] = [];

  for (const file of files) {
    try {
      const filePath = resolve(snapshotsDir, file);
      const content = readFileSync(filePath, "utf-8");
      const snapshot = JSON.parse(content);

      // Validate snapshot has meaningful data
      if (snapshot.timestamp && (snapshot.cpu || snapshot.rooms || snapshot.creeps)) {
        validSnapshots++;
        timestamps.push(new Date(snapshot.timestamp).getTime());
      }
    } catch {
      // Skip invalid/corrupted snapshots
      continue;
    }
  }

  console.log(`Valid snapshots with data: ${validSnapshots}`);

  // Calculate collection period
  if (timestamps.length >= 2) {
    const startDate = new Date(Math.min(...timestamps));
    const endDate = new Date(Math.max(...timestamps));
    const durationHours = (Math.max(...timestamps) - Math.min(...timestamps)) / (1000 * 60 * 60);

    console.log(`Collection period: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log(`Duration: ${durationHours.toFixed(1)} hours\n`);

    // Check minimum duration (24 hours)
    if (durationHours < 24) {
      console.log(`⚠  Collection period too short: ${durationHours.toFixed(1)} hours`);
      console.log("   Minimum required: 24 hours");
      console.log("   Recommended: 48 hours for high confidence\n");
    }
  } else {
    console.log("⚠  Insufficient snapshots to calculate collection period\n");
  }

  // Check if we have sufficient data
  const MINIMUM_SNAPSHOTS = 48;
  const RECOMMENDED_SNAPSHOTS = 96; // 48 hours at 30min intervals

  if (validSnapshots >= MINIMUM_SNAPSHOTS) {
    console.log("✓ Sufficient data available for baseline establishment");
    console.log(`  Valid snapshots: ${validSnapshots}/${MINIMUM_SNAPSHOTS} minimum`);

    // Note: establish-baselines.ts only generates "high" (>=48) or "low" (<48) confidence levels
    console.log(`  Confidence level: HIGH (${validSnapshots} data points)`);
    if (validSnapshots < RECOMMENDED_SNAPSHOTS) {
      console.log(`  Note: ${RECOMMENDED_SNAPSHOTS}+ snapshots recommended for highest statistical confidence`);
    }

    console.log("\nStatus: READY to establish baselines");
    console.log("Run: npx tsx packages/utilities/scripts/establish-baselines.ts");
    process.exit(0);
  } else {
    const remaining = MINIMUM_SNAPSHOTS - validSnapshots;
    const estimatedHours = (remaining * 0.5).toFixed(1); // 30min per snapshot

    console.log("❌ Insufficient data for baseline establishment");
    console.log(`   Current: ${validSnapshots} valid snapshots`);
    console.log(`   Required: ${MINIMUM_SNAPSHOTS} minimum snapshots`);
    console.log(`   Remaining: ${remaining} snapshots (≈${estimatedHours} hours)\n`);
    console.log("Status: Not ready (continue collecting data)");
    process.exit(1);
  }
}

checkBaselineReadiness().catch(error => {
  console.error("Failed to check baseline readiness:", error);
  process.exit(1);
});
