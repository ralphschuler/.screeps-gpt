import { POWER_LOOP_INTERVAL } from "./constants.js";

export function shouldRunPowerLoop(currentTick: number, lastRun: number | undefined): boolean {
  return !lastRun || lastRun <= currentTick;
}

export function scheduleNextPowerLoop(currentTick: number): number {
  return currentTick + POWER_LOOP_INTERVAL;
}

export function runPowerCreepEconomy(powerCreep: PowerCreep): void {
  if (!powerCreep.room) return;
  const storage = powerCreep.room.storage;
  if (storage && powerCreep.powers[PWR_OPERATE_STORAGE] && powerCreep.store[RESOURCE_ENERGY] >= 100) {
    powerCreep.usePower(PWR_OPERATE_STORAGE, storage);
  }
  const spawn = powerCreep.room.find(FIND_MY_SPAWNS)[0];
  if (spawn && powerCreep.powers[PWR_OPERATE_SPAWN]) {
    powerCreep.usePower(PWR_OPERATE_SPAWN, spawn);
  }
}

export function runPowerCreepCombat(powerCreep: PowerCreep): void {
  if (!powerCreep.room) return;
  const hostiles = powerCreep.room.find(FIND_HOSTILE_CREEPS);
  if (hostiles.length === 0) return;
  if (powerCreep.powers[PWR_OPERATE_TOWER]) {
    const tower = powerCreep.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } })[0] as StructureTower | undefined;
    if (tower) {
      powerCreep.usePower(PWR_OPERATE_TOWER, tower);
    }
  }
}
