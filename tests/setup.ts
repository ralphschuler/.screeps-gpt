const globals = globalThis as Record<string, unknown>;

globals.OK = 0;
globals.ERR_NOT_IN_RANGE = -9;
globals.ERR_NOT_ENOUGH_ENERGY = -6;
globals.FIND_SOURCES_ACTIVE = 1;
globals.FIND_STRUCTURES = 2;
globals.STRUCTURE_SPAWN = "spawn";
globals.STRUCTURE_EXTENSION = "extension";
globals.RESOURCE_ENERGY = "energy";
globals.WORK = "work";
globals.CARRY = "carry";
globals.MOVE = "move";
