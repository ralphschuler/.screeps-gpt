import type { SwarmMemory } from "../types.js";

export function schedulePowerCreeps(memory: SwarmMemory): void {
  memory.overmind.roomsSeen ??= {};
  memory.powerQueue = memory.powerQueue ?? [];
}
