import { Logger } from "@ralphschuler/screeps-logger";
import {
  MARKET_SCAN_INTERVAL,
  MARKET_CREDIT_FLOOR,
  MARKET_MAX_SPEND_PER_TICK,
  MARKET_TERMINAL_ENERGY_RESERVE,
  MARKET_PRICE_FLEX_WAR,
  MARKET_EMERGENCY_FACTOR
} from "../constants.js";
import { SwarmMemoryManager } from "../memory/SwarmMemoryManager.js";
import type {
  ClusterTradePreferences,
  MarketBestPrice,
  MarketOrderPreference,
  SwarmMemory,
  SwarmProcessContext
} from "../types.js";

interface TradeCandidate {
  resourceType: ResourceConstant;
  amount: number;
  orderId: string;
  price: number;
  terminal: StructureTerminal;
  direction: "buy" | "sell";
}

const DEFAULT_ORDER_PREFS: MarketOrderPreference[] = [
  { resourceType: RESOURCE_ENERGY, maxPrice: 0.25, minPrice: 0.15, minAmount: 1000 },
  { resourceType: RESOURCE_OXYGEN, maxPrice: 0.8, minPrice: 0.4, minAmount: 500 },
  { resourceType: RESOURCE_HYDROGEN, maxPrice: 0.8, minPrice: 0.4, minAmount: 500 },
  { resourceType: RESOURCE_KEANIUM, maxPrice: 1.2, minPrice: 0.6, minAmount: 500 },
  { resourceType: RESOURCE_ZYNTHIUM, maxPrice: 1.2, minPrice: 0.6, minAmount: 500 },
  { resourceType: RESOURCE_UTRIUM, maxPrice: 1.2, minPrice: 0.6, minAmount: 500 },
  { resourceType: RESOURCE_LEMERGIUM, maxPrice: 1.2, minPrice: 0.6, minAmount: 500 }
];

const memoryManager = new SwarmMemoryManager(new Logger({ minLevel: "info" }));
const logger = new Logger({ minLevel: "info" }).child({ system: "swarm-market" });

export function ensureMarketMemory(memory: SwarmMemory): void {
  if (!memory.overmind.market) {
    memory.overmind.market = {
      lastScan: 0,
      buyOrders: DEFAULT_ORDER_PREFS,
      sellOrders: DEFAULT_ORDER_PREFS,
      cooldowns: {},
      bestBuy: {},
      bestSell: {}
    };
  }
}

export function runMarketCycle(ctx: SwarmProcessContext): void {
  const swarmMemory = memoryManager.getOrInit(ctx.memory);
  ensureMarketMemory(swarmMemory);

  if (ctx.game.time < swarmMemory.overmind.market!.lastScan) {
    return;
  }

  scanMarket(ctx, swarmMemory);
  evaluateTrades(ctx, swarmMemory);
  swarmMemory.overmind.market!.lastScan = ctx.game.time + MARKET_SCAN_INTERVAL;
}

function scanMarket(ctx: SwarmProcessContext, memory: SwarmMemory): void {
  const marketMem = memory.overmind.market!;
  marketMem.bestBuy = {};
  marketMem.bestSell = {};

  const resources = new Set<ResourceConstant>();
  for (const entry of [...marketMem.buyOrders, ...marketMem.sellOrders]) {
    resources.add(entry.resourceType);
  }

  for (const resource of resources) {
    const buyOrders = Game.market.getAllOrders({ type: ORDER_BUY, resourceType: resource });
    const sellOrders = Game.market.getAllOrders({ type: ORDER_SELL, resourceType: resource });
    const bestBuy = buyOrders.sort((a, b) => b.price - a.price)[0];
    const bestSell = sellOrders.sort((a, b) => a.price - b.price)[0];

    if (bestBuy) {
      const buyEntry: MarketBestPrice = {
        orderId: bestBuy.id,
        price: bestBuy.price,
        amount: bestBuy.remainingAmount
      };
      if (bestBuy.roomName) buyEntry.roomName = bestBuy.roomName;
      marketMem.bestBuy[resource] = buyEntry;
    }

    if (bestSell) {
      const sellEntry: MarketBestPrice = {
        orderId: bestSell.id,
        price: bestSell.price,
        amount: bestSell.remainingAmount
      };
      if (bestSell.roomName) sellEntry.roomName = bestSell.roomName;
      marketMem.bestSell[resource] = sellEntry;
    }
  }
}

function evaluateTrades(ctx: SwarmProcessContext, memory: SwarmMemory): void {
  const marketMem = memory.overmind.market!;
  const terminals = Object.values(ctx.game.rooms)
    .map(room => room.terminal)
    .filter((t): t is StructureTerminal => !!t);

  if (!terminals.length) {
    return;
  }

  const warFlex = clusterMaxPheromone(memory, "war") >= 6 || clusterMaxPheromone(memory, "siege") >= 4;
  const priceFlex = warFlex ? MARKET_PRICE_FLEX_WAR : 1;

  const candidates: TradeCandidate[] = [];
  for (const cluster of Object.values(memory.clusters)) {
    const clusterTerminals = terminals.filter(t => cluster.rooms.includes(t.room.name));
    if (!clusterTerminals.length) continue;

    const tradePrefs = cluster.tradePrefs ?? ({ targets: {} } as ClusterTradePreferences);
    for (const [resourceType, range] of Object.entries(tradePrefs.targets) as Array<
      [ResourceConstant, { min: number; max: number; emergencyMin?: number }]
    >) {
      const stock = totalStockForResource(clusterTerminals, resourceType);
      const bestBuy = marketMem.bestBuy[resourceType];
      const bestSell = marketMem.bestSell[resourceType];

      if (
        stock < range.min &&
        bestSell &&
        bestSell.amount >= (tradePrefs.minAmounts?.[resourceType] ?? 0) &&
        canTradeResource(resourceType, marketMem.cooldowns)
      ) {
        const desired = range.min - stock;
        const pref = marketMem.buyOrders.find(p => p.resourceType === resourceType);
        const fallbackPref = DEFAULT_ORDER_PREFS[0]!;
        const maxPriceValue = pref?.maxPrice ?? fallbackPref.maxPrice;
        const emergencyMin = range.emergencyMin ?? range.min * 0.5;
        const emergency = stock < emergencyMin;
        const maxPrice = maxPriceValue * (emergency ? MARKET_EMERGENCY_FACTOR : priceFlex);
        if (bestSell.price <= maxPrice) {
          const terminal = pickTerminal(clusterTerminals, desired, resourceType);
          if (!terminal) continue;
          const amount = Math.min(desired, bestSell.amount, terminal.store.getFreeCapacity());
          const cost = Game.market.calcTransactionCost(
            amount,
            terminal.room.name,
            bestSell.roomName ?? terminal.room.name
          );
          if (
            terminal.store[RESOURCE_ENERGY] >= cost + MARKET_TERMINAL_ENERGY_RESERVE &&
            Game.market.credits >= MARKET_CREDIT_FLOOR
          ) {
            candidates.push({
              resourceType,
              amount,
              orderId: bestSell.orderId,
              price: bestSell.price,
              terminal,
              direction: "buy"
            });
          }
        }
      }

      if (
        stock > range.max &&
        bestBuy &&
        bestBuy.amount >= (tradePrefs.minAmounts?.[resourceType] ?? 0) &&
        canTradeResource(resourceType, marketMem.cooldowns)
      ) {
        const surplus = stock - range.max;
        const sellPref = marketMem.sellOrders.find(p => p.resourceType === resourceType);
        const fallbackSellPref = DEFAULT_ORDER_PREFS[0]!;
        const minPrice = (sellPref?.minPrice ?? fallbackSellPref.minPrice) / priceFlex;
        if (bestBuy.price >= minPrice) {
          const terminal = pickTerminal(clusterTerminals, surplus, resourceType, true);
          if (!terminal) continue;
          const amount = Math.min(surplus, bestBuy.amount, terminal.store[resourceType]);
          const cost = Game.market.calcTransactionCost(
            amount,
            terminal.room.name,
            bestBuy.roomName ?? terminal.room.name
          );
          if (terminal.store[RESOURCE_ENERGY] >= cost + MARKET_TERMINAL_ENERGY_RESERVE) {
            candidates.push({
              resourceType,
              amount,
              orderId: bestBuy.orderId,
              price: bestBuy.price,
              terminal,
              direction: "sell"
            });
          }
        }
      }
    }
  }

  for (const candidate of candidates) {
    const budgetedAmount = Math.min(candidate.amount, MARKET_MAX_SPEND_PER_TICK);
    const ok = executeTrade(ctx, candidate, budgetedAmount);
    if (ok) {
      marketMem.cooldowns[candidate.resourceType] = ctx.game.time + MARKET_SCAN_INTERVAL;
    }
  }
}

function executeTrade(ctx: SwarmProcessContext, candidate: TradeCandidate, amount: number): boolean {
  const costRoom = candidate.terminal.room.name;
  const cost = Game.market.calcTransactionCost(amount, costRoom, candidate.terminal.room.name);
  if (candidate.terminal.store[RESOURCE_ENERGY] < cost + MARKET_TERMINAL_ENERGY_RESERVE) {
    return false;
  }

  const dealResult = Game.market.deal(candidate.orderId, amount, costRoom);
  if (dealResult === OK) {
    logger.info("Executed market trade", {
      direction: candidate.direction,
      room: costRoom,
      resource: candidate.resourceType,
      amount,
      price: candidate.price
    });
    return true;
  }

  logger.warn("Failed market deal", { result: dealResult, orderId: candidate.orderId, room: costRoom });
  return false;
}

function totalStockForResource(terminals: StructureTerminal[], resource: ResourceConstant): number {
  return terminals.reduce((sum, t) => sum + (t.store[resource] ?? 0), 0);
}

function pickTerminal(
  terminals: StructureTerminal[],
  amount: number,
  resource: ResourceConstant,
  requireStock = false
): StructureTerminal | null {
  return (
    terminals
      .filter(t => !t.cooldown)
      .filter(t =>
        requireStock ? (t.store[resource] ?? 0) >= Math.min(amount, t.store.getCapacity(resource)) * 0.5 : true
      )
      .sort((a, b) => (b.store[RESOURCE_ENERGY] ?? 0) - (a.store[RESOURCE_ENERGY] ?? 0))[0] ?? null
  );
}

function canTradeResource(resource: ResourceConstant, cooldowns: Record<string, number>): boolean {
  const cooldown = cooldowns[resource];
  return cooldown === undefined || Game.time >= cooldown;
}

function clusterMaxPheromone(memory: SwarmMemory, key: keyof SwarmMemory["rooms"][string]["pheromones"]): number {
  let max = 0;
  for (const roomMem of Object.values(memory.rooms)) {
    max = Math.max(max, roomMem.pheromones[key]);
  }
  return max;
}
