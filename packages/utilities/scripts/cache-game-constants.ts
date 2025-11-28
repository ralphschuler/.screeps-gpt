#!/usr/bin/env tsx

/**
 * Cache Game Constants Script
 *
 * Fetches and caches commonly used Screeps game constants from the wiki
 * for offline reference. Useful for strategic planning and calculations
 * without requiring live MCP server access.
 *
 * Usage:
 *   yarn tsx packages/utilities/scripts/cache-game-constants.ts
 *
 * Output:
 *   reports/game-constants/game-constants-{timestamp}.json
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile, readFile, readdir, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";

/**
 * Known Screeps game constants that are frequently referenced.
 * These values are from the official Screeps documentation and are cached
 * for quick reference during planning and development.
 *
 * Note: These should be periodically validated against the live game API
 * as game balance changes may update these values.
 */
const SCREEPS_CONSTANTS = {
  // Last updated: 2025-11-28
  lastUpdated: new Date().toISOString(),
  source: "Screeps Official Documentation / Wiki",

  /**
   * Bodypart costs (energy required to spawn each part)
   */
  BODYPART_COST: {
    move: 50,
    work: 100,
    attack: 80,
    carry: 50,
    heal: 250,
    ranged_attack: 150,
    tough: 10,
    claim: 600
  },

  /**
   * Controller levels and their requirements
   */
  CONTROLLER_LEVELS: {
    1: 200,
    2: 45000,
    3: 135000,
    4: 405000,
    5: 1215000,
    6: 3645000,
    7: 10935000,
    8: Infinity // Max level
  },

  /**
   * Controller structure limits by level
   */
  CONTROLLER_STRUCTURES: {
    spawn: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 2, 8: 3 },
    extension: { 1: 0, 2: 5, 3: 10, 4: 20, 5: 30, 6: 40, 7: 50, 8: 60 },
    link: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 2, 6: 3, 7: 4, 8: 6 },
    storage: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 },
    tower: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2, 6: 2, 7: 3, 8: 6 },
    observer: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
    powerSpawn: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
    extractor: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1 },
    terminal: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1 },
    lab: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 3, 7: 6, 8: 10 },
    factory: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 1, 8: 1 },
    nuker: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
    road: {
      1: 2500,
      2: 2500,
      3: 2500,
      4: 2500,
      5: 2500,
      6: 2500,
      7: 2500,
      8: 2500
    },
    constructedWall: {
      1: 0,
      2: 2500,
      3: 2500,
      4: 2500,
      5: 2500,
      6: 2500,
      7: 2500,
      8: 2500
    },
    rampart: {
      1: 0,
      2: 2500,
      3: 2500,
      4: 2500,
      5: 2500,
      6: 2500,
      7: 2500,
      8: 2500
    },
    container: { 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5 }
  },

  /**
   * Construction costs (energy)
   */
  CONSTRUCTION_COST: {
    spawn: 15000,
    extension: 3000,
    road: 300,
    constructedWall: 1,
    rampart: 1,
    link: 5000,
    storage: 30000,
    tower: 5000,
    observer: 8000,
    powerSpawn: 100000,
    extractor: 5000,
    lab: 50000,
    terminal: 100000,
    container: 5000,
    nuker: 100000,
    factory: 100000
  },

  /**
   * Structure hit points (max health)
   */
  STRUCTURE_HITS: {
    spawn: 5000,
    extension: 1000,
    road: 5000,
    constructedWall: 300000000,
    rampart: 300000000,
    link: 1000,
    storage: 10000,
    tower: 3000,
    observer: 500,
    powerSpawn: 5000,
    extractor: 500,
    lab: 500,
    terminal: 3000,
    container: 250000,
    nuker: 1000,
    factory: 1000
  },

  /**
   * Rampart hits per RCL
   */
  RAMPART_HITS_MAX: {
    2: 300000,
    3: 1000000,
    4: 3000000,
    5: 10000000,
    6: 30000000,
    7: 100000000,
    8: 300000000
  },

  /**
   * Extension capacity by RCL
   */
  EXTENSION_ENERGY_CAPACITY: {
    1: 50,
    2: 50,
    3: 50,
    4: 50,
    5: 50,
    6: 50,
    7: 100,
    8: 200
  },

  /**
   * Link constants
   */
  LINK: {
    capacity: 800,
    cooldown: 1,
    lossRatio: 0.03
  },

  /**
   * Tower constants
   */
  TOWER: {
    energyCapacity: 1000,
    attackOptimal: 600,
    attackMinimal: 150,
    healOptimal: 400,
    healMinimal: 100,
    repairOptimal: 800,
    repairMinimal: 200,
    optimalRange: 5,
    falloffRange: 20
  },

  /**
   * Storage and terminal capacities
   */
  CAPACITY: {
    storage: 1000000,
    terminal: 300000,
    container: 2000,
    carry: 50
  },

  /**
   * Spawn constants
   */
  SPAWN: {
    energyStart: 300,
    energyCapacity: 300,
    spawningTime: 3 // Ticks per body part
  },

  /**
   * Source constants
   */
  SOURCE: {
    energyCapacity: 3000,
    regenerationTime: 300 // Ticks
  },

  /**
   * Mineral constants
   */
  MINERAL: {
    regenerationTime: 50000 // Ticks
  },

  /**
   * CPU constants
   */
  CPU: {
    bucket: 10000,
    unlockCost: 20, // CPU unlock cost in GCL
    generatePixelCost: 10000 // Bucket cost to generate 1 pixel
  },

  /**
   * GCL constants
   */
  GCL: {
    multiply: 1000000,
    pow: 2.4,
    novice: 3
  },

  /**
   * Creep constants
   */
  CREEP: {
    lifeTime: 1500,
    claimLifeTime: 600,
    spawnTime: 3,
    maxParts: 50
  },

  /**
   * Road decay constants
   */
  ROAD_DECAY: {
    amount: 100,
    time: 1000,
    swampTime: 5000
  },

  /**
   * Repair constants
   */
  REPAIR: {
    cost: 0.01, // Energy per hit point
    power: 100 // HP repaired per tick per WORK part
  },

  /**
   * Harvest constants
   */
  HARVEST: {
    power: 2, // Energy per tick per WORK part
    mineralPower: 1 // Mineral units per tick per WORK part
  },

  /**
   * Build constants
   */
  BUILD: {
    power: 5 // HP built per tick per WORK part
  },

  /**
   * Upgrade constants
   */
  UPGRADE: {
    power: 1 // Controller points per tick per WORK part
  },

  /**
   * Attack constants
   */
  ATTACK: {
    power: 30, // Damage per tick per ATTACK part
    rangedPower: 10, // Damage at range 3 per RANGED_ATTACK part
    rangedMassPower: 10 // Damage per RANGED_ATTACK part with rangedMassAttack
  },

  /**
   * Heal constants
   */
  HEAL: {
    power: 12, // HP healed per tick per HEAL part
    rangedPower: 4 // HP healed at range per tick per HEAL part
  },

  /**
   * Terminal transaction costs
   */
  TERMINAL: {
    sendCostMin: 0.1, // Minimum 10% energy cost
    cooldown: 10 // Ticks between sends
  }
};

/**
 * Generate timestamped filename
 */
function generateFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `game-constants-${timestamp}.json`;
}

/**
 * Get the latest cached constants file
 */
async function getLatestCache(): Promise<string | null> {
  const cacheDir = resolve("reports", "game-constants");
  if (!existsSync(cacheDir)) {
    return null;
  }

  const files = await readdir(cacheDir);
  const jsonFiles = files
    .filter(f => f.startsWith("game-constants-") && f.endsWith(".json"))
    .sort()
    .reverse();

  if (jsonFiles.length === 0) {
    return null;
  }

  return join(cacheDir, jsonFiles[0]);
}

/**
 * Clean up old cache files (keep last 5)
 */
async function cleanupOldCaches(): Promise<number> {
  const cacheDir = resolve("reports", "game-constants");
  if (!existsSync(cacheDir)) {
    return 0;
  }

  const files = await readdir(cacheDir);
  const jsonFiles = files
    .filter(f => f.startsWith("game-constants-") && f.endsWith(".json"))
    .sort()
    .reverse();

  // Keep latest 5 files
  const filesToDelete = jsonFiles.slice(5);
  for (const file of filesToDelete) {
    await unlink(join(cacheDir, file));
  }

  return filesToDelete.length;
}

/**
 * Save constants to cache file
 */
async function saveConstants(): Promise<string> {
  const cacheDir = resolve("reports", "game-constants");
  await mkdir(cacheDir, { recursive: true });

  const filename = generateFilename();
  const filePath = join(cacheDir, filename);

  await writeFile(filePath, JSON.stringify(SCREEPS_CONSTANTS, null, 2) + "\n", "utf-8");

  return filePath;
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log("📦 Screeps Game Constants Cache");
  console.log("================================\n");

  // Check for existing cache
  const existingCache = await getLatestCache();
  if (existingCache) {
    const cacheData = JSON.parse(await readFile(existingCache, "utf-8"));
    console.log(`📋 Existing cache found: ${existingCache}`);
    console.log(`   Last updated: ${cacheData.lastUpdated}`);
    console.log("");
  }

  // Save new cache
  const newCachePath = await saveConstants();
  console.log(`✅ New cache saved: ${newCachePath}`);

  // Cleanup old caches
  const deletedCount = await cleanupOldCaches();
  if (deletedCount > 0) {
    console.log(`🧹 Cleaned up ${deletedCount} old cache file(s)`);
  }

  // Display summary
  console.log("\n📊 Constants Summary:");
  console.log(`   - Body parts: ${Object.keys(SCREEPS_CONSTANTS.BODYPART_COST).length}`);
  console.log(`   - RCL levels: ${Object.keys(SCREEPS_CONSTANTS.CONTROLLER_LEVELS).length}`);
  console.log(`   - Structures: ${Object.keys(SCREEPS_CONSTANTS.STRUCTURE_HITS).length}`);
  console.log(`   - Construction costs: ${Object.keys(SCREEPS_CONSTANTS.CONSTRUCTION_COST).length}`);
  console.log("\n✨ Cache complete!");
}

// Run if executed directly
main().catch(error => {
  console.error("❌ Error caching game constants:", error);
  process.exit(1);
});

export { SCREEPS_CONSTANTS };
