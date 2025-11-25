import { webcrypto, randomBytes } from "node:crypto";

const globals = globalThis as Record<string, unknown>;

// Polyfill crypto.getRandomValues for Node 16 compatibility
// Node 16 doesn't have Web Crypto API, but it's required by Vite/Vitest
if (!globalThis.crypto) {
  const cryptoPolyfill = {
    ...webcrypto,
    getRandomValues: (array: Uint8Array | Uint16Array | Uint32Array) => {
      const bytes = randomBytes(array.byteLength);
      array.set(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
      return array;
    }
  };

  Object.defineProperty(globalThis, "crypto", {
    value: cryptoPolyfill,
    writable: true,
    configurable: true
  });
}

globals.OK = 0;
globals.ERR_NOT_ENOUGH_ENERGY = -6;
globals.ERR_INVALID_TARGET = -7;
globals.ERR_FULL = -8;
globals.ERR_NOT_IN_RANGE = -9;
globals.ERR_NO_PATH = -2;
globals.ERR_RCL_NOT_ENOUGH = -14;
globals.ERR_NOT_ENOUGH_RESOURCES = -6;
globals.TERRAIN_MASK_WALL = 1;
globals.TERRAIN_MASK_SWAMP = 2;
globals.FIND_SOURCES = 105;
globals.FIND_SOURCES_ACTIVE = 1;
globals.FIND_MINERALS = 106;
globals.FIND_STRUCTURES = 107;
globals.FIND_CONSTRUCTION_SITES = 3;
globals.FIND_MY_SPAWNS = 104;
globals.FIND_MY_CONSTRUCTION_SITES = 114;
globals.FIND_MY_STRUCTURES = 112;
globals.FIND_MY_CREEPS = 113;
globals.FIND_HOSTILE_CREEPS = 6;
globals.FIND_DROPPED_RESOURCES = 4;
globals.STRUCTURE_SPAWN = "spawn";
globals.STRUCTURE_EXTENSION = "extension";
globals.STRUCTURE_CONTAINER = "container";
globals.STRUCTURE_STORAGE = "storage";
globals.STRUCTURE_ROAD = "road";
globals.STRUCTURE_RAMPART = "rampart";
globals.STRUCTURE_WALL = "constructedWall";
globals.STRUCTURE_KEEPER_LAIR = "keeperLair";
globals.STRUCTURE_TOWER = "tower";
globals.STRUCTURE_LINK = "link";
globals.RESOURCE_ENERGY = "energy";
globals.RESOURCE_HYDROGEN = "H";
globals.RESOURCE_OXYGEN = "O";
globals.WORK = "work";
globals.CARRY = "carry";
globals.MOVE = "move";
globals.ATTACK = "attack";
globals.RANGED_ATTACK = "ranged_attack";
globals.HEAL = "heal";
globals.CLAIM = "claim";
globals.TOUGH = "tough";

// Body part costs (from Screeps constants)
globals.BODYPART_COST = {
  move: 50,
  work: 100,
  carry: 50,
  attack: 80,
  ranged_attack: 150,
  heal: 250,
  claim: 600,
  tough: 10
};

// Mock Game object for Screeps and pathfinding libraries
globals.Game = {
  time: 0,
  cpu: {
    limit: 500,
    tickLimit: 500,
    bucket: 10000,
    getUsed: () => 0
  }
};

// Mock Memory object for Screeps and pathfinding libraries
globals.Memory = {};

// Mock PathFinder for pathfinding libraries
globals.PathFinder = {
  search: () => ({
    path: [],
    ops: 0,
    cost: 0,
    incomplete: false
  }),
  CostMatrix: class CostMatrix {
    private _bits: Uint8Array = new Uint8Array(2500);

    public get(x: number, y: number): number {
      return this._bits[x * 50 + y];
    }

    public set(x: number, y: number, value: number): void {
      this._bits[x * 50 + y] = value;
    }

    public setFast(x: number, y: number, value: number): void {
      this._bits[x * 50 + y] = value;
    }

    public clone(): CostMatrix {
      const copy = new CostMatrix();
      copy._bits = new Uint8Array(this._bits);
      return copy;
    }
  }
};

// Mock RoomPosition class for test compatibility
globals.RoomPosition = class RoomPosition {
  public x: number;
  public y: number;
  public roomName: string;

  public constructor(x: number, y: number, roomName: string) {
    this.x = x;
    this.y = y;
    this.roomName = roomName;
  }

  public getRangeTo(target: RoomPosition | { pos: RoomPosition }): number {
    const targetPos = target instanceof RoomPosition ? target : target.pos;
    const dx = Math.abs(this.x - targetPos.x);
    const dy = Math.abs(this.y - targetPos.y);
    return Math.max(dx, dy);
  }
} as unknown as typeof RoomPosition;
