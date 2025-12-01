/**
 * Market Manager - Phase 19
 *
 * Market scanning, pricing logic, trade decisions, and integration with strategy.
 */

import type { SwarmState, OvermindMemory } from "../memory/schemas";
import { getConfig } from "../config";

/**
 * Get overmind memory
 */
function getOvermind(): OvermindMemory {
  const mem = Memory as unknown as Record<string, OvermindMemory>;
  return mem["overmind"]!;
}

// Use getOvermind
void getOvermind;

/**
 * Market state in memory
 */
export interface MarketMemory {
  /** Last scan tick */
  lastScan: number;
  /** Buy order intentions */
  buyOrders: Array<{
    resourceType: ResourceConstant;
    maxPrice: number;
    minAmount: number;
    priority: number;
  }>;
  /** Sell order intentions */
  sellOrders: Array<{
    resourceType: ResourceConstant;
    minPrice: number;
    minAmount: number;
  }>;
  /** Per-resource trade cooldowns */
  cooldowns: Record<string, number>;
  /** Price history (rolling averages) */
  priceHistory: Record<string, { buy: number; sell: number; updated: number }>;
  /** Recent trades */
  recentTrades: Array<{
    type: "buy" | "sell";
    resource: ResourceConstant;
    amount: number;
    price: number;
    profit: number;
    tick: number;
  }>;
}

/**
 * Get market memory
 */
function getMarketMemory(): MarketMemory {
  const mem = Memory as unknown as Record<string, MarketMemory>;
  if (!mem["market"]) {
    mem["market"] = {
      lastScan: 0,
      buyOrders: [],
      sellOrders: [],
      cooldowns: {},
      priceHistory: {},
      recentTrades: []
    };
  }
  return mem["market"];
}

// =============================================================================
// 19.1 Market Data & Memory Schema
// =============================================================================

/**
 * Cluster trade preferences
 */
export interface ClusterTradePreferences {
  /** Target stock ranges per resource */
  targetStocks: Record<ResourceConstant, { min: number; max: number }>;
  /** Resources to import */
  importDemand: ResourceConstant[];
  /** Resources to export */
  exportSurplus: ResourceConstant[];
}

/**
 * Default target stocks
 */
export const DEFAULT_TARGET_STOCKS: Partial<Record<ResourceConstant, { min: number; max: number }>> = {
  [RESOURCE_ENERGY]: { min: 50000, max: 300000 },
  [RESOURCE_POWER]: { min: 5000, max: 50000 },
  [RESOURCE_HYDROGEN]: { min: 5000, max: 20000 },
  [RESOURCE_OXYGEN]: { min: 5000, max: 20000 },
  [RESOURCE_UTRIUM]: { min: 5000, max: 20000 },
  [RESOURCE_LEMERGIUM]: { min: 5000, max: 20000 },
  [RESOURCE_KEANIUM]: { min: 5000, max: 20000 },
  [RESOURCE_ZYNTHIUM]: { min: 5000, max: 20000 },
  [RESOURCE_CATALYST]: { min: 3000, max: 10000 },
  [RESOURCE_GHODIUM]: { min: 1000, max: 5000 }
};

// =============================================================================
// 19.2 Market Scanning & Pricing Logic
// =============================================================================

/**
 * Market order summary
 */
export interface MarketOrderSummary {
  resourceType: ResourceConstant;
  bestBuyPrice: number;
  bestSellPrice: number;
  avgBuyPrice: number;
  avgSellPrice: number;
  buyVolume: number;
  sellVolume: number;
}

/**
 * Scan market for resource
 */
export function scanMarketForResource(resourceType: ResourceConstant): MarketOrderSummary {
  const orders = Game.market.getAllOrders({ resourceType });

  let bestBuyPrice = 0;
  let bestSellPrice = Infinity;
  let totalBuyPrice = 0;
  let totalSellPrice = 0;
  let buyVolume = 0;
  let sellVolume = 0;

  for (const order of orders) {
    if (order.type === ORDER_BUY) {
      if (order.price > bestBuyPrice) {
        bestBuyPrice = order.price;
      }
      totalBuyPrice += order.price * order.remainingAmount;
      buyVolume += order.remainingAmount;
    } else {
      if (order.price < bestSellPrice) {
        bestSellPrice = order.price;
      }
      totalSellPrice += order.price * order.remainingAmount;
      sellVolume += order.remainingAmount;
    }
  }

  return {
    resourceType,
    bestBuyPrice,
    bestSellPrice: bestSellPrice === Infinity ? 0 : bestSellPrice,
    avgBuyPrice: buyVolume > 0 ? totalBuyPrice / buyVolume : 0,
    avgSellPrice: sellVolume > 0 ? totalSellPrice / sellVolume : 0,
    buyVolume,
    sellVolume
  };
}

/**
 * Update price history
 */
export function updatePriceHistory(resourceType: ResourceConstant): void {
  const market = getMarketMemory();
  const summary = scanMarketForResource(resourceType);

  market.priceHistory[resourceType] = {
    buy: summary.avgBuyPrice,
    sell: summary.avgSellPrice,
    updated: Game.time
  };
}

/**
 * Run market scan
 */
export function runMarketScan(): void {
  const market = getMarketMemory();
  const config = getConfig().market;

  // Only scan periodically
  if (Game.time - market.lastScan < config.scanInterval) return;

  // Scan key resources
  const resources: ResourceConstant[] = [
    RESOURCE_ENERGY,
    RESOURCE_POWER,
    RESOURCE_HYDROGEN,
    RESOURCE_OXYGEN,
    RESOURCE_UTRIUM,
    RESOURCE_LEMERGIUM,
    RESOURCE_KEANIUM,
    RESOURCE_ZYNTHIUM,
    RESOURCE_CATALYST,
    RESOURCE_GHODIUM
  ];

  for (const resource of resources) {
    updatePriceHistory(resource);
  }

  market.lastScan = Game.time;
}

/**
 * Get acceptable buy price
 */
export function getAcceptableBuyPrice(resourceType: ResourceConstant, emergency: boolean = false): number {
  const market = getMarketMemory();
  const config = getConfig().market;

  const history = market.priceHistory[resourceType];
  if (!history) return 0;

  const tolerance = emergency ? config.priceTolerance.emergency : config.priceTolerance.buy;
  return history.sell * (1 + tolerance);
}

/**
 * Get acceptable sell price
 */
export function getAcceptableSellPrice(resourceType: ResourceConstant): number {
  const market = getMarketMemory();
  const config = getConfig().market;

  const history = market.priceHistory[resourceType];
  if (!history) return Infinity;

  return history.buy * (1 - config.priceTolerance.sell);
}

// =============================================================================
// 19.3 Trade Decision Logic (Buy & Sell)
// =============================================================================

/**
 * Trade decision
 */
export interface TradeDecision {
  action: "buy" | "sell" | "none";
  resourceType: ResourceConstant;
  amount: number;
  orderId?: string;
  price: number;
  reason: string;
}

/**
 * Evaluate buy decision for room
 */
export function evaluateBuyDecision(
  room: Room,
  resourceType: ResourceConstant,
  currentStock: number,
  targetMin: number
): TradeDecision {
  const config = getConfig().market;
  const market = getMarketMemory();

  // Check if below target
  if (currentStock >= targetMin) {
    return { action: "none", resourceType, amount: 0, price: 0, reason: "Stock sufficient" };
  }

  // Check cooldown
  if ((market.cooldowns[resourceType] ?? 0) > Game.time) {
    return { action: "none", resourceType, amount: 0, price: 0, reason: "On cooldown" };
  }

  // Check credits
  if (Game.market.credits < config.minCreditReserve) {
    return { action: "none", resourceType, amount: 0, price: 0, reason: "Credits too low" };
  }

  // Check terminal
  const terminal = room.terminal;
  if (!terminal || terminal.cooldown > 0) {
    return { action: "none", resourceType, amount: 0, price: 0, reason: "Terminal not ready" };
  }

  // Find acceptable sell order
  const emergency = currentStock < targetMin * 0.25;
  const maxPrice = getAcceptableBuyPrice(resourceType, emergency);

  const orders = Game.market.getAllOrders({
    type: ORDER_SELL,
    resourceType
  });

  // Filter by price and sort
  const acceptable = orders
    .filter(o => o.price <= maxPrice && o.remainingAmount >= 100)
    .sort((a, b) => a.price - b.price);

  if (acceptable.length === 0) {
    return { action: "none", resourceType, amount: 0, price: 0, reason: "No acceptable orders" };
  }

  const order = acceptable[0]!;
  const deficit = targetMin - currentStock;
  const amount = Math.min(deficit, order.remainingAmount, 10000);

  // Check if we can afford
  const cost = Game.market.calcTransactionCost(amount, room.name, order.roomName!);
  if (terminal.store.getUsedCapacity(RESOURCE_ENERGY) < cost) {
    return { action: "none", resourceType, amount: 0, price: 0, reason: "Not enough energy for transfer" };
  }

  const totalCost = order.price * amount;
  if (totalCost > config.maxCreditsPerTick) {
    return { action: "none", resourceType, amount: 0, price: 0, reason: "Exceeds per-tick limit" };
  }

  return {
    action: "buy",
    resourceType,
    amount,
    orderId: order.id,
    price: order.price,
    reason: "Profitable buy"
  };
}

/**
 * Evaluate sell decision for room
 */
export function evaluateSellDecision(
  room: Room,
  resourceType: ResourceConstant,
  currentStock: number,
  targetMax: number
): TradeDecision {
  const market = getMarketMemory();

  // Check if above target
  if (currentStock <= targetMax) {
    return { action: "none", resourceType, amount: 0, price: 0, reason: "Stock not surplus" };
  }

  // Check cooldown
  if ((market.cooldowns[resourceType] ?? 0) > Game.time) {
    return { action: "none", resourceType, amount: 0, price: 0, reason: "On cooldown" };
  }

  // Check terminal
  const terminal = room.terminal;
  if (!terminal || terminal.cooldown > 0) {
    return { action: "none", resourceType, amount: 0, price: 0, reason: "Terminal not ready" };
  }

  // Find acceptable buy order
  const minPrice = getAcceptableSellPrice(resourceType);

  const orders = Game.market.getAllOrders({
    type: ORDER_BUY,
    resourceType
  });

  // Filter by price and sort
  const acceptable = orders
    .filter(o => o.price >= minPrice && o.remainingAmount >= 100)
    .sort((a, b) => b.price - a.price);

  if (acceptable.length === 0) {
    return { action: "none", resourceType, amount: 0, price: 0, reason: "No acceptable orders" };
  }

  const order = acceptable[0]!;
  const surplus = currentStock - targetMax;
  const amount = Math.min(surplus, order.remainingAmount, terminal.store.getUsedCapacity(resourceType), 10000);

  // Check energy for transfer
  const cost = Game.market.calcTransactionCost(amount, room.name, order.roomName!);
  if (terminal.store.getUsedCapacity(RESOURCE_ENERGY) < cost) {
    return { action: "none", resourceType, amount: 0, price: 0, reason: "Not enough energy for transfer" };
  }

  return {
    action: "sell",
    resourceType,
    amount,
    orderId: order.id,
    price: order.price,
    reason: "Profitable sell"
  };
}

/**
 * Execute trade
 */
export function executeTrade(decision: TradeDecision, room: Room): number {
  if (decision.action === "none" || !decision.orderId) return ERR_INVALID_ARGS;

  const result = Game.market.deal(decision.orderId, decision.amount, room.name);

  if (result === OK) {
    const market = getMarketMemory();
    const config = getConfig().market;

    // Set cooldown
    market.cooldowns[decision.resourceType] = Game.time + config.tradeCooldown;

    // Record trade
    market.recentTrades.push({
      type: decision.action,
      resource: decision.resourceType,
      amount: decision.amount,
      price: decision.price,
      profit: decision.action === "sell" ? decision.amount * decision.price : -decision.amount * decision.price,
      tick: Game.time
    });

    // Keep only last 50 trades
    while (market.recentTrades.length > 50) {
      market.recentTrades.shift();
    }
  }

  return result;
}

// =============================================================================
// 19.4 Integration with Pheromones & Strategy
// =============================================================================

/**
 * Get trade priorities based on pheromones
 */
export function getTradesPrioritiesFromPheromones(swarm: SwarmState): {
  buyPriority: ResourceConstant[];
  sellPriority: ResourceConstant[];
} {
  const buyPriority: ResourceConstant[] = [];
  const sellPriority: ResourceConstant[] = [];

  // High war/siege - buy combat boosts
  if (swarm.pheromones.war > 50 || swarm.pheromones.siege > 50) {
    buyPriority.push(
      RESOURCE_CATALYZED_UTRIUM_ACID as ResourceConstant,
      RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE as ResourceConstant,
      RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE as ResourceConstant
    );
  }

  // High expand - buy energy
  if (swarm.pheromones.expand > 50) {
    buyPriority.push(RESOURCE_ENERGY);
  }

  // Stable economy - sell surplus
  if (swarm.posture === "eco" && swarm.danger === 0) {
    sellPriority.push(
      RESOURCE_HYDROGEN,
      RESOURCE_OXYGEN,
      RESOURCE_UTRIUM,
      RESOURCE_LEMERGIUM,
      RESOURCE_KEANIUM,
      RESOURCE_ZYNTHIUM
    );
  }

  return { buyPriority, sellPriority };
}

// =============================================================================
// 19.5 Emergency & Failsafe Behaviors
// =============================================================================

/**
 * Check for emergency resource needs
 */
export function checkEmergencyNeeds(room: Room): ResourceConstant | null {
  const config = getConfig().market;
  const terminal = room.terminal;
  const storage = room.storage;

  if (!terminal && !storage) return null;

  const energy =
    (terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0) + (storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0);

  // Emergency if energy critically low
  if (energy < config.safetyBuffer.energy * 0.5) {
    return RESOURCE_ENERGY;
  }

  return null;
}

/**
 * Execute emergency buy
 */
export function executeEmergencyBuy(room: Room, resourceType: ResourceConstant): number {
  // Relax price constraints
  const orders = Game.market.getAllOrders({
    type: ORDER_SELL,
    resourceType
  });

  // Sort by price and take cheapest
  const sorted = orders.filter(o => o.remainingAmount >= 1000).sort((a, b) => a.price - b.price);

  if (sorted.length === 0) return ERR_NOT_FOUND;

  const order = sorted[0]!;
  const amount = Math.min(10000, order.remainingAmount);

  return Game.market.deal(order.id, amount, room.name);
}

/**
 * Get market summary
 */
export function getMarketSummary(): {
  credits: number;
  recentProfit: number;
  recentTrades: number;
  priceData: Record<string, { buy: number; sell: number }>;
} {
  const market = getMarketMemory();

  // Calculate recent profit (last 1000 ticks)
  const recentProfit = market.recentTrades.filter(t => Game.time - t.tick < 1000).reduce((sum, t) => sum + t.profit, 0);

  const recentTrades = market.recentTrades.filter(t => Game.time - t.tick < 1000).length;

  const priceData: Record<string, { buy: number; sell: number }> = {};
  for (const [resource, history] of Object.entries(market.priceHistory)) {
    priceData[resource] = { buy: history.buy, sell: history.sell };
  }

  return {
    credits: Game.market.credits,
    recentProfit,
    recentTrades,
    priceData
  };
}

/**
 * Run market manager
 */
export function runMarketManager(ownedRooms: string[], swarms: Map<string, SwarmState>): void {
  // Scan market
  runMarketScan();

  // Only trade periodically
  if (Game.time % 10 !== 0) return;

  for (const roomName of ownedRooms) {
    const room = Game.rooms[roomName];
    const swarm = swarms.get(roomName);
    if (!room || !swarm) continue;

    const terminal = room.terminal;
    const storage = room.storage;
    if (!terminal) continue;

    // Check emergency
    const emergency = checkEmergencyNeeds(room);
    if (emergency) {
      executeEmergencyBuy(room, emergency);
      continue;
    }

    // Get trade priorities
    const { buyPriority, sellPriority } = getTradesPrioritiesFromPheromones(swarm);

    // Evaluate trades for key resources
    const resources = Object.keys(DEFAULT_TARGET_STOCKS) as ResourceConstant[];

    for (const resourceType of resources) {
      const targets = DEFAULT_TARGET_STOCKS[resourceType];
      if (!targets) continue;

      const terminalStock = terminal.store.getUsedCapacity(resourceType);
      const storageStock = storage?.store.getUsedCapacity(resourceType) ?? 0;
      const totalStock = terminalStock + storageStock;

      // Check sell first (if surplus)
      if (sellPriority.includes(resourceType) || totalStock > targets.max) {
        const sellDecision = evaluateSellDecision(room, resourceType, totalStock, targets.max);
        if (sellDecision.action === "sell") {
          const result = executeTrade(sellDecision, room);
          if (result === OK) {
            break; // One trade per room per tick
          }
        }
      }

      // Check buy (if deficit)
      if (buyPriority.includes(resourceType) || totalStock < targets.min) {
        const buyDecision = evaluateBuyDecision(room, resourceType, totalStock, targets.min);
        if (buyDecision.action === "buy") {
          const result = executeTrade(buyDecision, room);
          if (result === OK) {
            break; // One trade per room per tick
          }
        }
      }
    }
  }
}
