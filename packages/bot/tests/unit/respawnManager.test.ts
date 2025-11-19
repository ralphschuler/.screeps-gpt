import { describe, expect, it, vi } from "vitest";
import { RespawnManager } from "@runtime/respawn/RespawnManager";
import type { GameContext } from "@runtime/types/GameContext";

function createGameContext(options: { time: number; hasSpawns: boolean; hasCreeps: boolean }): GameContext {
  const dummyCreep = {
    name: "creep1",
    memory: { role: "harvester" },
    store: { getFreeCapacity: () => 0, getUsedCapacity: () => 0 },
    pos: { findClosestByPath: () => null },
    room: { controller: null, find: () => [] },
    harvest: () => OK,
    transfer: () => OK,
    moveTo: () => OK,
    upgradeController: () => OK,
    withdraw: () => OK
  };

  const dummySpawn = {
    name: "spawn1",
    spawning: null,
    spawnCreep: () => OK,
    store: { getFreeCapacity: () => 300, getUsedCapacity: () => 0 },
    room: { controller: null, find: () => [] }
  };

  return {
    time: options.time,
    cpu: {
      getUsed: () => 0,
      limit: 10,
      bucket: 1000
    },
    creeps: options.hasCreeps ? { creep1: dummyCreep } : {},
    spawns: options.hasSpawns ? { spawn1: dummySpawn } : {},
    rooms: {}
  };
}

describe("RespawnManager", () => {
  it("returns false when spawns are available", () => {
    const manager = new RespawnManager({ log: vi.fn(), warn: vi.fn() });
    const game = createGameContext({ time: 100, hasSpawns: true, hasCreeps: true });
    const memory = {} as Memory;

    const needsRespawn = manager.checkRespawnNeeded(game, memory);

    expect(needsRespawn).toBe(false);
    expect(memory.respawn?.needsRespawn).toBe(false);
  });

  it("detects when all spawns are lost", () => {
    const warn = vi.fn();
    const manager = new RespawnManager({ log: vi.fn(), warn });
    const game = createGameContext({ time: 100, hasSpawns: false, hasCreeps: true });
    const memory = {} as Memory;

    const needsRespawn = manager.checkRespawnNeeded(game, memory);

    expect(needsRespawn).toBe(true);
    expect(memory.respawn?.needsRespawn).toBe(true);
    expect(memory.respawn?.lastSpawnLostTick).toBe(100);
    expect(memory.respawn?.respawnRequested).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("CRITICAL: All spawns lost"));
  });

  it("detects critical condition when no spawns and no creeps", () => {
    const warn = vi.fn();
    const manager = new RespawnManager({ log: vi.fn(), warn });
    const game = createGameContext({ time: 200, hasSpawns: false, hasCreeps: false });
    const memory = {} as Memory;

    const needsRespawn = manager.checkRespawnNeeded(game, memory);

    expect(needsRespawn).toBe(true);
    expect(memory.respawn?.needsRespawn).toBe(true);
    expect(memory.respawn?.respawnRequested).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("No spawns and no creeps"));
  });

  it("clears respawn state when spawns become available again", () => {
    const log = vi.fn();
    const manager = new RespawnManager({ log, warn: vi.fn() });
    const memory = {
      respawn: {
        needsRespawn: true,
        lastSpawnLostTick: 100,
        respawnRequested: true
      }
    } as Memory;

    const game = createGameContext({ time: 150, hasSpawns: true, hasCreeps: true });
    const needsRespawn = manager.checkRespawnNeeded(game, memory);

    expect(needsRespawn).toBe(false);
    expect(memory.respawn?.needsRespawn).toBe(false);
    expect(memory.respawn?.respawnRequested).toBe(false);
    expect(memory.respawn?.lastSpawnLostTick).toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("clearing respawn state"));
  });

  it("logs periodic reminders while waiting for respawn", () => {
    const warn = vi.fn();
    const manager = new RespawnManager({ log: vi.fn(), warn });
    const memory = {
      respawn: {
        needsRespawn: true,
        lastSpawnLostTick: 100,
        respawnRequested: false
      }
    } as Memory;

    // Tick 200 (100 ticks since loss)
    let game = createGameContext({ time: 200, hasSpawns: false, hasCreeps: true });
    manager.checkRespawnNeeded(game, memory);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Still waiting for respawn (100 ticks"));

    warn.mockClear();

    // Tick 250 (not a multiple of 100 from loss)
    game = createGameContext({ time: 250, hasSpawns: false, hasCreeps: true });
    manager.checkRespawnNeeded(game, memory);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("Still waiting"));
  });

  it("provides accurate status messages", () => {
    const manager = new RespawnManager({ log: vi.fn(), warn: vi.fn() });

    // No respawn needed
    let memory = {} as Memory;
    expect(manager.getStatusMessage(memory, 200)).toContain("no respawn needed");

    // Respawn needed with creeps
    memory = {
      respawn: {
        needsRespawn: true,
        lastSpawnLostTick: 100,
        respawnRequested: false
      }
    } as Memory;
    expect(manager.getStatusMessage(memory, 200)).toContain("Respawn needed");
    expect(manager.getStatusMessage(memory, 200)).toContain("100 ticks ago");

    // Critical state - no creeps
    memory.respawn!.respawnRequested = true;
    expect(manager.getStatusMessage(memory, 200)).toContain("CRITICAL");
    expect(manager.getStatusMessage(memory, 200)).toContain("urgently needed");
  });

  it("only warns once when initially detecting spawn loss", () => {
    const warn = vi.fn();
    const manager = new RespawnManager({ log: vi.fn(), warn });
    const memory = {} as Memory;

    // First detection
    let game = createGameContext({ time: 100, hasSpawns: false, hasCreeps: true });
    manager.checkRespawnNeeded(game, memory);
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockClear();

    // Second tick without change
    game = createGameContext({ time: 101, hasSpawns: false, hasCreeps: true });
    manager.checkRespawnNeeded(game, memory);
    expect(warn).not.toHaveBeenCalled();
  });
});
