import type { SwarmMemory } from "../types.js";

export function rebuildClusters(memory: SwarmMemory): void {
  const clusters: Record<string, string[]> = {};
  for (const room of Object.keys(memory.rooms)) {
    const id = room.slice(0, 2); // coarse grouping by prefix
    clusters[id] ??= [];
    clusters[id].push(room);
  }

  memory.clusters = Object.entries(clusters).reduce(
    (acc, [id, rooms]) => {
      acc[id] = {
        id,
        rooms,
        role: "economic",
        metrics: { energyIncome: rooms.length * 10, surplus: 0, warIndex: 0 },
        tradePrefs: {
          targets: {
            [RESOURCE_ENERGY]: { min: 20000, max: 60000 },
            [RESOURCE_HYDROGEN]: { min: 1000, max: 5000 },
            [RESOURCE_OXYGEN]: { min: 1000, max: 5000 }
          },
          exportSurplus: { [RESOURCE_ENERGY]: true },
          importDemand: { [RESOURCE_ENERGY]: true },
          minAmounts: {
            [RESOURCE_ENERGY]: 1000,
            [RESOURCE_HYDROGEN]: 500,
            [RESOURCE_OXYGEN]: 500
          }
        }
      };
      return acc;
    },
    {} as SwarmMemory["clusters"]
  );
}
