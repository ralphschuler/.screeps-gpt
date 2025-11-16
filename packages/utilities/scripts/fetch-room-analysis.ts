import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { ScreepsAPI } from "screeps-api";

interface ConsoleResponse {
  ok: number;
  data: string;
  error?: string;
}

interface OccupiedRoom {
  name: string;
  controller?: {
    level: number;
    owner: string;
    reservation?: {
      username: string;
      ticksToEnd: number;
    };
  };
  energyAvailable?: number;
  energyCapacityAvailable?: number;
  structures?: {
    spawns: number;
    extensions: number;
    towers: number;
    storage: boolean;
    terminal: boolean;
  };
}

interface AdjacentRoom {
  name: string;
  distance: number;
  status?: string;
  owner?: string;
  level?: number;
  hostile: boolean;
  noviceZone: boolean;
}

interface RoomAnalysis {
  fetchedAt: string;
  shard: string;
  occupiedRooms: OccupiedRoom[];
  adjacentRooms: AdjacentRoom[];
  summary: {
    totalOccupied: number;
    totalAdjacent: number;
    hostileAdjacent: number;
    neutralAdjacent: number;
    friendlyAdjacent: number;
    noviceZones: number;
  };
}

/**
 * Parse room coordinates from room name
 */
function parseRoomCoordinates(roomName: string): { x: number; y: number } | null {
  const match = roomName.match(/^([WE])(\d+)([NS])(\d+)$/);
  if (!match) return null;

  const [, xDir, xNum, yDir, yNum] = match;
  const x = xDir === "W" ? -parseInt(xNum, 10) - 1 : parseInt(xNum, 10);
  const y = yDir === "N" ? -parseInt(yNum, 10) - 1 : parseInt(yNum, 10);

  return { x, y };
}

/**
 * Generate room name from coordinates
 */
function generateRoomName(x: number, y: number): string {
  const xDir = x < 0 ? "W" : "E";
  const yDir = y < 0 ? "N" : "S";
  const xNum = Math.abs(x < 0 ? x + 1 : x);
  const yNum = Math.abs(y < 0 ? y + 1 : y);
  return `${xDir}${xNum}${yDir}${yNum}`;
}

/**
 * Get all adjacent room names
 */
function getAdjacentRooms(roomName: string): string[] {
  const coords = parseRoomCoordinates(roomName);
  if (!coords) return [];

  const adjacent: string[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      adjacent.push(generateRoomName(coords.x + dx, coords.y + dy));
    }
  }
  return adjacent;
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
        console.error(`  ❌ Console command failed (attempt ${attempt}/${retries})`);
        console.error(`     Error: ${response.error || "Unknown error"}`);
        console.error(`     Response data:`, response);
        throw new Error(response.error || "Console command failed");
      }

      return response.data;
    } catch (error) {
      if (attempt === retries) {
        console.error(`  ❌ All retry attempts exhausted`);
        if (error instanceof Error) {
          console.error(`     Error: ${error.message}`);
          // Log response data if available (for API errors)
          const apiError = error as Error & { response?: { status?: number; data?: unknown } };
          if (apiError.response) {
            console.error(`     Status: ${apiError.response.status}`);
            console.error(`     Response data:`, apiError.response.data);
          }
        }
        throw error;
      }

      const waitTime = delayMs * Math.pow(2, attempt - 1);
      console.log(`  Retry ${attempt}/${retries} after ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  throw new Error("Unexpected: No response after retries");
}

/**
 * Fetch occupied rooms from the game
 */
async function fetchOccupiedRooms(api: ScreepsAPI, shard: string): Promise<OccupiedRoom[]> {
  console.log("  Fetching occupied rooms data...");

  const roomsCommand = `
    JSON.stringify(
      Object.values(Game.rooms)
        .filter(r => r.controller && r.controller.my)
        .map(r => ({
          name: r.name,
          controller: {
            level: r.controller.level,
            owner: r.controller.owner?.username || 'unknown'
          },
          energyAvailable: r.energyAvailable,
          energyCapacityAvailable: r.energyCapacityAvailable,
          structures: {
            spawns: r.find(FIND_MY_SPAWNS).length,
            extensions: r.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTENSION }}).length,
            towers: r.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER }}).length,
            storage: !!r.storage,
            terminal: !!r.terminal
          }
        }))
    )
  `.trim();

  const data = await executeConsoleCommand(api, roomsCommand, shard);

  // Defensive parsing: handle undefined/empty responses when bot has no game presence
  let rooms: OccupiedRoom[];
  try {
    if (data === "undefined" || data === "" || data === "null") {
      console.log("  ⚠ Console returned undefined/empty response, treating as no rooms");
      rooms = [];
    } else {
      rooms = JSON.parse(data) as OccupiedRoom[];
      if (!Array.isArray(rooms)) {
        console.log("  ⚠ Console returned non-array, using empty array");
        rooms = [];
      }
    }
  } catch (parseError) {
    console.error("  ❌ JSON parse failed, treating as no rooms:", parseError);
    rooms = [];
  }

  console.log(`  ✓ Found ${rooms.length} occupied room(s)`);
  return rooms;
}

/**
 * Fetch adjacent room information using the Screeps API
 */
async function fetchAdjacentRoomInfo(
  api: ScreepsAPI,
  roomNames: string[],
  shard: string,
  myUsername: string
): Promise<AdjacentRoom[]> {
  console.log(`  Fetching data for ${roomNames.length} adjacent rooms...`);

  const adjacentRooms: AdjacentRoom[] = [];

  // Query room status in batches to avoid API rate limits
  const batchSize = 10;
  for (let i = 0; i < roomNames.length; i += batchSize) {
    const batch = roomNames.slice(i, i + batchSize);

    // Use console to check room visibility and basic info
    const roomInfoCommand = `
      JSON.stringify(${JSON.stringify(batch)}.map(roomName => {
        const room = Game.rooms[roomName];
        if (!room) {
          return { name: roomName, visible: false };
        }
        return {
          name: roomName,
          visible: true,
          owner: room.controller?.owner?.username,
          level: room.controller?.level,
          reservation: room.controller?.reservation?.username,
          safeMode: room.controller?.safeMode
        };
      }))
    `.trim();

    try {
      const data = await executeConsoleCommand(api, roomInfoCommand, shard);
      const roomInfos = JSON.parse(data) as Array<{
        name: string;
        visible: boolean;
        owner?: string;
        level?: number;
        reservation?: string;
        safeMode?: number;
      }>;

      for (const info of roomInfos) {
        const isHostile = info.owner && info.owner !== myUsername;
        const isReserved = !!info.reservation;

        adjacentRooms.push({
          name: info.name,
          distance: 1, // All adjacent rooms are distance 1
          status: info.visible ? (info.owner ? "owned" : isReserved ? "reserved" : "neutral") : "unknown",
          owner: info.owner,
          level: info.level,
          hostile: !!isHostile,
          noviceZone: false // Will be updated if we can access room status API
        });
      }
    } catch {
      console.error(`  ⚠ Failed to fetch batch ${i / batchSize + 1}`);
      // Add rooms as unknown
      for (const roomName of batch) {
        adjacentRooms.push({
          name: roomName,
          distance: 1,
          status: "unknown",
          hostile: false,
          noviceZone: false
        });
      }
    }

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < roomNames.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`  ✓ Analyzed ${adjacentRooms.length} adjacent room(s)`);
  return adjacentRooms;
}

/**
 * Get username from the console (using documented API)
 */
async function getUsername(api: ScreepsAPI, shard: string): Promise<string> {
  try {
    // Use the documented POST /api/user/console endpoint
    // This is officially documented in https://docs.screeps.com/auth-tokens.html
    const command =
      "JSON.stringify({username:Object.keys(Game.spawns).length?Object.values(Game.spawns)[0]?.owner?.username:'unknown'})";
    const response = (await api.console(command, shard)) as ConsoleResponse;

    if (response.ok && response.data) {
      const data = JSON.parse(response.data);
      if (data.username) {
        return data.username;
      }
    }
  } catch (err) {
    console.error(
      "  ⚠ Failed to get username from console, using fallback:",
      err instanceof Error ? err.message : String(err)
    );
  }

  // Fallback: return unknown
  return "unknown";
}

/**
 * Perform room analysis
 */
async function performRoomAnalysis(): Promise<RoomAnalysis> {
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

  console.log(`Analyzing rooms on ${hostname} shard ${shard}...`);

  try {
    // Check for bot presence first to avoid unnecessary API calls
    const presenceCheck = await executeConsoleCommand(api, "Object.keys(Game.rooms).length", shard);
    const visibleRooms = parseInt(presenceCheck, 10);

    if (isNaN(visibleRooms) || visibleRooms === 0) {
      console.log("  ⚠ Bot has no visible rooms - skipping detailed analysis");
      console.log("  💡 Bot may have lost spawn or needs respawn");
      console.log("  💡 Check bot spawn status: https://github.com/ralphschuler/.screeps-gpt/issues/826");
      return {
        fetchedAt: new Date().toISOString(),
        shard,
        occupiedRooms: [],
        adjacentRooms: [],
        summary: {
          totalOccupied: 0,
          totalAdjacent: 0,
          hostileAdjacent: 0,
          neutralAdjacent: 0,
          friendlyAdjacent: 0,
          noviceZones: 0
        }
      };
    }

    console.log(`  ℹ Bot has visibility of ${visibleRooms} room(s)`);

    // Get username
    const username = await getUsername(api, shard);
    console.log(`  Username: ${username}`);

    // Fetch occupied rooms
    const occupiedRooms = await fetchOccupiedRooms(api, shard);

    if (occupiedRooms.length === 0) {
      console.log("  ⚠ No occupied rooms found (bot may have no spawns)");
      console.log("  💡 Check bot spawn status: https://github.com/ralphschuler/.screeps-gpt/issues/826");
      return {
        fetchedAt: new Date().toISOString(),
        shard,
        occupiedRooms: [],
        adjacentRooms: [],
        summary: {
          totalOccupied: 0,
          totalAdjacent: 0,
          hostileAdjacent: 0,
          neutralAdjacent: 0,
          friendlyAdjacent: 0,
          noviceZones: 0
        }
      };
    }

    // Get all adjacent rooms (deduplicated)
    const allAdjacentRoomNames = new Set<string>();
    for (const room of occupiedRooms) {
      const adjacent = getAdjacentRooms(room.name);
      for (const adj of adjacent) {
        // Skip if it's one of our occupied rooms
        if (!occupiedRooms.some(r => r.name === adj)) {
          allAdjacentRoomNames.add(adj);
        }
      }
    }

    console.log(`  Found ${allAdjacentRoomNames.size} unique adjacent rooms`);

    // Fetch adjacent room info
    const adjacentRooms = await fetchAdjacentRoomInfo(api, Array.from(allAdjacentRoomNames), shard, username);

    // Calculate summary
    const summary = {
      totalOccupied: occupiedRooms.length,
      totalAdjacent: adjacentRooms.length,
      hostileAdjacent: adjacentRooms.filter(r => r.hostile).length,
      neutralAdjacent: adjacentRooms.filter(r => r.status === "neutral").length,
      friendlyAdjacent: adjacentRooms.filter(r => r.owner === username && !r.hostile).length,
      noviceZones: adjacentRooms.filter(r => r.noviceZone).length
    };

    console.log(`✓ Room analysis completed`);
    console.log(`  Occupied: ${summary.totalOccupied}`);
    console.log(
      `  Adjacent: ${summary.totalAdjacent} (${summary.hostileAdjacent} hostile, ${summary.neutralAdjacent} neutral, ${summary.friendlyAdjacent} friendly)`
    );

    return {
      fetchedAt: new Date().toISOString(),
      shard,
      occupiedRooms,
      adjacentRooms,
      summary
    };
  } catch (error) {
    console.error(`❌ Failed to perform room analysis:`);
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
    throw error;
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const analysis = await performRoomAnalysis();

    // Save to reports directory
    const outputDir = resolve("reports", "room-analysis");
    mkdirSync(outputDir, { recursive: true });

    const filePath = resolve(outputDir, "latest.json");
    writeFileSync(filePath, JSON.stringify(analysis, null, 2));

    console.log(`\n💾 Room analysis saved to: ${filePath}`);

    // Save a timestamped version as well
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const timestampedPath = resolve(outputDir, `analysis-${timestamp}.json`);
    writeFileSync(timestampedPath, JSON.stringify(analysis, null, 2));

    console.log(`💾 Timestamped copy saved to: ${timestampedPath}`);
  } catch (error) {
    console.error("\n❌ Room analysis failed:");
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
    } else {
      console.error(`   Error: ${String(error)}`);
    }

    // Create failure snapshot
    try {
      const outputDir = resolve("reports", "room-analysis");
      mkdirSync(outputDir, { recursive: true });
      const filePath = resolve(outputDir, "latest.json");

      const failureSnapshot = {
        status: "failed",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
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

export { performRoomAnalysis };
export type { RoomAnalysis, OccupiedRoom, AdjacentRoom };
