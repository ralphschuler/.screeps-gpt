/**
 * Shard Discovery Service
 *
 * Provides functionality to discover all shards where the bot has active rooms.
 * This enables multi-shard monitoring and telemetry collection without manual
 * shard configuration.
 */

import { ScreepsAPI } from "screeps-api";
import process from "node:process";

/**
 * Information about a single shard
 */
export interface ShardInfo {
  name: string;
  rooms: string[];
}

/**
 * Result of shard discovery
 */
export interface ShardDiscoveryResult {
  shards: ShardInfo[];
  totalRooms: number;
  discoveredAt: string;
}

/**
 * Cached discovery result
 */
interface CachedResult {
  result: ShardDiscoveryResult;
  expiresAt: number;
}

// Cache duration in milliseconds (5 minutes by default)
const CACHE_DURATION_MS = 5 * 60 * 1000;

// Module-level cache
let cachedDiscovery: CachedResult | null = null;

/**
 * User rooms response from Screeps API
 */
interface UserRoomsResponse {
  ok: number;
  error?: string;
  shards?: Record<string, string[]>;
}

/**
 * Initialize Screeps API client with environment configuration
 */
function initializeApi(): ScreepsAPI {
  const token = process.env.SCREEPS_TOKEN;
  if (!token) {
    throw new Error("SCREEPS_TOKEN environment variable is required");
  }

  const hostname = process.env.SCREEPS_HOST || "screeps.com";
  const protocol = process.env.SCREEPS_PROTOCOL || "https";
  const port = process.env.SCREEPS_PORT ? parseInt(process.env.SCREEPS_PORT, 10) : undefined;
  const path = process.env.SCREEPS_PATH || "/";

  return new ScreepsAPI({ token, hostname, protocol, port, path });
}

/**
 * Get the default shard from environment or fallback
 */
function getDefaultShard(): string {
  return process.env.SCREEPS_SHARD || "shard3";
}

/**
 * Fetch user rooms using the /api/user/rooms endpoint
 * This endpoint returns a mapping of shards to room names
 */
async function fetchUserRooms(api: ScreepsAPI): Promise<UserRoomsResponse> {
  try {
    // Use the raw API to access user rooms endpoint
    const response = (await api.raw.user.rooms()) as UserRoomsResponse;
    return response;
  } catch (error) {
    console.warn("Failed to fetch user rooms via raw API:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Discover all shards where the bot has active rooms using the user/rooms endpoint
 *
 * @param api - Optional ScreepsAPI instance. If not provided, one will be created.
 * @param useCache - Whether to use cached results (default: true)
 * @returns Discovery result with all shards and their rooms
 */
export async function discoverBotShards(api?: ScreepsAPI, useCache = true): Promise<ShardDiscoveryResult> {
  // Check cache first
  if (useCache && cachedDiscovery && Date.now() < cachedDiscovery.expiresAt) {
    console.log("Using cached shard discovery result");
    return cachedDiscovery.result;
  }

  const apiInstance = api || initializeApi();
  const defaultShard = getDefaultShard();
  const discoveredAt = new Date().toISOString();

  console.log("Discovering bot shards...");

  try {
    // Try to fetch rooms using the user/rooms endpoint
    const roomsResponse = await fetchUserRooms(apiInstance);

    if (!roomsResponse.ok) {
      throw new Error(roomsResponse.error || "Failed to fetch user rooms");
    }

    const shards: ShardInfo[] = [];
    let totalRooms = 0;

    if (roomsResponse.shards && typeof roomsResponse.shards === "object") {
      // The response contains a mapping of shard names to room arrays
      for (const [shardName, rooms] of Object.entries(roomsResponse.shards)) {
        if (Array.isArray(rooms) && rooms.length > 0) {
          shards.push({
            name: shardName,
            rooms: rooms
          });
          totalRooms += rooms.length;
        }
      }
    }

    // Sort shards by name for consistent ordering
    shards.sort((a, b) => a.name.localeCompare(b.name));

    const result: ShardDiscoveryResult = {
      shards,
      totalRooms,
      discoveredAt
    };

    // If no shards found, fall back to the default shard
    if (shards.length === 0) {
      console.warn(`No shards discovered, falling back to default shard: ${defaultShard}`);
      result.shards = [{ name: defaultShard, rooms: [] }];
    }

    // Cache the result
    cachedDiscovery = {
      result,
      expiresAt: Date.now() + CACHE_DURATION_MS
    };

    console.log(`Discovered ${result.shards.length} shard(s) with ${result.totalRooms} room(s)`);
    for (const shard of result.shards) {
      console.log(`  ${shard.name}: ${shard.rooms.length} room(s)`);
      if (shard.rooms.length > 0 && shard.rooms.length <= 5) {
        console.log(`    Rooms: ${shard.rooms.join(", ")}`);
      } else if (shard.rooms.length > 5) {
        console.log(`    Rooms: ${shard.rooms.slice(0, 5).join(", ")} ... and ${shard.rooms.length - 5} more`);
      }
    }

    return result;
  } catch (error) {
    console.error("Shard discovery failed:", error instanceof Error ? error.message : String(error));

    // Fall back to the default shard on error
    console.warn(`Falling back to default shard: ${defaultShard}`);

    const fallbackResult: ShardDiscoveryResult = {
      shards: [{ name: defaultShard, rooms: [] }],
      totalRooms: 0,
      discoveredAt
    };

    return fallbackResult;
  }
}

/**
 * Clear the cached discovery result
 */
export function clearShardDiscoveryCache(): void {
  cachedDiscovery = null;
  console.log("Shard discovery cache cleared");
}

/**
 * Get the cache status
 */
export function getShardDiscoveryCacheStatus(): {
  isCached: boolean;
  expiresIn: number | null;
} {
  if (!cachedDiscovery) {
    return { isCached: false, expiresIn: null };
  }

  const expiresIn = cachedDiscovery.expiresAt - Date.now();
  if (expiresIn <= 0) {
    return { isCached: false, expiresIn: null };
  }

  return { isCached: true, expiresIn };
}

/**
 * Main entry point for testing
 */
async function main(): Promise<void> {
  console.log("=== Shard Discovery Service ===\n");

  try {
    const result = await discoverBotShards();

    console.log("\n=== Discovery Result ===");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Failed to discover shards:", error);
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
