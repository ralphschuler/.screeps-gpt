/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { ScreepsServer, TerrainMatrix } from "screeps-server-mockup";

/**
 * Creates and initializes a Screeps server instance for testing with mockup.
 * @returns A configured ScreepsServer instance with a stubbed world.
 */
export async function createTestServer(): Promise<ScreepsServer> {
  // Dynamic import to handle cases where isolated-vm isn't available
  const { ScreepsServer: Server } = await import("screeps-server-mockup");
  const server = new Server() as ScreepsServer;
  await server.world.reset();
  await server.world.stubWorld();
  return server;
}

/**
 * Creates a simple bot module for testing.
 * @param code - The main loop code for the bot.
 * @returns A modules object compatible with screeps-server-mockup.
 */
export function createBotModule(code: string): Record<string, string> {
  return {
    main: code
  };
}

/**
 * Helper to create a test terrain matrix.
 * @returns A new TerrainMatrix instance.
 */
export async function createTerrain(): Promise<TerrainMatrix> {
  const { TerrainMatrix: Matrix } = await import("screeps-server-mockup");
  return new Matrix() as TerrainMatrix;
}

/**
 * Cleanup helper to properly stop the server.
 * @param server - The server instance to stop.
 */
export function cleanupServer(server: ScreepsServer): void {
  try {
    server.stop();
  } catch {
    // Ignore cleanup errors
  }
}
