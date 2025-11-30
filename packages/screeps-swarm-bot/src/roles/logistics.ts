export function pickEnergyTarget(room: Room): StructureSpawn | StructureExtension | StructureTower | StructureStorage | null {
  const priority = room.find(FIND_MY_STRUCTURES, {
    filter: struct =>
      (struct.structureType === STRUCTURE_SPAWN || struct.structureType === STRUCTURE_EXTENSION) &&
      (struct as StructureSpawn | StructureExtension).store.getFreeCapacity(RESOURCE_ENERGY) > 0
  }) as Array<StructureSpawn | StructureExtension>;
  if (priority.length > 0) {
    return priority[0] ?? null;
  }

  const towers = room.find(FIND_MY_STRUCTURES, {
    filter: struct => struct.structureType === STRUCTURE_TOWER &&
      (struct as StructureTower).store.getFreeCapacity(RESOURCE_ENERGY) > 100
  }) as StructureTower[];
  if (towers.length > 0) return towers[0] ?? null;

  return room.storage ?? null;
}

export function transferEnergy(creep: Creep, target: Structure): ScreepsReturnCode {
  if (target.structureType === STRUCTURE_STORAGE || target.structureType === STRUCTURE_CONTAINER) {
    return creep.transfer(target as StructureStorage | StructureContainer, RESOURCE_ENERGY);
  }
  return creep.transfer(target as StructureSpawn | StructureExtension | StructureTower, RESOURCE_ENERGY);
}

export function withdrawEnergy(creep: Creep, target: Structure): ScreepsReturnCode {
  if (target.structureType === STRUCTURE_STORAGE || target.structureType === STRUCTURE_CONTAINER) {
    return creep.withdraw(target as StructureStorage | StructureContainer, RESOURCE_ENERGY);
  }
  if (target.structureType === STRUCTURE_LINK) {
    return creep.withdraw(target as StructureLink, RESOURCE_ENERGY);
  }
  return ERR_INVALID_TARGET;
}
