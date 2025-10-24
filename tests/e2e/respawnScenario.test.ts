import { describe, expect, it, vi } from "vitest";
import { Kernel } from "@runtime/bootstrap/kernel";
import type { GameContext } from "@runtime/types/GameContext";

const TEST_REALM = process.env.SCREEPS_TEST_REALM ?? "PTR";

describe(`Respawn Scenario (${TEST_REALM})`, () => {
  it("detects and handles spawn loss gracefully", () => {
    const logger = { log: vi.fn(), warn: vi.fn() };
    const kernel = new Kernel({ logger });

    // Initial state: no spawns, no creeps (respawn needed)
    const cpuReadings = { value: 0 };
    const game: GameContext = {
      time: 1000,
      cpu: {
        getUsed: () => cpuReadings.value,
        limit: 20,
        bucket: 1000
      },
      creeps: {},
      spawns: {},
      rooms: {}
    };

    const memory = {} as Memory;

    // Run the kernel
    kernel.run(game, memory);

    // Verify respawn state was detected and stored
    expect(memory.respawn).toBeDefined();
    expect(memory.respawn?.needsRespawn).toBe(true);
    expect(memory.respawn?.respawnRequested).toBe(true);
    expect(memory.respawn?.lastSpawnLostTick).toBe(1000);

    // Verify warning was logged
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("CRITICAL: All spawns lost"));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("No spawns and no creeps"));

    // Verify system report includes respawn finding
    expect(memory.systemReport).toBeDefined();
    expect(memory.systemReport?.report.findings).toBeDefined();
    const respawnFinding = memory.systemReport?.report.findings.find(f => f.title.toLowerCase().includes("respawn"));
    expect(respawnFinding).toBeDefined();
    expect(respawnFinding?.severity).toBe("critical");
  });

  it("continues normal operation when spawns are available", () => {
    const logger = { log: vi.fn(), warn: vi.fn() };
    const kernel = new Kernel({ logger });

    const source = { id: "source" } as Source;
    const controller = { id: "controller" } as StructureController;

    const spawnCreepMock = vi.fn(() => OK);
    const spawn = {
      name: "Spawn1",
      spawning: null,
      spawnCreep: spawnCreepMock,
      store: {
        getFreeCapacity: vi.fn(() => 300),
        getUsedCapacity: vi.fn(() => 0)
      },
      room: {
        controller,
        find: () => [source]
      }
    } as unknown as StructureSpawn;

    const room = {
      controller,
      find: (type: FindConstant) => {
        if (type === FIND_SOURCES_ACTIVE) {
          return [source];
        }
        if (type === FIND_STRUCTURES) {
          return [spawn as unknown as AnyStructure];
        }
        return [];
      }
    };

    const cpuReadings = { value: 0 };
    const game: GameContext = {
      time: 123,
      cpu: {
        getUsed: () => cpuReadings.value,
        limit: 20,
        bucket: 1000
      },
      creeps: {},
      spawns: { Spawn1: spawn },
      rooms: { W1N1: room }
    };

    const memory = {} as Memory;

    kernel.run(game, memory);

    // Verify no respawn state is set
    expect(memory.respawn?.needsRespawn).toBe(false);

    // Verify spawn was attempted
    expect(spawnCreepMock).toHaveBeenCalled();
  });

  it("recovers from respawn state when spawns return", () => {
    const logger = { log: vi.fn(), warn: vi.fn() };
    const kernel = new Kernel({ logger });

    // Start with respawn state already set
    const memory = {
      respawn: {
        needsRespawn: true,
        lastSpawnLostTick: 900,
        respawnRequested: true
      }
    } as Memory;

    // Game state now has a spawn (player respawned)
    const spawnCreepMock = vi.fn(() => OK);
    const spawn = {
      name: "Spawn1",
      spawning: null,
      spawnCreep: spawnCreepMock,
      store: {
        getFreeCapacity: vi.fn(() => 300),
        getUsedCapacity: vi.fn(() => 0)
      },
      room: {
        controller: { id: "controller" } as StructureController,
        find: () => []
      }
    } as unknown as StructureSpawn;

    const cpuReadings = { value: 0 };
    const game: GameContext = {
      time: 1000,
      cpu: {
        getUsed: () => cpuReadings.value,
        limit: 20,
        bucket: 1000
      },
      creeps: {},
      spawns: { Spawn1: spawn },
      rooms: { W1N1: spawn.room }
    };

    kernel.run(game, memory);

    // Verify respawn state was cleared
    expect(memory.respawn?.needsRespawn).toBe(false);
    expect(memory.respawn?.respawnRequested).toBe(false);
    expect(memory.respawn?.lastSpawnLostTick).toBeUndefined();

    // Verify log message
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("clearing respawn state"));
  });
});
