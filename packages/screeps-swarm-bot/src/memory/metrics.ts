import type { SwarmRoomMetrics } from "../types.js";

const ALPHA = 0.25;

function ema(previous: number | undefined, sample: number): number {
  return previous === undefined ? sample : previous * (1 - ALPHA) + sample * ALPHA;
}

export function updateRoomMetrics(
  metrics: SwarmRoomMetrics | undefined,
  sample: Partial<SwarmRoomMetrics>
): SwarmRoomMetrics {
  const next: SwarmRoomMetrics = metrics ? { ...metrics } : {};
  if (sample.harvestedEma !== undefined) next.harvestedEma = ema(metrics?.harvestedEma, sample.harvestedEma);
  if (sample.spendEma !== undefined) next.spendEma = ema(metrics?.spendEma, sample.spendEma);
  if (sample.spawnEnergyEma !== undefined) next.spawnEnergyEma = ema(metrics?.spawnEnergyEma, sample.spawnEnergyEma);
  if (sample.constructionEma !== undefined)
    next.constructionEma = ema(metrics?.constructionEma, sample.constructionEma);
  if (sample.repairEma !== undefined) next.repairEma = ema(metrics?.repairEma, sample.repairEma);
  if (sample.towerEma !== undefined) next.towerEma = ema(metrics?.towerEma, sample.towerEma);
  if (sample.controllerProgressEma !== undefined)
    next.controllerProgressEma = ema(metrics?.controllerProgressEma, sample.controllerProgressEma);
  if (sample.idleLarvaTicks !== undefined) next.idleLarvaTicks = ema(metrics?.idleLarvaTicks, sample.idleLarvaTicks);
  if (sample.hostilesEma !== undefined) next.hostilesEma = ema(metrics?.hostilesEma, sample.hostilesEma);
  return next;
}
