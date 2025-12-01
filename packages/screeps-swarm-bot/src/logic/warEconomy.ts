import type { SwarmRoomMemory } from "../types.js";

export function economyStable(room: Room): boolean {
  const storage = room.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0;
  const roomMem = room.memory as { energyIncome?: number; energySpend?: number };
  const income = roomMem.energyIncome ?? 0;
  const spend = roomMem.energySpend ?? 1;
  return storage > 20000 && income > spend * 1.2;
}

export function escalateWar(roomMemory: SwarmRoomMemory, room: Room): void {
  if (!economyStable(room)) return;
  if (roomMemory.danger >= 2) {
    roomMemory.pheromones.war += 2;
  }
}
