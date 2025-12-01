import type { SwarmMemory, SwarmRoomMemory } from "../types.js";

export interface RoomIntel {
  room: string;
  sources: number;
  distance: number;
  hostile: boolean;
  mineral?: MineralConstant;
  deposits?: number;
}

export function scoreRoom(intel: RoomIntel): number {
  const base = intel.sources * 10 - intel.distance;
  const safety = intel.hostile ? -50 : 0;
  const mineralBonus = intel.mineral ? 5 : 0;
  const depositBonus = (intel.deposits ?? 0) * 3;
  return base + safety + mineralBonus + depositBonus;
}

export function rebuildClaimQueue(memory: SwarmMemory, intel: RoomIntel[]): void {
  const scored = intel.map(info => ({ room: info.room, score: scoreRoom(info) }));
  memory.overmind.claimQueue = scored.sort((a, b) => b.score - a.score).map(s => s.room);
}

export function assignRemotes(home: SwarmRoomMemory, candidateRooms: string[]): void {
  home.remoteAssignments ??= [];
  for (const room of candidateRooms) {
    if (!home.remoteAssignments.includes(room)) {
      home.remoteAssignments.push(room);
    }
  }
}
