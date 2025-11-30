import type { PheromoneSignals, SwarmIntent, SwarmRoomMetrics, SwarmRoomMemory } from "../types.js";

export type EvolutionStage = 1 | 2 | 3 | 4 | 5;

export function deriveColonyLevel(controllerLevel: number, roomMetrics?: SwarmRoomMetrics): EvolutionStage {
  if (controllerLevel >= 8) return 5;
  if (controllerLevel >= 6) return 4;
  if (controllerLevel >= 4) return 3;
  if (controllerLevel >= 3 && (roomMetrics?.harvestedEma ?? 0) > 50) return 2;
  return 1;
}

export function derivePosture(room: SwarmRoomMemory): SwarmIntent {
  if (room.danger >= 3 || room.pheromones.siege > 10) return "siege";
  if (room.danger >= 2) return "defense";
  if (room.danger >= 1 && room.pheromones.war > 6) return "war";
  if (room.pheromones.expand >= 5) return "expand";
  if (room.pheromones.nukeTarget > 0) return "nukePrep";
  if (room.pheromones.logistics < 0 && room.pheromones.harvest < 1) return "evacuate";
  return "eco";
}

export function roleWeightsFromPosture(intent: SwarmIntent, pheromones: PheromoneSignals): Record<string, number> {
  const base: Record<string, number> = {
    larvaWorker: 2 + pheromones.harvest + pheromones.build,
    harvester: pheromones.harvest + 1,
    hauler: pheromones.logistics + pheromones.harvest,
    upgrader: pheromones.upgrade + pheromones.harvest * 0.2,
    foragerAnt: pheromones.expand + pheromones.harvest * 0.5,
    builderAnt: pheromones.build + pheromones.upgrade * 0.25,
    queenCarrier: pheromones.logistics + pheromones.harvest,
    mineralHarvester: pheromones.build + pheromones.logistics * 0.5,
    depositHarvester: pheromones.expand * 0.4 + pheromones.logistics,
    terminalManager: pheromones.logistics * 0.6,
    scoutAnt: 1 + pheromones.expand * 0.25,
    claimAnt: pheromones.expand,
    guardAnt: pheromones.war + pheromones.defense * 0.5,
    healerAnt: pheromones.war * 0.6,
    soldierAnt: pheromones.war * 1.1,
    engineer: pheromones.build,
    remoteWorker: pheromones.expand * 0.6,
    siegeUnit: pheromones.siege * 0.8,
    linkManager: pheromones.logistics * 0.5,
    factoryWorker: pheromones.logistics * 0.3,
    labTech: pheromones.logistics * 0.3,
    powerQueen: pheromones.upgrade,
    powerWarrior: pheromones.war,
  };

  if (intent === "war" || intent === "siege") {
    base["guardAnt"] = (base["guardAnt"] ?? 0) * 1.5;
    base["soldierAnt"] = (base["soldierAnt"] ?? 0) * 1.5;
    base["healerAnt"] = (base["healerAnt"] ?? 0) * 1.3;
  }
  if (intent === "expand") {
    base["claimAnt"] = (base["claimAnt"] ?? 0) * 1.2;
    base["remoteWorker"] = (base["remoteWorker"] ?? 0) * 1.4;
  }
  if (intent === "evacuate") {
    base["builderAnt"] = 0;
    base["soldierAnt"] = 0;
  }

  return base;
}
