import { NUKE_SCORE_THRESHOLD } from "./constants.js";

export interface NukeScoreInput {
  enemyRcl: number;
  hostileStructures: number;
  warPheromone: number;
  distance: number;
}

export function calculateNukeScore({ enemyRcl, hostileStructures, warPheromone, distance }: NukeScoreInput): number {
  return enemyRcl * 2 + hostileStructures * 3 + warPheromone * 1.5 - distance;
}

export function isNukeCandidate(score: number): boolean {
  return score >= NUKE_SCORE_THRESHOLD;
}
