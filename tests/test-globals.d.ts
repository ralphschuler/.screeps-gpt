// Type declarations for test environment global constants
// These are set up at runtime by tests/setup.ts

declare global {
  // Screeps constants
  const OK: 0;
  const ERR_NOT_OWNER: -1;
  const ERR_NO_PATH: -2;
  const ERR_BUSY: -4;
  const ERR_NOT_ENOUGH_ENERGY: -6;
  const ERR_INVALID_TARGET: -7;
  const ERR_FULL: -8;
  const ERR_NOT_IN_RANGE: -9;
  const ERR_RCL_NOT_ENOUGH: -14;

  // Terrain constants
  const TERRAIN_MASK_WALL: 1;

  // Find constants
  const FIND_SOURCES: 105;
  const FIND_SOURCES_ACTIVE: 1;
  const FIND_MINERALS: 106;
  const FIND_STRUCTURES: 107;
  const FIND_CONSTRUCTION_SITES: 3;
  const FIND_MY_SPAWNS: 104;
  const FIND_MY_CONSTRUCTION_SITES: 114;
  const FIND_MY_STRUCTURES: 112;
  const FIND_MY_CREEPS: 113;
  const FIND_HOSTILE_CREEPS: 6;
  const FIND_DROPPED_RESOURCES: 4;

  // Structure constants
  const STRUCTURE_SPAWN: "spawn";
  const STRUCTURE_EXTENSION: "extension";
  const STRUCTURE_CONTAINER: "container";
  const STRUCTURE_STORAGE: "storage";
  const STRUCTURE_ROAD: "road";
  const STRUCTURE_RAMPART: "rampart";
  const STRUCTURE_WALL: "constructedWall";
  const STRUCTURE_KEEPER_LAIR: "keeperLair";
  const STRUCTURE_TOWER: "tower";
  const STRUCTURE_LINK: "link";
  const STRUCTURE_CONTROLLER: "controller";

  // Resource constants
  const RESOURCE_ENERGY: "energy";
  const RESOURCE_HYDROGEN: "H";
  const RESOURCE_OXYGEN: "O";

  // Body part constants
  const WORK: "work";
  const CARRY: "carry";
  const MOVE: "move";
  const ATTACK: "attack";
  const RANGED_ATTACK: "ranged_attack";
  const HEAL: "heal";
  const CLAIM: "claim";
  const TOUGH: "tough";

  // Body part costs
  const BODYPART_COST: {
    move: 50;
    work: 100;
    carry: 50;
    attack: 80;
    ranged_attack: 150;
    heal: 250;
    claim: 600;
    tough: 10;
  };
}

export {};
