import { calculateNukeScore, isNukeCandidate } from "../nukeScoringEngine.js";
import type { SwarmMemory, SwarmRoomMemory } from "../types.js";

export function detectNukes(roomMemory: SwarmRoomMemory, room: Room): void {
  const nukes = room.find(FIND_NUKES).length;
  if (nukes > 0) {
    roomMemory.pheromones.siege += nukes * 2;
    roomMemory.pheromones.nukeTarget += nukes * 3;
    roomMemory.danger = Math.max(roomMemory.danger, 3);
  }
}

export function rebuildNukeCandidates(memory: SwarmMemory): void {
  const candidates = Object.entries(memory.rooms)
    .map(([roomName, data]) => ({
      room: roomName,
      score: calculateNukeScore({
        enemyRcl: data.colonyLevel,
        hostileStructures: data.pheromones.nukeTarget,
        warPheromone: data.pheromones.war,
        distance: 1,
      }),
    }))
    .filter(entry => isNukeCandidate(entry.score));

  memory.overmind.nukeCandidates = candidates.sort((a, b) => b.score - a.score).map(c => c.room);
}
