import type { SwarmMemory } from "../types.js";
import { rebuildClaimQueue } from "./expansionLogic.js";
import { rebuildClusters } from "./clusterLogic.js";
import { rebuildNukeCandidates } from "./nukes.js";

export function updateOvermind(memory: SwarmMemory, intel: Array<{ room: string; sources: number; distance: number; hostile: boolean }>): void {
  rebuildClaimQueue(memory, intel);
  rebuildClusters(memory);
  rebuildNukeCandidates(memory);
  memory.overmind.roomsSeen = memory.overmind.roomsSeen || {};
}
