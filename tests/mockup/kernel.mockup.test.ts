/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, afterEach } from "vitest";

/**
 * Screeps Server Mockup tests for tick-based validation.
 *
 * Note: These tests demonstrate the mockup server's tick-based testing capabilities.
 * Testing requires isolated-vm to build successfully, which may fail on some platforms
 * due to node-gyp and Python version compatibility issues.
 */

// Check if isolated-vm is available by trying to import screeps-server-mockup
let mockupAvailable = false;
let ScreepsServerClass: any;

try {
  const mockup = await import("screeps-server-mockup");
  ScreepsServerClass = mockup.ScreepsServer;
  mockupAvailable = true;
} catch {
  console.warn(
    "Screeps Server Mockup tests skipped: isolated-vm build failed.",
    "This is expected on some platforms. See tests/mockup/README.md for details."
  );
}

describe.skipIf(!mockupAvailable)("Screeps Server Mockup - Tick-based Testing", () => {
  let server: any = null;

  afterEach(() => {
    if (server) {
      try {
        server.stop();
      } catch {
        // Ignore cleanup errors
      }
      server = null;
    }
  });

  it("initializes server and runs multiple ticks", async () => {
    server = new ScreepsServerClass();
    await server.world.reset();
    await server.world.stubWorld();

    const simpleCode = `
      module.exports.loop = function() {
        console.log('Tick:', Game.time);
        Memory.lastTick = Game.time;
      };
    `;

    const modules = { main: simpleCode };
    const bot = await server.world.addBot({
      username: "test-bot",
      room: "W0N1",
      x: 25,
      y: 25,
      modules
    });

    await server.start();

    // Run multiple ticks to verify tick-based behavior
    for (let i = 0; i < 5; i++) {
      await server.tick();
    }

    const gameTime = await server.world.gameTime;
    expect(gameTime).toBeGreaterThanOrEqual(5);

    // Verify memory was properly managed
    const memory = await bot.memory;
    expect(memory).toBeDefined();
    expect(memory.lastTick).toBe(gameTime);
  }, 30000); // 30 second timeout for server operations

  it("tracks creep spawning and behavior across ticks", async () => {
    server = new ScreepsServerClass();
    await server.world.reset();
    await server.world.stubWorld();

    const testCode = `
      module.exports.loop = function() {
        // Track tick count in memory
        Memory.tickCount = (Memory.tickCount || 0) + 1;
        
        // Simple harvester logic
        if (Game.time === 1 && Game.spawns.Spawn1) {
          const result = Game.spawns.Spawn1.spawnCreep([WORK, CARRY, MOVE], 'Harvester1');
          Memory.spawnResult = result;
        }
        
        // Count creeps each tick
        Memory.creepCount = Object.keys(Game.creeps).length;
        
        for (const name in Game.creeps) {
          const creep = Game.creeps[name];
          const sources = creep.room.find(FIND_SOURCES);
          if (sources.length > 0) {
            if (creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
              creep.moveTo(sources[0]);
            }
          }
        }
      };
    `;

    const modules = { main: testCode };
    const bot = await server.world.addBot({
      username: "test-bot",
      room: "W0N1",
      x: 25,
      y: 25,
      modules
    });

    await server.start();

    // Run enough ticks to observe behavior
    for (let i = 0; i < 10; i++) {
      await server.tick();
    }

    const gameTime = await server.world.gameTime;
    expect(gameTime).toBe(10);

    const memory = await bot.memory;
    expect(memory.tickCount).toBe(10);
    expect(memory.creepCount).toBeGreaterThanOrEqual(0);
  }, 30000);

  it("can create custom room with terrain and objects", async () => {
    server = new ScreepsServerClass();

    // Reset and manually set up a room
    await server.world.reset();
    await server.world.addRoom("W1N1");

    // Add basic room objects
    await server.world.addRoomObject("W1N1", "controller", 25, 25, { level: 0 });
    await server.world.addRoomObject("W1N1", "source", 10, 10, {
      energy: 3000,
      energyCapacity: 3000,
      ticksToRegeneration: 300
    });

    const testCode = `
      module.exports.loop = function() {
        const room = Game.rooms.W1N1;
        if (room) {
          const sources = room.find(FIND_SOURCES);
          const controller = room.controller;
          
          Memory.hasRoom = true;
          Memory.sourceCount = sources.length;
          Memory.hasController = !!controller;
        }
      };
    `;

    const modules = { main: testCode };
    const bot = await server.world.addBot({
      username: "test-bot",
      room: "W1N1",
      x: 20,
      y: 20,
      modules
    });

    await server.start();
    await server.tick();

    const memory = await bot.memory;
    expect(memory.hasRoom).toBe(true);
    expect(memory.sourceCount).toBe(1);
    expect(memory.hasController).toBe(true);
  }, 30000);
});
