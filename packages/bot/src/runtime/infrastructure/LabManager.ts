import type { RoomLike } from "@runtime/types/GameContext";
import { profile } from "@ralphschuler/screeps-profiler";

/**
 * Lab operation state
 */
export type LabState = "idle" | "production" | "boosting" | "cooldown";

/**
 * Compound production order
 */
export interface CompoundOrder {
  compound: ResourceConstant;
  amount: number;
  priority: number;
  lab1Resource: ResourceConstant;
  lab2Resource: ResourceConstant;
}

/**
 * Boosting request for a creep
 */
export interface BoostRequest {
  creepName: string;
  boosts: ResourceConstant[];
  priority: number;
  requestedAt: number;
}

/**
 * Serialized lab manager state for Memory persistence
 */
export interface LabManagerMemory {
  productionQueue: Record<string, CompoundOrder[]>;
  boostQueue: Record<string, BoostRequest[]>;
}

/**
 * Lab configuration
 */
export interface LabManagerConfig {
  /** Logger for debugging */
  logger?: Pick<Console, "log" | "warn">;
  /** Optional Memory reference for persistence */
  memory?: LabManagerMemory;
}

/**
 * Manages lab operations including compound production and creep boosting.
 * Coordinates multiple labs for efficient resource processing.
 *
 * State persistence: Production and boost queues can be persisted to Memory
 * by providing a memory reference in the config and calling saveToMemory().
 */
@profile
export class LabManager {
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly labStates: Map<string, Map<Id<StructureLab>, LabState>> = new Map();
  private readonly productionQueue: Map<string, CompoundOrder[]> = new Map();
  private readonly boostQueue: Map<string, BoostRequest[]> = new Map();
  private readonly memoryRef?: LabManagerMemory;

  public constructor(config: LabManagerConfig = {}) {
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

    // Load boost queue
    if (this.memoryRef.boostQueue) {
      for (const [roomName, requests] of Object.entries(this.memoryRef.boostQueue)) {
        this.boostQueue.set(roomName, requests);
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

    // Save boost queue
    this.memoryRef.boostQueue = {};
    for (const [roomName, requests] of this.boostQueue.entries()) {
      this.memoryRef.boostQueue[roomName] = requests;
    }
  }

  /**
   * Execute lab logic for a room
   */
  public run(room: RoomLike): {
    reactions: number;
    boosts: number;
    state: LabState;
  } {
    const labs = room.find(FIND_MY_STRUCTURES, {
      filter: (s: Structure) => s.structureType === STRUCTURE_LAB
    }) as StructureLab[];

    if (labs.length < 3) {
      // Need at least 3 labs for production (2 input + 1 output)
      return { reactions: 0, boosts: 0, state: "idle" };
    }

    // Initialize lab states
    if (!this.labStates.has(room.name)) {
      const states = new Map<Id<StructureLab>, LabState>();
      for (const lab of labs) {
        states.set(lab.id, "idle");
      }
      this.labStates.set(room.name, states);
    }

    let reactions = 0;
    let boosts = 0;
    let currentState: LabState = "idle";

    // Process boosting requests first (highest priority)
    const boostResult = this.processBoostRequests(room, labs);
    boosts += boostResult.boosts;
    if (boostResult.boosts > 0) {
      currentState = "boosting";
    }

    // Process production if not boosting
    if (boostResult.boosts === 0) {
      const prodResult = this.processProduction(room, labs);
      reactions += prodResult.reactions;
      if (prodResult.reactions > 0) {
        currentState = "production";
      }
    }

    return { reactions, boosts, state: currentState };
  }

  /**
   * Process compound production orders
   */
  private processProduction(room: RoomLike, labs: StructureLab[]): { reactions: number } {
    const orders = this.getProductionQueue(room.name);
    if (orders.length === 0) {
      return { reactions: 0 };
    }

    // Sort by priority
    orders.sort((a, b) => b.priority - a.priority);

    let reactions = 0;

    for (const order of orders) {
      // Find available labs for reaction
      const labSetup = this.findLabsForReaction(labs, order);
      if (!labSetup) continue;

      const { input1, input2, output } = labSetup;

      // Check if output lab can react
      if (output.cooldown === 0) {
        const result = output.runReaction(input1, input2);
        if (result === OK) {
          reactions++;

          // Check if order is complete
          const produced = output.store.getUsedCapacity(order.compound);
          if (produced >= order.amount) {
            this.removeProductionOrder(room.name, order);
          }
        }
      }
    }

    return { reactions };
  }

  /**
   * Process boosting requests
   */
  private processBoostRequests(room: RoomLike, labs: StructureLab[]): { boosts: number } {
    const requests = this.getBoostQueue(room.name);
    if (requests.length === 0) {
      return { boosts: 0 };
    }

    // Sort by priority
    requests.sort((a, b) => b.priority - a.priority);

    let boosts = 0;

    for (const request of requests) {
      const creep = Game.creeps[request.creepName];
      if (!creep) {
        // Creep died, remove request
        this.removeBoostRequest(room.name, request);
        continue;
      }

      // Check if creep is in range of labs
      const boostedResources: ResourceConstant[] = [];
      for (const boostResource of request.boosts) {
        const lab = labs.find(l => l.store.getUsedCapacity(boostResource) >= 30 && l.pos.getRangeTo(creep) <= 1);

        if (lab?.cooldown === 0) {
          const result = lab.boostCreep(creep);
          if (result === OK) {
            boosts++;
            boostedResources.push(boostResource);
          }
        }
      }

      // Remove boosted resources from request
      if (boostedResources.length > 0) {
        request.boosts = request.boosts.filter(b => !boostedResources.includes(b));

        // Remove request if all boosts complete
        if (request.boosts.length === 0) {
          this.removeBoostRequest(room.name, request);
        }
      }
    }

    return { boosts };
  }

  /**
   * Find suitable labs for a reaction
   */
  private findLabsForReaction(
    labs: StructureLab[],
    order: CompoundOrder
  ): { input1: StructureLab; input2: StructureLab; output: StructureLab } | null {
    // Find input labs with required resources
    const input1 = labs.find(
      lab => lab.mineralType === order.lab1Resource && lab.store.getUsedCapacity(order.lab1Resource) >= 5
    );

    const input2 = labs.find(
      lab =>
        lab.mineralType === order.lab2Resource &&
        lab.store.getUsedCapacity(order.lab2Resource) >= 5 &&
        lab.id !== input1?.id
    );

    if (!input1 || !input2) return null;

    // Find output lab (empty or has target compound)
    const output = labs.find(
      lab =>
        lab.id !== input1.id &&
        lab.id !== input2.id &&
        (lab.mineralType === null || lab.mineralType === order.compound) &&
        lab.store.getFreeCapacity(order.compound) >= 5 &&
        lab.pos.inRangeTo(input1, 2) &&
        lab.pos.inRangeTo(input2, 2)
    );

    if (!output) return null;

    return { input1, input2, output };
  }

  /**
   * Add a compound production order
   */
  public addProductionOrder(roomName: string, compound: ResourceConstant, amount: number, priority: number = 50): void {
    if (!this.productionQueue.has(roomName)) {
      this.productionQueue.set(roomName, []);
    }

    // Determine required input resources (simplified)
    const recipe = this.getRecipe(compound);
    if (!recipe) {
      this.logger.warn(`Unknown compound recipe: ${compound}`);
      return;
    }

    const queue = this.productionQueue.get(roomName)!;
    queue.push({
      compound,
      amount,
      priority,
      lab1Resource: recipe.input1,
      lab2Resource: recipe.input2
    });
  }

  /**
   * Add a boosting request
   */
  public addBoostRequest(
    roomName: string,
    creepName: string,
    boosts: ResourceConstant[],
    priority: number = 100
  ): void {
    if (!this.boostQueue.has(roomName)) {
      this.boostQueue.set(roomName, []);
    }

    const queue = this.boostQueue.get(roomName)!;
    queue.push({
      creepName,
      boosts,
      priority,
      requestedAt: Game.time
    });
  }

  /**
   * Get production queue for a room
   */
  private getProductionQueue(roomName: string): CompoundOrder[] {
    return this.productionQueue.get(roomName) ?? [];
  }

  /**
   * Get boost queue for a room
   */
  private getBoostQueue(roomName: string): BoostRequest[] {
    return this.boostQueue.get(roomName) ?? [];
  }

  /**
   * Remove a production order
   */
  private removeProductionOrder(roomName: string, order: CompoundOrder): void {
    const queue = this.productionQueue.get(roomName);
    if (!queue) return;

    const index = queue.findIndex(
      o =>
        o.compound === order.compound &&
        o.amount === order.amount &&
        o.priority === order.priority &&
        o.lab1Resource === order.lab1Resource &&
        o.lab2Resource === order.lab2Resource
    );
    if (index !== -1) {
      queue.splice(index, 1);
    }
  }

  /**
   * Remove a boost request
   */
  private removeBoostRequest(roomName: string, request: BoostRequest): void {
    const queue = this.boostQueue.get(roomName);
    if (!queue) return;

    const index = queue.findIndex(
      r => r.creepName === request.creepName && r.priority === request.priority && r.requestedAt === request.requestedAt
    );
    if (index !== -1) {
      queue.splice(index, 1);
    }
  }

  /**
   * Get compound recipe (simplified - only basic compounds)
   * @returns Recipe inputs or null if compound is not supported
   */
  private getRecipe(compound: ResourceConstant): { input1: ResourceConstant; input2: ResourceConstant } | null {
    // Basic compounds (Tier 1) - using Screeps constants as keys
    const recipes: Record<ResourceConstant, { input1: ResourceConstant; input2: ResourceConstant }> = {
      [RESOURCE_UTRIUM_HYDRIDE]: { input1: RESOURCE_UTRIUM, input2: RESOURCE_HYDROGEN },
      [RESOURCE_UTRIUM_OXIDE]: { input1: RESOURCE_UTRIUM, input2: RESOURCE_OXYGEN },
      [RESOURCE_KEANIUM_HYDRIDE]: { input1: RESOURCE_KEANIUM, input2: RESOURCE_HYDROGEN },
      [RESOURCE_KEANIUM_OXIDE]: { input1: RESOURCE_KEANIUM, input2: RESOURCE_OXYGEN },
      [RESOURCE_LEMERGIUM_HYDRIDE]: { input1: RESOURCE_LEMERGIUM, input2: RESOURCE_HYDROGEN },
      [RESOURCE_LEMERGIUM_OXIDE]: { input1: RESOURCE_LEMERGIUM, input2: RESOURCE_OXYGEN },
      [RESOURCE_ZYNTHIUM_HYDRIDE]: { input1: RESOURCE_ZYNTHIUM, input2: RESOURCE_HYDROGEN },
      [RESOURCE_ZYNTHIUM_OXIDE]: { input1: RESOURCE_ZYNTHIUM, input2: RESOURCE_OXYGEN },
      [RESOURCE_GHODIUM_HYDRIDE]: { input1: RESOURCE_GHODIUM, input2: RESOURCE_HYDROGEN },
      [RESOURCE_GHODIUM_OXIDE]: { input1: RESOURCE_GHODIUM, input2: RESOURCE_OXYGEN }
    };

    return recipes[compound] ?? null;
  }
}
