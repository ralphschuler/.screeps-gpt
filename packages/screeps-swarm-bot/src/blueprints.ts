export type BlueprintStage = "early" | "core" | "war";

export interface BlueprintStructure {
  type: StructureConstant;
  x: number;
  y: number;
}

export interface BlueprintDefinition {
  id: BlueprintStage;
  rclMin: number;
  rclMax: number;
  structures: BlueprintStructure[];
}

export const BLUEPRINTS: BlueprintDefinition[] = [
  {
    id: "early",
    rclMin: 1,
    rclMax: 2,
    structures: [
      { type: STRUCTURE_SPAWN, x: 25, y: 25 },
      { type: STRUCTURE_EXTENSION, x: 24, y: 25 },
      { type: STRUCTURE_EXTENSION, x: 26, y: 25 },
      { type: STRUCTURE_EXTENSION, x: 25, y: 24 },
      { type: STRUCTURE_EXTENSION, x: 25, y: 26 },
      { type: STRUCTURE_CONTAINER, x: 23, y: 25 }
    ]
  },
  {
    id: "core",
    rclMin: 3,
    rclMax: 4,
    structures: [
      { type: STRUCTURE_SPAWN, x: 25, y: 25 },
      { type: STRUCTURE_STORAGE, x: 24, y: 24 },
      { type: STRUCTURE_TERMINAL, x: 26, y: 24 },
      { type: STRUCTURE_EXTENSION, x: 23, y: 24 },
      { type: STRUCTURE_EXTENSION, x: 27, y: 24 },
      { type: STRUCTURE_EXTENSION, x: 23, y: 25 },
      { type: STRUCTURE_EXTENSION, x: 27, y: 25 },
      { type: STRUCTURE_EXTENSION, x: 23, y: 26 },
      { type: STRUCTURE_EXTENSION, x: 27, y: 26 },
      { type: STRUCTURE_TOWER, x: 24, y: 26 },
      { type: STRUCTURE_TOWER, x: 26, y: 26 },
      { type: STRUCTURE_TOWER, x: 25, y: 23 },
      { type: STRUCTURE_ROAD, x: 25, y: 24 },
      { type: STRUCTURE_ROAD, x: 25, y: 26 },
      { type: STRUCTURE_ROAD, x: 24, y: 25 },
      { type: STRUCTURE_ROAD, x: 26, y: 25 },
      { type: STRUCTURE_ROAD, x: 25, y: 25 }
    ]
  },
  {
    id: "war",
    rclMin: 5,
    rclMax: 8,
    structures: [
      { type: STRUCTURE_SPAWN, x: 25, y: 25 },
      { type: STRUCTURE_STORAGE, x: 24, y: 24 },
      { type: STRUCTURE_TERMINAL, x: 26, y: 24 },
      { type: STRUCTURE_POWER_SPAWN, x: 24, y: 23 },
      { type: STRUCTURE_NUKER, x: 26, y: 23 },
      { type: STRUCTURE_OBSERVER, x: 24, y: 26 },
      { type: STRUCTURE_LAB, x: 26, y: 26 },
      { type: STRUCTURE_LAB, x: 27, y: 26 },
      { type: STRUCTURE_LAB, x: 26, y: 27 },
      { type: STRUCTURE_EXTENSION, x: 22, y: 24 },
      { type: STRUCTURE_EXTENSION, x: 22, y: 25 },
      { type: STRUCTURE_EXTENSION, x: 22, y: 26 },
      { type: STRUCTURE_EXTENSION, x: 28, y: 24 },
      { type: STRUCTURE_EXTENSION, x: 28, y: 25 },
      { type: STRUCTURE_EXTENSION, x: 28, y: 26 },
      { type: STRUCTURE_TOWER, x: 24, y: 27 },
      { type: STRUCTURE_TOWER, x: 26, y: 27 },
      { type: STRUCTURE_TOWER, x: 25, y: 22 },
      { type: STRUCTURE_TOWER, x: 25, y: 28 },
      { type: STRUCTURE_RAMPART, x: 25, y: 25 },
      { type: STRUCTURE_RAMPART, x: 24, y: 24 },
      { type: STRUCTURE_RAMPART, x: 26, y: 24 }
    ]
  }
];

export function selectBlueprint(controllerLevel: number): BlueprintDefinition {
  const blueprint = BLUEPRINTS.find(bp => controllerLevel >= bp.rclMin && controllerLevel <= bp.rclMax);
  return blueprint ?? BLUEPRINTS[0]!;
}
