export interface CpuStats {
  getUsed(): number;
  limit: number;
  bucket: number;
}

export interface StoreLike {
  getUsedCapacity(resource?: ResourceConstant): number;
  getFreeCapacity(resource?: ResourceConstant): number;
}

export interface PositionLike {
  findClosestByPath<T>(objects: T[], opts?: FindPathOpts & { filter?: (object: unknown) => boolean }): T | null;
}

export interface RoomLike {
  name: string;
  controller: StructureController | null;
  find(type: FindConstant, opts?: { filter?: (object: unknown) => boolean }): unknown[];
  findPath(from: RoomPosition, to: RoomPosition, opts?: FindPathOpts): PathStep[];
  createConstructionSite(x: number, y: number, structureType: BuildableStructureConstant): ScreepsReturnCode;
  getTerrain(): RoomTerrain;
}

export interface CreepLike {
  name: string;
  memory: CreepMemory;
  store: StoreLike;
  pos: PositionLike;
  room: RoomLike;
  harvest(target: Source): ScreepsReturnCode;
  transfer(target: AnyStoreStructure, resource: ResourceConstant): ScreepsReturnCode;
  moveTo(target: RoomPosition | { pos: RoomPosition }, opts?: MoveToOpts): ScreepsReturnCode;
  upgradeController(controller: StructureController): ScreepsReturnCode;
  withdraw(target: Structure, resource: ResourceConstant): ScreepsReturnCode;
  build(target: ConstructionSite): ScreepsReturnCode;
  repair(target: Structure): ScreepsReturnCode;
}

export interface SpawnLike {
  name: string;
  spawning: Spawning | null;
  spawnCreep(body: BodyPartConstant[], name: string, opts?: SpawnOptions): ScreepsReturnCode;
  store: StoreLike;
  room: RoomLike;
}

export interface GameContext {
  time: number;
  creeps: Record<string, CreepLike>;
  spawns: Record<string, SpawnLike>;
  rooms: Record<string, RoomLike>;
  cpu: CpuStats;
}
