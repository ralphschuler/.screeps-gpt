import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BotSnapshot } from "./types/bot-snapshot";

/**
 * Generate synthetic test snapshots for baseline establishment testing
 *
 * This script creates 50 synthetic snapshots spanning 25 hours with realistic
 * performance metrics based on the bot's current operational characteristics.
 *
 * Usage: npx tsx packages/utilities/scripts/generate-test-snapshots.ts
 * Output: reports/bot-snapshots-test/snapshot-*.json
 */

async function generateTestSnapshots(): Promise<void> {
  console.log("Generating test snapshots for baseline establishment...\n");

  const testOutputDir = resolve("reports", "bot-snapshots-test");
  mkdirSync(testOutputDir, { recursive: true });

  const numSnapshots = 50;
  const startDate = new Date("2025-11-17T00:00:00Z");

  // Base metrics with realistic variations
  const baseCPU = 4.5;
  const baseBucket = 8000;
  const baseCreeps = 11;
  const baseEnergy = 1200;

  console.log(`Generating ${numSnapshots} test snapshots...`);
  console.log(`Start date: ${startDate.toISOString()}`);
  console.log(`Interval: 30 minutes`);

  for (let i = 0; i < numSnapshots; i++) {
    // Calculate timestamp (30 minutes apart)
    const timestamp = new Date(startDate.getTime() + i * 30 * 60 * 1000);

    // Add realistic variations to metrics
    const cpuVariation = (Math.random() - 0.5) * 1.5; // ±0.75
    const bucketVariation = (Math.random() - 0.5) * 1000; // ±500
    const creepVariation = Math.floor((Math.random() - 0.5) * 3); // ±1-2
    const energyVariation = (Math.random() - 0.5) * 400; // ±200

    const snapshot: BotSnapshot = {
      timestamp: timestamp.toISOString(),
      tick: 75100000 + i * 100,
      cpu: {
        used: Math.max(0.5, baseCPU + cpuVariation),
        limit: 20,
        bucket: Math.max(100, Math.min(10000, baseBucket + bucketVariation))
      },
      memory: {
        used: 50000 + Math.floor(Math.random() * 10000),
        usedPercent: 2.5 + Math.random() * 0.5
      },
      rooms: {
        E54N39: {
          rcl: 4,
          energy: Math.max(0, baseEnergy + energyVariation),
          energyCapacity: 1300,
          controllerProgress: 100000 + i * 1000,
          controllerProgressTotal: 405000
        }
      },
      creeps: {
        total: Math.max(5, baseCreeps + creepVariation),
        byRole: {
          harvester: 4,
          upgrader: 5,
          builder: 2
        }
      },
      spawns: {
        total: 1,
        active: Math.random() > 0.5 ? 1 : 0
      },
      structures: {
        spawns: 1,
        extensions: 10,
        containers: 2,
        towers: 0,
        roads: 15
      }
    };

    const filename = `snapshot-${timestamp.toISOString().split("T")[0]}-${timestamp.getHours().toString().padStart(2, "0")}${timestamp.getMinutes().toString().padStart(2, "0")}.json`;
    const filepath = resolve(testOutputDir, filename);
    writeFileSync(filepath, JSON.stringify(snapshot, null, 2));
  }

  const endDate = new Date(startDate.getTime() + (numSnapshots - 1) * 30 * 60 * 1000);
  const durationHours = ((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)).toFixed(1);

  console.log(`\n✓ Generated ${numSnapshots} test snapshots`);
  console.log(`  Output: ${testOutputDir}`);
  console.log(`  Period: ${startDate.toISOString()} to ${endDate.toISOString()}`);
  console.log(`  Duration: ${durationHours} hours`);
  console.log(`\n✓ Test snapshots ready for baseline establishment demonstration`);
  console.log(`\nNext steps:`);
  console.log(`  1. Temporarily copy test snapshots to reports/bot-snapshots/`);
  console.log(`  2. Run: npx tsx packages/utilities/scripts/establish-baselines.ts`);
  console.log(`  3. Verify baselines.json has confidenceLevel: "high"`);
  console.log(`  4. Restore original snapshots`);
}

generateTestSnapshots().catch(error => {
  console.error("Failed to generate test snapshots:", error);
  process.exit(1);
});
