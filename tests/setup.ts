import { webcrypto } from "node:crypto";

const globals = globalThis as Record<string, unknown>;

// Polyfill crypto.getRandomValues for Node 16 compatibility
// Node 16 doesn't have Web Crypto API, but it's required by Vite/Vitest
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    writable: true,
    configurable: true
  });
}

globals.OK = 0;
globals.ERR_NOT_IN_RANGE = -9;
globals.FIND_SOURCES_ACTIVE = 1;
globals.FIND_STRUCTURES = 2;
globals.STRUCTURE_SPAWN = "spawn";
globals.STRUCTURE_EXTENSION = "extension";
globals.RESOURCE_ENERGY = "energy";
globals.WORK = "work";
globals.CARRY = "carry";
globals.MOVE = "move";
