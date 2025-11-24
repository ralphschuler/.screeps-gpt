/**
 * Capture Screeps room history for video rendering
 *
 * This script fetches room history data from the Screeps API and stores it
 * for later video rendering. It supports configurable time windows and
 * multiple rooms.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ScreepsAPI } from "screeps-api";
import { loadVideoConfig, parseTimeWindow } from "./lib/video-config";
import { RoomReplayData } from "./types/video-pipeline";

interface ApiError extends Error {
  response?: {
    status?: number;
    data?: unknown;
  };
}

function isApiError(error: unknown): error is ApiError {
  return error instanceof Error;
}

/**
 * Initialize Screeps API client
 */
function initScreepsClient(): ScreepsAPI {
  const token = process.env.SCREEPS_TOKEN;
  if (!token) {
    throw new Error("SCREEPS_TOKEN environment variable is required");
  }

  const hostname = process.env.SCREEPS_HOST || "screeps.com";
  const protocol = process.env.SCREEPS_PROTOCOL || "https";
  const port = Number(process.env.SCREEPS_PORT || 443);
  const path = process.env.SCREEPS_PATH || "/";

  return new ScreepsAPI({
    token,
    protocol,
    hostname,
    port,
    path
  });
}

/**
 * Fetch room history for a specific room and time window
 */
async function fetchRoomHistory(
  api: ScreepsAPI,
  room: string,
  shard: string,
  startTick: number,
  endTick: number
): Promise<RoomReplayData> {
  console.log(`  Fetching history for ${room} on ${shard} from tick ${startTick} to ${endTick}...`);

  try {
    // Note: Screeps API room history endpoint structure:
    // GET /api/user/rooms?interval=<ticks>&shard=<shard>
    // This is a placeholder - actual API might differ
    const response = await api.raw.history.get("room", room, {
      shard,
      interval: endTick - startTick
    });

    const replayData: RoomReplayData = {
      room,
      shard,
      startTick,
      endTick,
      capturedAt: new Date().toISOString(),
      replayData: response
    };

    console.log(`    ✓ Captured ${endTick - startTick} ticks of history`);
    return replayData;
  } catch (error) {
    if (isApiError(error)) {
      console.error(`    ✗ Failed to fetch room history: ${error.message}`);
      if (error.response?.status === 404) {
        console.error(`      Room ${room} not found or no history available`);
      }
    }
    throw error;
  }
}

/**
 * Save replay data to disk
 */
async function saveReplayData(replayData: RoomReplayData): Promise<string> {
  const outputDir = resolve("reports", "replay-data");
  await mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${replayData.room}_${replayData.shard}_${timestamp}.json`;
  const filepath = resolve(outputDir, filename);

  await writeFile(filepath, JSON.stringify(replayData, null, 2), "utf8");
  console.log(`    ✓ Saved replay data to ${filepath}`);

  return filepath;
}

/**
 * Get current game tick for calculating relative time windows
 */
async function getCurrentTick(api: ScreepsAPI, shard: string): Promise<number> {
  try {
    // Fetch shard info to get current tick
    const shardInfo = await api.raw.game.shards.info(shard);
    return shardInfo.tick || 0;
  } catch (_error) {
    console.warn("Could not fetch current tick, using timestamp estimate");
    // Fallback: estimate tick from timestamp
    // Screeps launched ~2016, approximate tick calculation
    const screepsEpoch = new Date("2016-11-01").getTime();
    const now = Date.now();
    const msPerTick = 3000;
    return Math.floor((now - screepsEpoch) / msPerTick);
  }
}

/**
 * Main capture function
 */
async function captureRoomHistory(): Promise<void> {
  console.log("Starting room history capture...");

  // Load configuration
  const config = await loadVideoConfig();
  console.log(`Configuration loaded:`);
  console.log(`  Rooms: ${config.rooms.join(", ") || "(none specified)"}`);
  console.log(`  Shard: ${config.shard}`);
  console.log(`  Time window: ${config.timeWindow.start} to ${config.timeWindow.end}`);

  if (config.rooms.length === 0) {
    console.warn("⚠ No rooms specified in configuration");
    console.warn("  Set VIDEO_ROOMS environment variable or add to config file");
    console.warn("  Example: VIDEO_ROOMS=W7N3,E5S8");
    return;
  }

  // Initialize Screeps client
  const api = initScreepsClient();
  console.log("✓ Screeps API client initialized");

  // Calculate time window
  const currentTick = await getCurrentTick(api, config.shard);
  console.log(`Current tick: ${currentTick}`);

  const startOffset = parseTimeWindow(config.timeWindow.start);
  const endOffset = parseTimeWindow(config.timeWindow.end);

  const startTick = typeof config.timeWindow.start === "string" ? currentTick - startOffset : startOffset;
  const endTick = config.timeWindow.end === "now" ? currentTick : endOffset;

  console.log(`Calculated time window: ${startTick} to ${endTick} (${endTick - startTick} ticks)`);

  // Capture history for each room
  const capturedFiles: string[] = [];
  for (const room of config.rooms) {
    try {
      console.log(`Capturing ${room}...`);
      const replayData = await fetchRoomHistory(api, room, config.shard, startTick, endTick);
      const filepath = await saveReplayData(replayData);
      capturedFiles.push(filepath);
    } catch (error) {
      console.error(`Failed to capture ${room}:`, error);
      // Continue with other rooms
    }
  }

  console.log(`\n✓ Capture complete!`);
  console.log(`  Captured ${capturedFiles.length} of ${config.rooms.length} rooms`);
  console.log(`  Files saved to: reports/replay-data/`);

  if (capturedFiles.length === 0) {
    throw new Error("No room history data was captured successfully");
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  captureRoomHistory().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { captureRoomHistory };
