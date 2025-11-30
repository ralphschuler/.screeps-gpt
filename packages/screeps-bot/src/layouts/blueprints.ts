/**
 * Base Blueprints - Phase 5
 *
 * Pre-computed coordinate arrays for base layouts at different RCL stages.
 */

import type { EvolutionStage } from "../memory/schemas";

/**
 * Structure placement entry
 */
export interface StructurePlacement {
  x: number;
  y: number;
  structureType: BuildableStructureConstant;
}

/**
 * Blueprint for a room layout
 */
export interface Blueprint {
  /** Name of the blueprint */
  name: string;
  /** Required RCL */
  rcl: number;
  /** Anchor position (spawn location) */
  anchor: { x: number; y: number };
  /** Structure placements relative to anchor */
  structures: StructurePlacement[];
  /** Road placements relative to anchor */
  roads: Array<{ x: number; y: number }>;
  /** Rampart positions relative to anchor */
  ramparts: Array<{ x: number; y: number }>;
}

/**
 * RCL 1-2: Early Colony Layout
 * - Central spawn
 * - First extension ring (5 at RCL2)
 * - Container positions near sources
 */
export const EARLY_COLONY_BLUEPRINT: Blueprint = {
  name: "earlyColony",
  rcl: 1,
  anchor: { x: 25, y: 25 },
  structures: [
    // Spawn at center
    { x: 0, y: 0, structureType: "spawn" as BuildableStructureConstant },
    // First extensions (RCL2: 5)
    { x: -1, y: -1, structureType: "extension" as BuildableStructureConstant },
    { x: 1, y: -1, structureType: "extension" as BuildableStructureConstant },
    { x: -1, y: 1, structureType: "extension" as BuildableStructureConstant },
    { x: 1, y: 1, structureType: "extension" as BuildableStructureConstant },
    { x: 0, y: -2, structureType: "extension" as BuildableStructureConstant }
  ],
  roads: [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 }
  ],
  ramparts: []
};

/**
 * RCL 3-4: Core Colony Layout
 * - 10-20 extensions in rings
 * - First tower
 * - Container positions
 */
export const CORE_COLONY_BLUEPRINT: Blueprint = {
  name: "coreColony",
  rcl: 3,
  anchor: { x: 25, y: 25 },
  structures: [
    // Spawn at center
    { x: 0, y: 0, structureType: "spawn" as BuildableStructureConstant },
    // First ring extensions
    { x: -1, y: -1, structureType: "extension" as BuildableStructureConstant },
    { x: 1, y: -1, structureType: "extension" as BuildableStructureConstant },
    { x: -1, y: 1, structureType: "extension" as BuildableStructureConstant },
    { x: 1, y: 1, structureType: "extension" as BuildableStructureConstant },
    { x: 0, y: -2, structureType: "extension" as BuildableStructureConstant },
    // Second ring extensions (RCL3: +5 = 10 total)
    { x: -2, y: 0, structureType: "extension" as BuildableStructureConstant },
    { x: 2, y: 0, structureType: "extension" as BuildableStructureConstant },
    { x: 0, y: 2, structureType: "extension" as BuildableStructureConstant },
    { x: -2, y: -1, structureType: "extension" as BuildableStructureConstant },
    { x: 2, y: -1, structureType: "extension" as BuildableStructureConstant },
    // Third ring (RCL4: +10 = 20 total)
    { x: -2, y: 1, structureType: "extension" as BuildableStructureConstant },
    { x: 2, y: 1, structureType: "extension" as BuildableStructureConstant },
    { x: -2, y: -2, structureType: "extension" as BuildableStructureConstant },
    { x: 2, y: -2, structureType: "extension" as BuildableStructureConstant },
    { x: -2, y: 2, structureType: "extension" as BuildableStructureConstant },
    { x: 2, y: 2, structureType: "extension" as BuildableStructureConstant },
    { x: -1, y: -2, structureType: "extension" as BuildableStructureConstant },
    { x: 1, y: -2, structureType: "extension" as BuildableStructureConstant },
    { x: -1, y: 2, structureType: "extension" as BuildableStructureConstant },
    { x: 1, y: 2, structureType: "extension" as BuildableStructureConstant },
    // Tower (RCL3)
    { x: 0, y: -3, structureType: "tower" as BuildableStructureConstant }
  ],
  roads: [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: -2 },
    { x: 1, y: -2 },
    { x: -2, y: -1 },
    { x: -2, y: 1 },
    { x: 2, y: -1 },
    { x: 2, y: 1 }
  ],
  ramparts: []
};

/**
 * RCL 5-6: Economic Maturity Layout
 * - 30-40 extensions
 * - Storage + Terminal cluster
 * - 2-3 towers
 * - Lab positions reserved
 * - Extractor position (RCL6)
 */
export const ECONOMIC_MATURITY_BLUEPRINT: Blueprint = {
  name: "economicMaturity",
  rcl: 5,
  anchor: { x: 25, y: 25 },
  structures: [
    // Spawns
    { x: 0, y: 0, structureType: "spawn" as BuildableStructureConstant },
    { x: 3, y: 0, structureType: "spawn" as BuildableStructureConstant }, // RCL7
    // Storage (RCL4, but typically placed RCL5+)
    { x: 0, y: 3, structureType: "storage" as BuildableStructureConstant },
    // Terminal (RCL6)
    { x: 1, y: 3, structureType: "terminal" as BuildableStructureConstant },
    // Towers
    { x: 0, y: -3, structureType: "tower" as BuildableStructureConstant },
    { x: -3, y: 0, structureType: "tower" as BuildableStructureConstant },
    { x: 3, y: -3, structureType: "tower" as BuildableStructureConstant }, // RCL5
    // Extensions (30 for RCL5, 40 for RCL6)
    // Ring 1
    { x: -1, y: -1, structureType: "extension" as BuildableStructureConstant },
    { x: 1, y: -1, structureType: "extension" as BuildableStructureConstant },
    { x: -1, y: 1, structureType: "extension" as BuildableStructureConstant },
    { x: 1, y: 1, structureType: "extension" as BuildableStructureConstant },
    { x: 0, y: -2, structureType: "extension" as BuildableStructureConstant },
    // Ring 2
    { x: -2, y: 0, structureType: "extension" as BuildableStructureConstant },
    { x: 2, y: 0, structureType: "extension" as BuildableStructureConstant },
    { x: 0, y: 2, structureType: "extension" as BuildableStructureConstant },
    { x: -2, y: -1, structureType: "extension" as BuildableStructureConstant },
    { x: 2, y: -1, structureType: "extension" as BuildableStructureConstant },
    // Ring 3
    { x: -2, y: 1, structureType: "extension" as BuildableStructureConstant },
    { x: 2, y: 1, structureType: "extension" as BuildableStructureConstant },
    { x: -2, y: -2, structureType: "extension" as BuildableStructureConstant },
    { x: 2, y: -2, structureType: "extension" as BuildableStructureConstant },
    { x: -2, y: 2, structureType: "extension" as BuildableStructureConstant },
    { x: 2, y: 2, structureType: "extension" as BuildableStructureConstant },
    { x: -1, y: -2, structureType: "extension" as BuildableStructureConstant },
    { x: 1, y: -2, structureType: "extension" as BuildableStructureConstant },
    { x: -1, y: 2, structureType: "extension" as BuildableStructureConstant },
    { x: 1, y: 2, structureType: "extension" as BuildableStructureConstant },
    // Ring 4
    { x: -3, y: -1, structureType: "extension" as BuildableStructureConstant },
    { x: -3, y: 1, structureType: "extension" as BuildableStructureConstant },
    { x: 3, y: -1, structureType: "extension" as BuildableStructureConstant },
    { x: 3, y: 1, structureType: "extension" as BuildableStructureConstant },
    { x: -3, y: -2, structureType: "extension" as BuildableStructureConstant },
    { x: 3, y: -2, structureType: "extension" as BuildableStructureConstant },
    { x: -3, y: 2, structureType: "extension" as BuildableStructureConstant },
    { x: 3, y: 2, structureType: "extension" as BuildableStructureConstant },
    { x: -1, y: -3, structureType: "extension" as BuildableStructureConstant },
    { x: 1, y: -3, structureType: "extension" as BuildableStructureConstant },
    // Labs (RCL6) - 3 lab triangle
    { x: -3, y: 3, structureType: "lab" as BuildableStructureConstant },
    { x: -4, y: 3, structureType: "lab" as BuildableStructureConstant },
    { x: -3, y: 4, structureType: "lab" as BuildableStructureConstant },
    // Link positions
    { x: -1, y: 3, structureType: "link" as BuildableStructureConstant } // RCL5: storage link
  ],
  roads: [
    // Central cross
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 2 },
    // Storage access
    { x: -1, y: 3 },
    { x: 1, y: 3 },
    { x: 0, y: 4 }
  ],
  ramparts: [
    { x: 0, y: 0 },
    { x: 0, y: 3 },
    { x: 1, y: 3 }
  ]
};

/**
 * RCL 7-8: War Ready / End Game Layout
 * - 50-60 extensions
 * - 6 towers
 * - 10 labs
 * - Factory, nuker, observer, power spawn positions
 * - Full rampart coverage
 */
export const WAR_READY_BLUEPRINT: Blueprint = {
  name: "warReady",
  rcl: 7,
  anchor: { x: 25, y: 25 },
  structures: [
    // Spawns (3 at RCL8)
    { x: 0, y: 0, structureType: "spawn" as BuildableStructureConstant },
    { x: 3, y: 0, structureType: "spawn" as BuildableStructureConstant },
    { x: -3, y: 0, structureType: "spawn" as BuildableStructureConstant }, // RCL8
    // Storage & Terminal
    { x: 0, y: 3, structureType: "storage" as BuildableStructureConstant },
    { x: 1, y: 3, structureType: "terminal" as BuildableStructureConstant },
    // Towers (6 at RCL8)
    { x: 0, y: -3, structureType: "tower" as BuildableStructureConstant },
    { x: -3, y: -3, structureType: "tower" as BuildableStructureConstant },
    { x: 3, y: -3, structureType: "tower" as BuildableStructureConstant },
    { x: -4, y: 0, structureType: "tower" as BuildableStructureConstant },
    { x: 4, y: 0, structureType: "tower" as BuildableStructureConstant },
    { x: 0, y: 4, structureType: "tower" as BuildableStructureConstant }, // RCL8
    // Factory (RCL7)
    { x: 2, y: 3, structureType: "factory" as BuildableStructureConstant },
    // Labs (10 at RCL7+)
    { x: -3, y: 3, structureType: "lab" as BuildableStructureConstant },
    { x: -4, y: 3, structureType: "lab" as BuildableStructureConstant },
    { x: -3, y: 4, structureType: "lab" as BuildableStructureConstant },
    { x: -4, y: 4, structureType: "lab" as BuildableStructureConstant },
    { x: -5, y: 3, structureType: "lab" as BuildableStructureConstant },
    { x: -5, y: 4, structureType: "lab" as BuildableStructureConstant },
    { x: -3, y: 5, structureType: "lab" as BuildableStructureConstant }, // RCL8
    { x: -4, y: 5, structureType: "lab" as BuildableStructureConstant }, // RCL8
    { x: -5, y: 5, structureType: "lab" as BuildableStructureConstant }, // RCL8
    { x: -2, y: 4, structureType: "lab" as BuildableStructureConstant }, // RCL8
    // Nuker (RCL8)
    { x: 4, y: 3, structureType: "nuker" as BuildableStructureConstant },
    // Observer (RCL8)
    { x: 5, y: 0, structureType: "observer" as BuildableStructureConstant },
    // Power Spawn (RCL8)
    { x: -2, y: 3, structureType: "powerSpawn" as BuildableStructureConstant },
    // Links
    { x: -1, y: 3, structureType: "link" as BuildableStructureConstant },
    { x: 4, y: -3, structureType: "link" as BuildableStructureConstant }, // RCL6
    { x: -4, y: -3, structureType: "link" as BuildableStructureConstant } // RCL7
    // Extensions would continue in outer rings...
  ],
  roads: [
    // Central hub roads
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 2 },
    { x: -1, y: 3 },
    { x: 0, y: 4 },
    // Lab access
    { x: -2, y: 3 },
    { x: -3, y: 2 }
  ],
  ramparts: [
    // Protect critical structures
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: -3, y: 0 },
    { x: 0, y: 3 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: -2, y: 3 },
    { x: 4, y: 3 },
    // Towers
    { x: 0, y: -3 },
    { x: -3, y: -3 },
    { x: 3, y: -3 },
    { x: -4, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 4 }
  ]
};

/**
 * Get blueprint for evolution stage
 */
export function getBlueprintForStage(stage: EvolutionStage): Blueprint {
  switch (stage) {
    case "seedColony":
      return EARLY_COLONY_BLUEPRINT;
    case "earlyExpansion":
      return CORE_COLONY_BLUEPRINT;
    case "economicMaturity":
      return ECONOMIC_MATURITY_BLUEPRINT;
    case "fortification":
    case "endGame":
      return WAR_READY_BLUEPRINT;
    default:
      return EARLY_COLONY_BLUEPRINT;
  }
}

/**
 * Get blueprint for RCL
 */
export function getBlueprintForRCL(rcl: number): Blueprint {
  if (rcl >= 7) return WAR_READY_BLUEPRINT;
  if (rcl >= 5) return ECONOMIC_MATURITY_BLUEPRINT;
  if (rcl >= 3) return CORE_COLONY_BLUEPRINT;
  return EARLY_COLONY_BLUEPRINT;
}

/**
 * Filter structures for a specific RCL
 */
export function getStructuresForRCL(blueprint: Blueprint, rcl: number): StructurePlacement[] {
  const limits = getStructureLimits(rcl);
  const counts: Record<string, number> = {};

  return blueprint.structures.filter(s => {
    const type = s.structureType;
    const limit = limits[type] ?? 0;
    const current = counts[type] ?? 0;

    if (current >= limit) return false;

    counts[type] = current + 1;
    return true;
  });
}

/**
 * Get structure limits per RCL
 */
function getStructureLimits(rcl: number): Record<BuildableStructureConstant, number> {
  // Based on Screeps controller level limits
  const limits: Record<number, Partial<Record<BuildableStructureConstant, number>>> = {
    1: { spawn: 1, extension: 0, road: 2500, constructedWall: 0 },
    2: { spawn: 1, extension: 5, road: 2500, constructedWall: 2500, rampart: 2500, container: 5 },
    3: { spawn: 1, extension: 10, road: 2500, constructedWall: 2500, rampart: 2500, container: 5, tower: 1 },
    4: { spawn: 1, extension: 20, road: 2500, constructedWall: 2500, rampart: 2500, container: 5, tower: 1, storage: 1 },
    5: { spawn: 1, extension: 30, road: 2500, constructedWall: 2500, rampart: 2500, container: 5, tower: 2, storage: 1, link: 2 },
    6: { spawn: 1, extension: 40, road: 2500, constructedWall: 2500, rampart: 2500, container: 5, tower: 2, storage: 1, link: 3, terminal: 1, extractor: 1, lab: 3 },
    7: { spawn: 2, extension: 50, road: 2500, constructedWall: 2500, rampart: 2500, container: 5, tower: 3, storage: 1, link: 4, terminal: 1, extractor: 1, lab: 6, factory: 1 },
    8: { spawn: 3, extension: 60, road: 2500, constructedWall: 2500, rampart: 2500, container: 5, tower: 6, storage: 1, link: 6, terminal: 1, extractor: 1, lab: 10, factory: 1, nuker: 1, observer: 1, powerSpawn: 1 }
  };

  return (limits[rcl] ?? limits[1]) as Record<BuildableStructureConstant, number>;
}
