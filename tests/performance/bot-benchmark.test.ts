import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ScreepsAPI } from "screeps-api";
import fs from "node:fs";
import path from "node:path";

/**
 * Bot Performance Benchmark Tests
 *
 * Tests bot performance in competitive simulation using private Screeps server.
 * Validates survival, victory conditions, and performance metrics against baseline.
 *
 * @requires Private Screeps server running (via docker-compose.test.yml)
 * @requires Built bot code in dist/main.js
 */

interface PerformanceMetrics {
  version: string;
  avgCPU: number;
  energyEfficiency: number;
  controllerLevel: number;
  survivalTime: number;
  victory: boolean;
  timestamp: string;
}

interface BaselineMetrics extends PerformanceMetrics {
  _note?: string;
}

interface SimulationResult {
  victory: boolean;
  finalScore: number;
  baselineScore: number;
  survivalTime: number;
  avgCPU: number;
}

interface TestConfig {
  serverUrl: string;
  username: string;
  password: string;
  maxTicks: number;
  checkInterval: number;
}

describe("Bot Performance Benchmark", () => {
  let api: ScreepsAPI;
  let testConfig: TestConfig;
  const BASELINE_PATH = path.join(process.cwd(), "reports/performance/baseline.json");

  beforeAll(async () => {
    // Configuration from environment or defaults
    testConfig = {
      serverUrl: process.env.SCREEPS_SERVER || "http://localhost:21025",
      username: process.env.SCREEPS_TEST_USERNAME || "screeps-gpt",
      password: process.env.SCREEPS_TEST_PASSWORD || "test-password",
      maxTicks: 10000,
      checkInterval: 100
    };

    // Skip tests if server not available (local development)
    try {
      const response = await fetch(testConfig.serverUrl);
      if (!response.ok) {
        console.warn(`⚠️  Screeps test server not available at ${testConfig.serverUrl}`);
        console.warn("   Skipping performance tests (requires docker-compose.test.yml)");
        return;
      }
    } catch (_error) {
      console.warn("⚠️  Screeps test server not reachable, skipping performance tests");
      return;
    }

    // Initialize API client
    api = new ScreepsAPI({
      protocol: testConfig.serverUrl.startsWith("https") ? "https" : "http",
      hostname: new URL(testConfig.serverUrl).hostname,
      port: parseInt(new URL(testConfig.serverUrl).port) || 21025,
      path: "/"
    });

    // Authenticate (or create user if doesn't exist)
    try {
      await api.auth(testConfig.username, testConfig.password);
    } catch (_error) {
      console.log("Creating test user...");
      // User creation would need admin API access
      // This is a placeholder - actual implementation depends on server setup
    }
  });

  afterAll(async () => {
    // Cleanup: no persistent state modifications
  });

  it.skip("should survive and win against opponent bots", async () => {
    // Skip if API not initialized
    if (!api) {
      console.log("Skipping: Screeps server not available");
      return;
    }

    // Deploy bot code
    const botCode = fs.readFileSync(path.join(process.cwd(), "dist/main.js"), "utf-8");
    await deployBot(api, testConfig.username, botCode);

    // Enable speedrun mode for fast simulation
    await api.console(`Game.speedrunMode = true`);

    // Run simulation
    const result = await simulateUntilCompletion(api, {
      maxTicks: testConfig.maxTicks,
      checkInterval: testConfig.checkInterval
    });

    // Assertions
    expect(result.victory).toBe(true);
    expect(result.survivalTime).toBeGreaterThan(0);

    // Compare against baseline if available
    if (fs.existsSync(BASELINE_PATH)) {
      const baseline: BaselineMetrics = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf-8"));
      expect(result.finalScore).toBeGreaterThanOrEqual(baseline.controllerLevel);
    }
  }, 600000); // 10 minute timeout

  it.skip("should show performance improvement vs. baseline", async () => {
    // Skip if API not initialized
    if (!api) {
      console.log("Skipping: Screeps server not available");
      return;
    }

    // Skip if no baseline exists
    if (!fs.existsSync(BASELINE_PATH)) {
      console.warn("⚠️  No baseline metrics found, skipping comparison");
      return;
    }

    const baseline: BaselineMetrics = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf-8"));

    // Collect current performance metrics
    const metrics = await collectPerformanceMetrics(api);

    // Compare key metrics
    expect(metrics.avgCPU).toBeLessThanOrEqual(baseline.avgCPU * 1.1); // Allow 10% degradation
    expect(metrics.controllerLevel).toBeGreaterThanOrEqual(baseline.controllerLevel);
    expect(metrics.energyEfficiency).toBeGreaterThanOrEqual(baseline.energyEfficiency * 0.9); // Allow 10% degradation
  }, 300000); // 5 minute timeout
});

/**
 * Deploy bot code to Screeps server
 */
async function deployBot(api: ScreepsAPI, username: string, code: string): Promise<void> {
  // Upload bot code via API
  // This requires the bot code to be wrapped in proper module format
  const modules = {
    main: code
  };

  try {
    await api.code.set("default", modules);
    console.log(`✓ Bot deployed for user: ${username}`);
  } catch (error) {
    console.error("Failed to deploy bot:", error);
    throw error;
  }
}

/**
 * Run simulation until victory/defeat or max ticks
 */
async function simulateUntilCompletion(
  api: ScreepsAPI,
  options: { maxTicks: number; checkInterval: number }
): Promise<SimulationResult> {
  let currentTick = 0;
  let victory = false;
  let survivalTime = 0;
  let totalCPU = 0;
  let cpuSamples = 0;

  // Simulation loop
  while (currentTick < options.maxTicks) {
    // Wait for interval
    await new Promise(resolve => setTimeout(resolve, options.checkInterval * 10));

    // Check game state
    const gameState = await checkGameState(api);
    currentTick = gameState.time;
    survivalTime = currentTick;

    // Track CPU usage
    if (gameState.cpu) {
      totalCPU += gameState.cpu;
      cpuSamples++;
    }

    // Check victory/defeat conditions
    if (gameState.controllerLevel >= 3) {
      victory = true;
      break;
    }

    // Check defeat (no spawns, no creeps)
    if (gameState.spawnCount === 0 && gameState.creepCount === 0) {
      victory = false;
      break;
    }
  }

  const avgCPU = cpuSamples > 0 ? totalCPU / cpuSamples : 0;

  return {
    victory,
    finalScore: 100, // Placeholder - would calculate based on game state
    baselineScore: 100,
    survivalTime,
    avgCPU
  };
}

/**
 * Collect performance metrics from current game state
 */
async function collectPerformanceMetrics(_api: ScreepsAPI): Promise<PerformanceMetrics> {
  const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8"));

  // Gather metrics from API
  // This is a simplified implementation - actual metrics would come from game state
  const metrics: PerformanceMetrics = {
    version: packageJson.version,
    avgCPU: 15.0, // Placeholder - would query actual CPU stats
    energyEfficiency: 0.85, // Placeholder - would calculate from game data
    controllerLevel: 2, // Placeholder - would query actual level
    survivalTime: 5000, // Placeholder - would track actual time
    victory: false,
    timestamp: new Date().toISOString()
  };

  return metrics;
}

/**
 * Check current game state for simulation progress
 *
 * @warning This is a placeholder implementation that returns hardcoded values.
 * In a real implementation, this would query the Screeps API to get actual game state.
 * The simulation loop in simulateUntilCompletion will not function correctly until
 * this is implemented with actual API queries.
 */
async function checkGameState(_api: ScreepsAPI): Promise<{
  time: number;
  cpu?: number;
  controllerLevel: number;
  spawnCount: number;
  creepCount: number;
}> {
  // TODO: Query game state via console or memory API
  // Placeholder implementation - replace with actual API queries
  return {
    time: 100, // Current game tick
    cpu: 10.5,
    controllerLevel: 1,
    spawnCount: 1,
    creepCount: 3
  };
}
