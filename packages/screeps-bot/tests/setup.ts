/**
 * Test setup - defines Screeps global constants
 */

import { beforeEach } from "vitest";

beforeEach(() => {
  // Body part constants
  (globalThis as typeof globalThis & Record<string, unknown>).WORK = "work" as BodyPartConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).CARRY = "carry" as BodyPartConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).MOVE = "move" as BodyPartConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).ATTACK = "attack" as BodyPartConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).RANGED_ATTACK = "ranged_attack" as BodyPartConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).HEAL = "heal" as BodyPartConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).CLAIM = "claim" as BodyPartConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).TOUGH = "tough" as BodyPartConstant;

  // Structure constants
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_SPAWN = "spawn" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_EXTENSION = "extension" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_TOWER = "tower" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_STORAGE = "storage" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_CONTAINER = "container" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_ROAD = "road" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_CONTROLLER = "controller" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_WALL = "constructedWall" as StructureConstant;

  // Resource constants
  (globalThis as typeof globalThis & Record<string, unknown>).RESOURCE_ENERGY = "energy" as ResourceConstant;

  // Find constants
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_SOURCES = 105 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_SOURCES_ACTIVE = 104 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_MY_CREEPS = 102 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_MY_SPAWNS = 112 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_MY_STRUCTURES = 108 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_MY_CONSTRUCTION_SITES = 111 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_HOSTILE_CREEPS = 103 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_HOSTILE_STRUCTURES = 109 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_STRUCTURES = 107 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_DROPPED_RESOURCES = 106 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_MINERALS = 114 as FindConstant;

  // OK/Error codes
  (globalThis as typeof globalThis & Record<string, unknown>).OK = 0 as ScreepsReturnCode;
  (globalThis as typeof globalThis & Record<string, unknown>).ERR_NOT_IN_RANGE = -9 as ScreepsReturnCode;
  (globalThis as typeof globalThis & Record<string, unknown>).ERR_NO_PATH = -2 as ScreepsReturnCode;
  (globalThis as typeof globalThis & Record<string, unknown>).ERR_INVALID_ARGS = -10 as ScreepsReturnCode;

  // Misc constants
  (globalThis as typeof globalThis & Record<string, unknown>).MAX_CREEP_SIZE = 50;
});
