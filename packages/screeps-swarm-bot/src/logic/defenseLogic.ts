import type { SwarmRoomMemory } from "../types.js";

export function calculateThreat(room: Room): number {
  const hostiles = room.find(FIND_HOSTILE_CREEPS);
  const hostileDamage = hostiles.reduce((sum, creep) => sum + creep.getActiveBodyparts(ATTACK) * 30, 0);
  if (room.find(FIND_NUKES).length > 0) return 3;
  if (hostileDamage > 400 || hostiles.length > 4) return 3;
  if (hostileDamage > 200 || hostiles.length > 2) return 2;
  if (hostiles.length > 0) return 1;
  return 0;
}

export function updateDanger(roomMemory: SwarmRoomMemory, room: Room): void {
  const danger = calculateThreat(room);
  roomMemory.danger = danger;
  if (danger >= 2) {
    roomMemory.pheromones.war += danger;
    roomMemory.pheromones.defense += danger * 2;
  }
}
