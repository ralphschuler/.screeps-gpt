/**
 * Event payload for creep spawned events
 */
export interface CreepSpawnedEvent {
  creepName: string;
  role: string;
  spawnName: string;
}

/**
 * Event payload for creep died events
 */
export interface CreepDiedEvent {
  creepName: string;
  role: string;
  roomName: string;
}

/**
 * Event payload for energy depletion events
 */
export interface EnergyDepletedEvent {
  roomName: string;
  structureType: string;
  structureId: string;
}

/**
 * Event payload for energy restoration events
 */
export interface EnergyRestoredEvent {
  roomName: string;
  structureType: string;
  structureId: string;
  energyAmount: number;
}

/**
 * Event payload for hostile detection events
 */
export interface HostileDetectedEvent {
  roomName: string;
  hostileCount: number;
  hostileUsernames: string[];
}

/**
 * Event payload for controller upgrade events
 */
export interface ControllerUpgradeEvent {
  roomName: string;
  oldLevel: number;
  newLevel: number;
}

/**
 * Event payload for construction started events
 */
export interface ConstructionStartedEvent {
  roomName: string;
  structureType: string;
  siteId: string;
}

/**
 * Event payload for construction completed events
 */
export interface ConstructionCompletedEvent {
  roomName: string;
  structureType: string;
  structureId: string;
}

/**
 * Registry of all event types for type safety
 */
export const EventTypes = {
  CREEP_SPAWNED: "creep:spawned",
  CREEP_DIED: "creep:died",
  ENERGY_DEPLETED: "energy:depleted",
  ENERGY_RESTORED: "energy:restored",
  HOSTILE_DETECTED: "hostile:detected",
  CONTROLLER_UPGRADE: "controller:upgrade",
  CONSTRUCTION_STARTED: "construction:started",
  CONSTRUCTION_COMPLETED: "construction:completed"
} as const;

/**
 * Type union of all event type strings
 */
export type EventTypeString = (typeof EventTypes)[keyof typeof EventTypes];
