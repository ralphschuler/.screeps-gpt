import type { SwarmMemory, SwarmMemoryRoot } from "../types.js";

function ensureMetrics(memory: SwarmMemoryRoot): SwarmMemory {
  if (!memory.swarm) {
    throw new Error("Swarm memory not initialized");
  }
  memory.swarm.metrics ??= { roomCpu: {}, globalCpu: 0 };
  return memory.swarm;
}

export function profileGlobal<T>(memory: SwarmMemoryRoot, fn: () => T): T {
  const start = Game.cpu.getUsed();
  const result = fn();
  const end = Game.cpu.getUsed();
  ensureMetrics(memory).metrics!.globalCpu = Math.max(0, end - start);
  return result;
}

export function profileRoom<T>(memory: SwarmMemoryRoot, roomName: string, fn: () => T): T {
  const start = Game.cpu.getUsed();
  const result = fn();
  const end = Game.cpu.getUsed();
  const swarm = ensureMetrics(memory);
  swarm.metrics!.roomCpu ??= {};
  swarm.metrics!.roomCpu[roomName] = Math.max(0, end - start);
  return result;
}
