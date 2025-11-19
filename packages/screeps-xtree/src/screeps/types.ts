/**
 * Screeps-specific decision context for creep behaviors.
 * Provides all necessary information for making creep action decisions.
 */
export interface CreepDecisionContext {
  /** The creep making the decision */
  creep: Creep;

  /** The room the creep is in */
  room: Room;

  /** Whether energy sources are available */
  energyAvailable: boolean;

  /** Whether hostile creeps are nearby */
  nearbyEnemies: boolean;

  /** Number of construction sites in the room */
  constructionSites: number;

  /** Number of damaged structures in the room */
  damagedStructures: number;
}

/**
 * Actions a creep can take based on decision tree evaluation.
 */
export type CreepAction =
  | { type: "harvest"; target: Source }
  | { type: "upgrade"; target: StructureController }
  | { type: "build"; target: ConstructionSite }
  | { type: "repair"; target: Structure }
  | { type: "flee"; direction: DirectionConstant }
  | { type: "idle" };

/**
 * Room decision context for strategic planning.
 */
export interface RoomDecisionContext {
  /** The room making decisions */
  room: Room;

  /** Current room control level */
  rcl: number;

  /** Available energy for spawning */
  energyAvailable: number;

  /** Maximum energy capacity */
  energyCapacityAvailable: number;

  /** Number of hostile creeps in room */
  hostileCount: number;

  /** Number of owned creeps in room */
  ownedCreeps: number;
}

/**
 * Strategic actions for room management.
 */
export type RoomAction =
  | { type: "spawn"; role: string }
  | { type: "defend"; priority: "low" | "medium" | "high" }
  | { type: "expand"; targetRoom: string }
  | { type: "fortify" }
  | { type: "economy" };
