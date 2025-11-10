import type { RoomLike } from "@runtime/types/GameContext";
import { profile } from "@profiler";

/**
 * Commodity production order
 */
export interface CommodityOrder {
  commodity: CommodityConstant | MineralConstant | RESOURCE_ENERGY | RESOURCE_GHODIUM;
  amount: number;
  priority: number;
  createdAt: number;
}

/**
 * Serialized factory manager state for Memory persistence
 */
export interface FactoryManagerMemory {
  productionQueue: Record<string, CommodityOrder[]>;
}

/**
 * Factory manager configuration
 */
export interface FactoryManagerConfig {
  /** Logger for debugging */
  logger?: Pick<Console, "log" | "warn">;
  /** Optional Memory reference for persistence */
  memory?: FactoryManagerMemory;
}

/**
 * Manages factory operations for commodity production.
 * Handles automated production queue and resource management.
 *
 * State persistence: Production queue can be persisted to Memory
 * by providing a memory reference in the config and calling saveToMemory().
 */
@profile
export class FactoryManager {
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly productionQueue: Map<string, CommodityOrder[]> = new Map();
  private readonly memoryRef?: FactoryManagerMemory;

  public constructor(config: FactoryManagerConfig = {}) {
    this.logger = config.logger ?? console;
    this.memoryRef = config.memory;

    // Load state from Memory if provided
    if (this.memoryRef) {
      this.loadFromMemory();
    }
  }

  /**
   * Load state from Memory
   */
  private loadFromMemory(): void {
    if (!this.memoryRef) return;

    // Load production queue
    if (this.memoryRef.productionQueue) {
      for (const [roomName, orders] of Object.entries(this.memoryRef.productionQueue)) {
        this.productionQueue.set(roomName, orders);
      }
    }
  }

  /**
   * Save state to Memory (call periodically to persist state)
   */
  public saveToMemory(): void {
    if (!this.memoryRef) return;

    // Save production queue
    this.memoryRef.productionQueue = {};
    for (const [roomName, orders] of this.productionQueue.entries()) {
      this.memoryRef.productionQueue[roomName] = orders;
    }
  }

  /**
   * Execute factory logic for a room
   */
  public run(room: RoomLike): {
    productions: number;
    commoditiesProduced: number;
  } {
    const factory = room.find(FIND_MY_STRUCTURES, {
      filter: (s: Structure) => s.structureType === STRUCTURE_FACTORY
    })[0] as StructureFactory | undefined;

    if (!factory) {
      return { productions: 0, commoditiesProduced: 0 };
    }

    let productions = 0;
    let commoditiesProduced = 0;

    // Process production queue
    const orders = this.getProductionQueue(room.name);
    if (orders.length === 0) {
      // Auto-produce basic commodities if idle
      return this.autoProduction(room, factory);
    }

    // Sort by priority (highest first)
    orders.sort((a, b) => b.priority - a.priority);

    for (const order of orders) {
      if (factory.cooldown > 0) break;

      // Check if we can produce this commodity
      if (this.canProduce(factory, order.commodity)) {
        const result = factory.produce(order.commodity);
        if (result === OK) {
          productions++;
          commoditiesProduced += this.getProductionAmount(order.commodity);

          // Update or remove order
          order.amount -= this.getProductionAmount(order.commodity);
          if (order.amount <= 0) {
            this.removeOrder(room.name, order);
          }

          break; // Only one production per tick
        }
      }
    }

    // Periodically clean up old orders
    if (Game.time % 100 === 0) {
      this.clearOldOrders();
    }

    return { productions, commoditiesProduced };
  }

  /**
   * Auto-production when queue is empty
   */
  private autoProduction(
    room: RoomLike,
    factory: StructureFactory
  ): { productions: number; commoditiesProduced: number } {
    if (factory.cooldown > 0) {
      return { productions: 0, commoditiesProduced: 0 };
    }

    // Default to producing battery if we have energy
    if (this.canProduce(factory, RESOURCE_BATTERY)) {
      const result = factory.produce(RESOURCE_BATTERY);
      if (result === OK) {
        return { productions: 1, commoditiesProduced: 1 };
      }
    }

    return { productions: 0, commoditiesProduced: 0 };
  }

  /**
   * Check if factory can produce a commodity
   */
  private canProduce(
    factory: StructureFactory,
    commodity: CommodityConstant | MineralConstant | RESOURCE_ENERGY | RESOURCE_GHODIUM
  ): boolean {
    // Get recipe requirements
    const recipe = this.getRecipe(commodity);
    if (!recipe) return false;

    // Check if factory has required components
    for (const [resource, amount] of Object.entries(recipe)) {
      const available = factory.store.getUsedCapacity(resource as ResourceConstant);
      if (available < amount) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get production amount for a commodity
   * Note: Production amounts are simplified for now - all supported commodities produce 1 unit per run.
   * If new commodities with different production amounts are added, update this mapping accordingly.
   */
  private getProductionAmount(
    commodity: CommodityConstant | MineralConstant | RESOURCE_ENERGY | RESOURCE_GHODIUM
  ): number {
    // Production amounts per commodity (Screeps default recipes)
    // All currently supported commodities produce 1 unit per run
    const productionAmounts: Record<string, number> = {
      [RESOURCE_BATTERY]: 1,
      [RESOURCE_WIRE]: 1,
      [RESOURCE_CELL]: 1,
      [RESOURCE_ALLOY]: 1,
      [RESOURCE_CONDENSATE]: 1
    };
    // Default to 1 if commodity is not in the mapping
    return productionAmounts[commodity] ?? 1;
  }

  /**
   * Get recipe for a commodity (simplified)
   */
  private getRecipe(
    commodity: CommodityConstant | MineralConstant | RESOURCE_ENERGY | RESOURCE_GHODIUM
  ): Record<string, number> | null {
    // Basic commodity recipes
    const recipes: Record<string, Record<string, number>> = {
      [RESOURCE_BATTERY]: {
        [RESOURCE_ENERGY]: 600
      },
      [RESOURCE_WIRE]: {
        [RESOURCE_ENERGY]: 200,
        [RESOURCE_UTRIUM]: 20
      },
      [RESOURCE_CELL]: {
        [RESOURCE_ENERGY]: 200,
        [RESOURCE_LEMERGIUM]: 20
      },
      [RESOURCE_ALLOY]: {
        [RESOURCE_ENERGY]: 200,
        [RESOURCE_ZYNTHIUM]: 20
      },
      [RESOURCE_CONDENSATE]: {
        [RESOURCE_ENERGY]: 200,
        [RESOURCE_KEANIUM]: 20
      }
    };

    return recipes[commodity] ?? null;
  }

  /**
   * Add a commodity production order
   */
  public addOrder(
    roomName: string,
    commodity: CommodityConstant | MineralConstant | RESOURCE_ENERGY | RESOURCE_GHODIUM,
    amount: number,
    priority: number = 50
  ): void {
    if (!this.productionQueue.has(roomName)) {
      this.productionQueue.set(roomName, []);
    }

    const queue = this.productionQueue.get(roomName)!;
    queue.push({
      commodity,
      amount,
      priority,
      createdAt: Game.time
    });
  }

  /**
   * Get production queue for a room
   */
  private getProductionQueue(roomName: string): CommodityOrder[] {
    return this.productionQueue.get(roomName) ?? [];
  }

  /**
   * Remove a completed order
   */
  private removeOrder(roomName: string, order: CommodityOrder): void {
    const queue = this.productionQueue.get(roomName);
    if (!queue) return;

    const index = queue.findIndex(
      o =>
        o.commodity === order.commodity &&
        o.amount === order.amount &&
        o.priority === order.priority &&
        o.createdAt === order.createdAt
    );
    if (index !== -1) {
      queue.splice(index, 1);
    }
  }

  /**
   * Clear old orders (older than 5000 ticks)
   */
  public clearOldOrders(): void {
    for (const [roomName, orders] of this.productionQueue.entries()) {
      const filtered = orders.filter(order => Game.time - order.createdAt < 5000);
      this.productionQueue.set(roomName, filtered);
    }
  }
}
