import type { ProcessContext } from "@ralphschuler/screeps-kernel";

/**
 * Intent posture for a room-level swarm node.
 */
export type SwarmIntent =
  | "eco"
  | "expand"
  | "defense"
  | "war"
  | "nukePrep"
  | "siege"
  | "evacuate";

/** Supported swarm creep archetypes. */
export type SwarmRole =
  | "larvaWorker"
  | "harvester"
  | "hauler"
  | "upgrader"
  | "foragerAnt"
  | "builderAnt"
  | "queenCarrier"
  | "mineralHarvester"
  | "depositHarvester"
  | "terminalManager"
  | "scoutAnt"
  | "claimAnt"
  | "guardAnt"
  | "healerAnt"
  | "soldierAnt"
  | "engineer"
  | "remoteWorker"
  | "siegeUnit"
  | "linkManager"
  | "factoryWorker"
  | "labTech"
  | "powerQueen"
  | "powerWarrior";

/**
 * Numeric pheromone weights driving emergent behaviors.
 */
export interface PheromoneSignals {
  expand: number;
  harvest: number;
  build: number;
  upgrade: number;
  defense: number;
  war: number;
  siege: number;
  logistics: number;
  nukeTarget: number;
}

/**
 * Ring-buffer entry for recent notable events.
 */
export type SwarmEvent = [type: string, time: number];

/**
 * Compact per-room swarm memory following the pheromone schema.
 */
export interface SwarmRoomMemory {
  colonyLevel: number;
  intent: SwarmIntent;
  danger: number;
  pheromones: PheromoneSignals;
  ttl: number;
  lastUpdated: number;
  spawnProfile: {
    weights: Record<SwarmRole, number>;
    recommended?: SwarmRole | null;
    _ttl?: number;
  };
  eventLog: SwarmEvent[];
  blueprintId?: string;
  rallyTarget?: string;
  logisticsNeed?: number;
  roomRole?: "capital" | "core" | "remoteHub" | "forwardBase" | "skOutpost";
  missingStructures?: {
    spawn?: boolean;
    storage?: boolean;
    terminal?: boolean;
    labs?: boolean;
    nuker?: boolean;
    factory?: boolean;
    extractor?: boolean;
    powerSpawn?: boolean;
    observer?: boolean;
  };
  remoteAssignments?: string[];
  metrics?: SwarmRoomMetrics;
}

/**
 * Global overmind memory responsible for slow-changing strategic queues.
 */
export interface SwarmOvermindMemory {
  roomsSeen: Record<string, number>;
  claimQueue: string[];
  warTargets: string[];
  nukeCandidates: string[];
  lastRun: number;
  market?: SwarmMarketMemory;
}

export interface SwarmGlobalState {
  ownedRooms: Array<{ name: string; role: SwarmRoomMemory["roomRole"] }>;
  intel: Record<string, SwarmIntelRoom>;
  powerBanks?: Array<{ room: string; decayTime: number }>;
  objectives?: string[];
}

export interface SwarmIntelRoom {
  sources: number;
  mineral?: { type: MineralConstant; amount: number };
  deposits?: Array<{ type: DepositConstant; cooldown: number; decay: number }>;
  controller?: { level: number; owner?: string; reserver?: string };
  threat?: number;
  lastSeen: number;
}

export interface SwarmClusterMemory {
  id: string;
  rooms: string[];
  role: "economic" | "war" | "mixed";
  metrics: {
    energyIncome: number;
    surplus: number;
    warIndex: number;
    commodityIndex?: number;
  };
  rallyPoints?: string[];
  tradePrefs?: ClusterTradePreferences;
}

/** Planned inter-room energy transfers. */
export interface SwarmLogisticsRoute {
  from: string;
  to: string;
  amount: number;
}

/** Cross-shard meta state aligned with the multi-layer design. */
export interface SwarmShardMeta {
  shards: Record<
    string,
    {
      role: "core" | "frontier" | "resource" | "backup";
      economyIndex: number;
      warIndex: number;
      cpuBucket: number;
      lastUpdated: number;
    }
  >;
  globalTargets: {
    powerLevel?: number;
    dominantWarShard?: string;
  };
}

/**
 * Root memory bag for the swarm bot.
 */
export interface SwarmMemory {
  overmind: SwarmOvermindMemory;
  global: SwarmGlobalState;
  clusters: Record<string, SwarmClusterMemory>;
  rooms: Record<string, SwarmRoomMemory>;
  logisticsRoutes: SwarmLogisticsRoute[];
  rallies: Record<string, string>;
  squads?: Record<string, SwarmSquadMemory>;
  metrics?: SwarmMetrics;
  powerQueue?: string[];
}

/**
 * Global Memory shape expected by swarm processes.
 */
export interface SwarmMemoryRoot {
  swarm?: SwarmMemory;
}

/** Lightweight creep memory schema. */
export interface SwarmCreepMemory extends CreepMemory {
  role: SwarmRole;
  family?: "economy" | "military" | "utility" | "power";
  homeRoom: string;
  targetRoom?: string;
  task?: string;
  sourceId?: Id<Source>;
  targetId?: Id<Structure | Creep | Resource>;
}

export interface SwarmSquadMemory {
  type: "harass" | "raid" | "siege" | "defense";
  members: Id<Creep>[];
  rally?: string;
  targets?: string[];
  state?: "gather" | "move" | "attack" | "retreat" | "dissolve";
}

export interface SwarmRoomMetrics {
  harvestedEma?: number;
  spendEma?: number;
  spawnEnergyEma?: number;
  constructionEma?: number;
  repairEma?: number;
  towerEma?: number;
  controllerProgressEma?: number;
  idleLarvaTicks?: number;
  hostilesEma?: number;
}

export interface SwarmMetrics {
  roomCpu?: Record<string, number>;
  globalCpu?: number;
}

export interface SwarmMarketMemory {
  lastScan: number;
  buyOrders: MarketOrderPreference[];
  sellOrders: MarketOrderPreference[];
  cooldowns: Record<string, number>;
  bestBuy: Partial<Record<ResourceConstant, MarketBestPrice>>;
  bestSell: Partial<Record<ResourceConstant, MarketBestPrice>>;
}

export interface MarketOrderPreference {
  resourceType: ResourceConstant;
  maxPrice: number;
  minPrice: number;
  minAmount: number;
}

export interface MarketBestPrice {
  orderId: string;
  price: number;
  amount: number;
  roomName?: string;
}

export interface ClusterTradePreferences {
  targets: Partial<Record<ResourceConstant, { min: number; max: number; emergencyMin?: number }>>;
  importDemand?: Partial<Record<ResourceConstant, boolean>>;
  exportSurplus?: Partial<Record<ResourceConstant, boolean>>;
  minAmounts?: Partial<Record<ResourceConstant, number>>;
}

/**
 * Typed kernel process context used by swarm processes.
 */
export type SwarmProcessContext = ProcessContext<SwarmMemoryRoot>;
