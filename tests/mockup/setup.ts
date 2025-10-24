export interface MockupBot {
  memory: Promise<Record<string, unknown>>;
}

export interface MockupServerWorld {
  reset(): Promise<void>;
  stubWorld(): Promise<void>;
  addBot(options: {
    username: string;
    room: string;
    x: number;
    y: number;
    modules: Record<string, string>;
  }): Promise<MockupBot>;
  addRoom(roomName: string): Promise<void>;
  addRoomObject(roomName: string, type: string, x: number, y: number, details: Record<string, unknown>): Promise<void>;
  readonly gameTime: Promise<number>;
}

export interface MockupServerInstance {
  world: MockupServerWorld;
  start(): Promise<void>;
  tick(): Promise<void>;
  stop(): void;
}

export type MockupTerrainMatrix = Record<string, unknown>;

interface ScreepsServerMockupModule {
  ScreepsServer: new () => MockupServerInstance;
  TerrainMatrix: new () => MockupTerrainMatrix;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMockupModule(value: unknown): value is ScreepsServerMockupModule {
  return isRecord(value) && typeof value.ScreepsServer === "function" && typeof value.TerrainMatrix === "function";
}

async function loadMockupModule(): Promise<ScreepsServerMockupModule> {
  const module: unknown = await import("screeps-server-mockup");
  if (!isMockupModule(module)) {
    throw new Error("screeps-server-mockup module does not expose expected exports");
  }
  return module;
}

/**
 * Creates and initializes a Screeps server instance for testing with mockup.
 * @returns A configured mockup server instance with a stubbed world.
 */
export async function createTestServer(): Promise<MockupServerInstance> {
  // Dynamic import to handle cases where isolated-vm isn't available
  const mockupModule = await loadMockupModule();
  const server = new mockupModule.ScreepsServer();
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
export async function createTerrain(): Promise<MockupTerrainMatrix> {
  const mockupModule = await loadMockupModule();
  return new mockupModule.TerrainMatrix();
}

/**
 * Cleanup helper to properly stop the server.
 * @param server - The server instance to stop.
 */
export function cleanupServer(server: MockupServerInstance): void {
  try {
    server.stop();
  } catch {
    // Ignore cleanup errors
  }
}
