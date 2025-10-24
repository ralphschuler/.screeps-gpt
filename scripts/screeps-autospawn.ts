import process from "node:process";
import { writeFile } from "node:fs/promises";
import { ScreepsAPI } from "screeps-api";

interface WorldStatusResponse {
  ok: number;
  status: "normal" | "lost" | "empty";
}

interface WorldStartRoomResponse {
  ok: number;
  room: string[];
}

interface RoomTerrainResponse {
  ok: number;
  terrain: Array<{
    _id: string;
    room: string;
    terrain: string;
    type: string;
  }>;
}

interface PlaceSpawnResponse {
  ok: number;
  result?: {
    ok: number;
    n?: number;
  };
}

interface ApiError extends Error {
  response?: {
    status?: number;
    data?: unknown;
  };
}

function isApiError(error: unknown): error is ApiError {
  return error instanceof Error && "response" in error;
}

/**
 * Set GitHub Actions output
 */
async function setOutput(name: string, value: string): Promise<void> {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    try {
      await writeFile(outputFile, `${name}=${value}\n`, { flag: "a" });
    } catch (err) {
      console.error(`Failed to write output ${name}:`, err);
    }
  }
}

/**
 * Find a suitable location for spawn placement in a room
 * Prioritizes locations near energy sources with accessible terrain
 */
function findSpawnLocation(terrain: string, roomName: string): { x: number; y: number } {
  // Terrain is a 50x50 grid encoded as a string (2500 characters)
  // Each character represents: 0=plain, 1=wall, 2=swamp, 3=wall
  const ROOM_SIZE = 50;

  // Try to find a plain tile near the center, avoiding edges
  const centerX = 25;
  const centerY = 25;
  const searchRadius = 10;

  // Search in expanding circles from center
  for (let radius = 0; radius < searchRadius; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
          const x = centerX + dx;
          const y = centerY + dy;

          // Check bounds
          if (x < 3 || x > ROOM_SIZE - 3 || y < 3 || y > ROOM_SIZE - 3) continue;

          // Get terrain at position
          const index = y * ROOM_SIZE + x;
          const terrainCode = terrain[index];

          // Place on plain terrain (0)
          if (terrainCode === "0") {
            console.log(`  Found suitable location at (${x}, ${y}) in ${roomName}`);
            return { x, y };
          }
        }
      }
    }
  }

  // Fallback to center if no plain terrain found
  console.log(`  Using fallback center location (${centerX}, ${centerY}) in ${roomName}`);
  return { x: centerX, y: centerY };
}

/**
 * Perform respawn operation: trigger respawn, select room, and place spawn
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function performRespawn(api: any): Promise<boolean> {
  try {
    // Step 1: Trigger respawn
    console.log("  Step 1: Triggering respawn...");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const respawnResult = await api.raw.user.respawn();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!respawnResult.ok) {
      console.error("  ✗ Failed to trigger respawn");
      return false;
    }
    console.log("  ✓ Respawn triggered successfully");

    // Step 2: Get a suitable start room
    console.log("  Step 2: Finding suitable start room...");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const startRoomResult = (await api.raw.user.worldStartRoom()) as WorldStartRoomResponse;

    if (!startRoomResult.ok || !startRoomResult.room || startRoomResult.room.length === 0) {
      console.error("  ✗ Failed to get start room");
      return false;
    }

    const roomName = startRoomResult.room[0];
    console.log(`  ✓ Selected room: ${roomName}`);

    // Step 3: Get room terrain to find spawn location
    console.log("  Step 3: Analyzing room terrain...");

    // Parse shard and room from roomName format "shard3/E45S25"
    const splitRoom = roomName.split("/");
    if (splitRoom.length !== 2) {
      console.error(`  ✗ Unexpected roomName format: "${roomName}". Expected "shard/room".`);
      return false;
    }
    const [shardName, actualRoomName] = splitRoom;
    console.log(`  Parsed shard: ${shardName}, room: ${actualRoomName}`);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const terrainResult = (await api.raw.game.roomTerrain(actualRoomName, 1, shardName)) as RoomTerrainResponse;

    if (!terrainResult.ok || !terrainResult.terrain || terrainResult.terrain.length === 0) {
      console.error("  ✗ Failed to get room terrain");
      return false;
    }

    const terrain = terrainResult.terrain[0].terrain;
    const spawnLocation = findSpawnLocation(terrain, roomName);

    // Step 4: Place the spawn
    console.log(`  Step 4: Placing spawn at (${spawnLocation.x}, ${spawnLocation.y})...`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const placeResult = (await api.raw.game.placeSpawn(
      actualRoomName,
      spawnLocation.x,
      spawnLocation.y,
      "Spawn1",
      shardName
    )) as PlaceSpawnResponse;

    if (!placeResult.ok) {
      console.error("  ✗ Failed to place spawn");
      return false;
    }

    console.log("  ✓ Spawn placed successfully!");
    return true;
  } catch (error) {
    console.error("  ✗ Error during respawn process:", error);
    return false;
  }
}

/**
 * Check spawn status and perform auto-respawn if needed
 */
async function checkAndRespawn(): Promise<void> {
  const token = process.env.SCREEPS_TOKEN;
  if (!token) {
    throw new Error("SCREEPS_TOKEN is required for autospawner");
  }

  const hostname = process.env.SCREEPS_HOST || "screeps.com";
  const protocol = process.env.SCREEPS_PROTOCOL || "https";
  const port = Number(process.env.SCREEPS_PORT || 443);
  const path = process.env.SCREEPS_PATH || "/";

  console.log(`🔍 Checking spawn status on ${hostname}:${port}${path}...`);

  const api = new ScreepsAPI({ token, hostname, protocol, port, path });

  try {
    // Check current world status using the API's raw.user.worldStatus() method
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const statusResult = (await (api as any).raw.user.worldStatus()) as WorldStatusResponse;

    if (!statusResult.ok) {
      throw new Error("Failed to retrieve world status from Screeps API");
    }

    const { status } = statusResult;
    console.log(`📊 Current spawn status: ${status}`);

    // Early exit if bot is already spawned
    if (status === "normal") {
      console.log("✅ Bot is already spawned and active. No action needed.");
      await setOutput("status", status);
      await setOutput("action", "none");
      return;
    }

    // Handle lost status - need to respawn
    if (status === "lost") {
      console.log("⚠️ Bot lost all spawns. Initiating automatic respawn...");
      console.log("🚀 Starting respawn process...");

      const success = await performRespawn(api);

      if (success) {
        console.log("✅ Automatic respawn completed successfully!");
        await setOutput("status", "normal");
        await setOutput("action", "respawned");
        return;
      } else {
        console.error("❌ Automatic respawn failed. Manual intervention required.");
        await setOutput("status", status);
        await setOutput("action", "failed");
        process.exitCode = 1;
        return;
      }
    }

    // Handle empty status - respawn triggered but spawn not placed yet
    if (status === "empty") {
      console.log("⚠️ Bot respawned but spawn not placed yet. Placing spawn...");

      try {
        // Get start room
        console.log("  Finding start room...");
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const startRoomResult = (await (api as any).raw.user.worldStartRoom()) as WorldStartRoomResponse;

        if (!startRoomResult.ok || !startRoomResult.room || startRoomResult.room.length === 0) {
          throw new Error("Failed to get start room");
        }

        const roomName = startRoomResult.room[0];
        console.log(`  Selected room: ${roomName}`);

        // Get terrain
        console.log("  Analyzing terrain...");

        // Parse shard and room from roomName format "shard3/E45S25"
        const splitRoom = roomName.split("/");
        if (splitRoom.length !== 2) {
          throw new Error(`Unexpected roomName format: "${roomName}". Expected "shard/room".`);
        }
        const [shardName, actualRoomName] = splitRoom;
        console.log(`  Parsed shard: ${shardName}, room: ${actualRoomName}`);

        // eslint-disable-next-line @typescript-eslint/await-thenable
        const terrainResult = (await api.raw.game.roomTerrain(actualRoomName, 1, shardName)) as RoomTerrainResponse;

        console.log("  Terrain API response:", JSON.stringify(terrainResult, null, 2));

        if (!terrainResult.ok || !terrainResult.terrain || terrainResult.terrain.length === 0) {
          throw new Error(`Failed to get room terrain - API response: ${JSON.stringify(terrainResult)}`);
        }

        const terrain = terrainResult.terrain[0].terrain;
        const spawnLocation = findSpawnLocation(terrain, roomName);

        // Place spawn
        console.log(`  Placing spawn at (${spawnLocation.x}, ${spawnLocation.y})...`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const placeResult = (await (api as any).raw.game.placeSpawn(
          actualRoomName,
          spawnLocation.x,
          spawnLocation.y,
          "Spawn1",
          shardName
        )) as PlaceSpawnResponse;

        if (!placeResult.ok) {
          throw new Error("Failed to place spawn");
        }

        console.log("✅ Spawn placed successfully!");
        await setOutput("status", "normal");
        await setOutput("action", "spawn_placed");
        return;
      } catch (error) {
        console.error("❌ Failed to place spawn:", error);
        console.error("   Manual spawn placement required through Screeps web interface.");
        await setOutput("status", status);
        await setOutput("action", "failed");
        process.exitCode = 1;
        return;
      }
    }

    // Unknown status
    console.warn(`⚠️ Unknown spawn status: ${String(status)}`);
    await setOutput("status", String(status));
    await setOutput("action", "none");
  } catch (error: unknown) {
    if (isApiError(error)) {
      console.error("❌ Failed to check spawn status:");
      console.error(`   Error: ${error.message}`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, error.response.data);
      }
    } else {
      console.error("❌ Unexpected error checking spawn status:", error);
    }
    throw error;
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    await checkAndRespawn();
  } catch (error) {
    console.error("Autospawn check failed:", error);
    process.exitCode = 1;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
}

export { checkAndRespawn };
