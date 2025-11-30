import { PHEROMONE_DECAY } from "./constants.js";
import type { PheromoneSignals, SwarmRoomMemory } from "./types.js";

export interface PheromoneUpdateOptions {
  constructionSites: number;
  hostiles: number;
  controllerLevel: number;
  downgradeTicks: number;
  energyStored: number;
  remoteHarvestPressure: number;
  hasObserver: boolean;
  incomingNukes: number;
}

export function decaySignals(signals: PheromoneSignals): PheromoneSignals {
  const entries = Object.entries(signals) as Array<[keyof PheromoneSignals, number]>;
  const result: PheromoneSignals = { ...signals };
  for (const [key, value] of entries) {
    result[key] = Math.max(0, value * PHEROMONE_DECAY);
  }
  return result;
}

export function updateSignals(signals: PheromoneSignals, options: PheromoneUpdateOptions): void {
  const {
    constructionSites,
    hostiles,
    controllerLevel,
    downgradeTicks,
    energyStored,
    remoteHarvestPressure,
    hasObserver,
    incomingNukes
  } = options;
  signals.build += constructionSites > 0 ? Math.min(5, constructionSites) : 0;
  signals.harvest += remoteHarvestPressure;
  signals.harvest += energyStored < 20000 ? 1.5 : 0;
  signals.upgrade += downgradeTicks < 3000 ? 2 : controllerLevel < 4 ? 1 : 0.5;

  if (hostiles > 0) {
    signals.war += hostiles * 1.5;
    signals.defense ??= 0;
    signals.defense += hostiles * 2;
  }

  if (incomingNukes > 0) {
    signals.nukeTarget += incomingNukes * 3;
    signals.siege ??= 0;
    signals.siege += incomingNukes * 2;
  }

  if (energyStored > 50000 && hostiles === 0) {
    signals.expand += 2;
  }

  if (controllerLevel >= 6 && hasObserver) {
    signals.expand += 1;
  }

  signals.expand = Math.max(0, signals.expand);
  signals.war = Math.max(0, signals.war);
}

export function diffuseSignals(roomMemory: SwarmRoomMemory, neighbors: SwarmRoomMemory[]): void {
  const diffuseKeys: Array<keyof PheromoneSignals> = ["expand", "war", "harvest"];
  for (const key of diffuseKeys) {
    const share = roomMemory.pheromones[key] * 0.1;
    if (share <= 0) continue;
    for (const neighbor of neighbors) {
      neighbor.pheromones[key] += share;
    }
  }
}
