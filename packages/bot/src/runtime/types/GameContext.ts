export interface CpuStats {
  getUsed(): number;
  limit: number;
  bucket: number;
}

/**
 * GCL (Global Control Level) stats interface
 */
export interface GclStats {
  level: number;
  progress: number;
  progressTotal: number;
}

export interface StoreLike {
  getUsedCapacity(resource?: ResourceConstant): number;
  getFreeCapacity(resource?: ResourceConstant): number;
}

export interface PositionLike {
  findClosestByPath<T>(objects: T[], opts?: FindPathOpts & { filter?: (object: unknown) => boolean }): T | null;
  inRangeTo(target: RoomPosition | { pos: RoomPosition }, range: number): boolean;
  findInRange<T>(type: FindConstant, range: number, opts?: { filter?: (object: unknown) => boolean }): T[];
  getRangeTo(target: RoomPosition | { pos: RoomPosition }): number;
}

export interface RoomLike {
  name: string;
  controller: StructureController | null;
  storage?: StructureStorage | null;
  energyAvailable?: number;
  energyCapacityAvailable?: number;
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
  /** True if the creep is still spawning and cannot perform actions */
  spawning?: boolean;
  harvest(target: Source): ScreepsReturnCode;
  transfer(target: AnyStoreStructure, resource: ResourceConstant): ScreepsReturnCode;
  moveTo(target: RoomPosition | { pos: RoomPosition }, opts?: MoveToOpts): ScreepsReturnCode;
  upgradeController(controller: StructureController): ScreepsReturnCode;
  withdraw(target: Structure, resource: ResourceConstant): ScreepsReturnCode;
  build(target: ConstructionSite): ScreepsReturnCode;
  repair(target: Structure): ScreepsReturnCode;
  pickup(target: Resource): ScreepsReturnCode;
  drop(resourceType: ResourceConstant, amount?: number): ScreepsReturnCode;
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
  gcl?: GclStats;
}
