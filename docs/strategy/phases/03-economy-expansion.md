# Phase 3: Economy Expansion - Implementation Guide

This guide covers advanced economy features including terminal management, mineral processing, market trading, and factory automation.

## Phase Overview

**Goal**: Establish advanced resource economy with terminal logistics, lab automation, and market integration.

**Duration**: 4-5 weeks  
**Priority**: MEDIUM  
**Prerequisites**: Phase 2 complete, RCL 5+ achieved  
**Status**: 📋 Planned

## Success Criteria

- ✅ Mineral production sustains lab operations continuously
- ✅ Market trades generate positive credit balance
- ✅ Terminal maintains balanced resource stockpiles (20k+ energy)
- ✅ CPU efficiency <15 per tick with 15-20 creeps
- ✅ Energy income >40 per tick per room

## Key Deliverables

### 1. Terminal Manager

**Purpose**: Inter-room resource transfer and market integration

```typescript
// src/runtime/managers/TerminalManager.ts
export class TerminalManager {
  private readonly ENERGY_RESERVE = 20000;
  private readonly TRANSFER_AMOUNT = 1000;

  public run(room: Room): void {
    const terminal = room.terminal;
    if (!terminal) return;

    this.balanceEnergy(room, terminal);
    this.transferResources(room, terminal);
  }

  private balanceEnergy(room: Room, terminal: StructureTerminal): void {
    const energy = terminal.store.getUsedCapacity(RESOURCE_ENERGY);

    if (energy < this.ENERGY_RESERVE) {
      // Request energy from storage or other rooms
      this.requestResource(room, RESOURCE_ENERGY, this.ENERGY_RESERVE - energy);
    }
  }

  private transferResources(room: Room, terminal: StructureTerminal): void {
    // Check for resource requests from other rooms
    const requests = this.getResourceRequests(room);

    for (const request of requests) {
      if (terminal.cooldown > 0) break;

      const available = terminal.store.getUsedCapacity(request.resource);
      if (available >= request.amount) {
        terminal.send(request.resource, request.amount, request.targetRoom, `Resource transfer: ${request.resource}`);
      }
    }
  }

  private getResourceRequests(room: Room): ResourceRequest[] {
    // Read from Memory.empire.resourceRequests or similar
    return [];
  }

  private requestResource(room: Room, resource: ResourceConstant, amount: number): void {
    // Add request to empire-wide resource request queue
  }
}
```

### 2. Lab Manager

**Purpose**: Automate mineral reactions and compound production

```typescript
// src/runtime/managers/LabManager.ts
export class LabManager {
  public run(room: Room): void {
    const labs = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_LAB }
    }) as StructureLab[];

    if (labs.length < 3) return; // Need at least 3 labs for reactions

    const [inputLab1, inputLab2, ...outputLabs] = this.organizeLabs(labs);

    this.runReactions(inputLab1, inputLab2, outputLabs);
  }

  private organizeLabs(labs: StructureLab[]): StructureLab[] {
    // Identify which labs should be input vs output
    // Input labs: Hold base minerals
    // Output labs: Receive compounds from reactions
    return labs;
  }

  private runReactions(input1: StructureLab, input2: StructureLab, outputs: StructureLab[]): void {
    // Get current production queue
    const queue = this.getProductionQueue();
    if (queue.length === 0) return;

    const targetCompound = queue[0];
    const [mineral1, mineral2] = this.getRecipeIngredients(targetCompound);

    // Ensure input labs have correct minerals
    this.fillInputLab(input1, mineral1);
    this.fillInputLab(input2, mineral2);

    // Run reactions in output labs
    for (const output of outputs) {
      if (output.cooldown === 0) {
        output.runReaction(input1, input2);
      }
    }
  }

  private getRecipeIngredients(compound: MineralCompoundConstant): [MineralConstant, MineralConstant] {
    // Return ingredients needed for compound
    // E.g., "UH" requires "U" + "H"
    return [RESOURCE_HYDROGEN, RESOURCE_OXYGEN]; // Placeholder
  }

  private fillInputLab(lab: StructureLab, mineral: ResourceConstant): void {
    // Create tasks to haul mineral to lab if needed
  }

  private getProductionQueue(): MineralCompoundConstant[] {
    // Read from Memory.labs.productionQueue
    return [];
  }
}
```

### 3. Market Manager

**Purpose**: Automated market analysis and trading

```typescript
// src/runtime/managers/MarketManager.ts
export class MarketManager {
  private readonly PRICE_HISTORY_TICKS = 1000;
  private readonly PROFIT_MARGIN = 1.2; // 20% markup

  public run(): void {
    this.updatePriceHistory();
    this.executeTrades();
    this.createOrders();
  }

  private updatePriceHistory(): void {
    // Sample current market prices
    const resources = [RESOURCE_ENERGY, RESOURCE_HYDROGEN, RESOURCE_OXYGEN];

    for (const resource of resources) {
      const orders = Game.market.getAllOrders({ resourceType: resource });
      const avgPrice = this.calculateAveragePrice(orders);

      // Store in Memory.market.priceHistory[resource]
    }
  }

  private calculateAveragePrice(orders: Order[]): number {
    if (orders.length === 0) return 0;

    const sum = orders.reduce((total, order) => total + order.price, 0);
    return sum / orders.length;
  }

  private executeTrades(): void {
    // Check for profitable buy opportunities
    const buyOpportunities = this.identifyBuyOpportunities();

    for (const opp of buyOpportunities) {
      if (this.isProfitable(opp)) {
        Game.market.deal(opp.orderId, opp.amount, opp.roomName);
      }
    }
  }

  private identifyBuyOpportunities(): TradeOpportunity[] {
    // Analyze market for resources below historical average
    return [];
  }

  private isProfitable(opportunity: TradeOpportunity): boolean {
    const historicalPrice = this.getHistoricalPrice(opportunity.resource);
    return opportunity.price < historicalPrice / this.PROFIT_MARGIN;
  }

  private getHistoricalPrice(resource: ResourceConstant): number {
    // Read from Memory.market.priceHistory
    return 0;
  }

  private createOrders(): void {
    // Create sell orders for excess resources
    // Create buy orders for needed resources
  }
}
```

### 4. Factory Manager (RCL 7+)

**Purpose**: Automate factory production

```typescript
// src/runtime/managers/FactoryManager.ts
export class FactoryManager {
  public run(room: Room): void {
    const factory = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_FACTORY }
    })[0] as StructureFactory | undefined;

    if (!factory) return;

    const productionQueue = this.getProductionQueue(room);
    if (productionQueue.length === 0) return;

    const product = productionQueue[0];
    this.produce(factory, product);
  }

  private produce(factory: StructureFactory, product: CommodityConstant): void {
    // Check if factory has required components
    const recipe = COMMODITIES[product];
    if (!recipe) return;

    const hasComponents = Object.entries(recipe.components ?? {}).every(([component, amount]) => {
      return factory.store.getUsedCapacity(component as ResourceConstant) >= (amount ?? 0);
    });

    if (hasComponents && factory.cooldown === 0) {
      factory.produce(product);
    }
  }

  private getProductionQueue(room: Room): CommodityConstant[] {
    // Read from Memory.factory.productionQueue
    return [];
  }
}
```

### 5. Mineral Harvester Role

**Purpose**: Harvest minerals from extractor

```typescript
// In behavior roles
class MineralHarvesterRole {
  public run(creep: Creep): void {
    if (creep.store.getFreeCapacity() > 0) {
      this.harvestMineral(creep);
    } else {
      this.deliverMineral(creep);
    }
  }

  private harvestMineral(creep: Creep): void {
    const extractor = creep.room.find(FIND_STRUCTURES, {
      filter: { structureType: STRUCTURE_EXTRACTOR }
    })[0] as StructureExtractor | undefined;

    if (!extractor) return;

    const mineral = extractor.pos.lookFor(LOOK_MINERALS).find(m => m.mineralAmount > 0);

    if (mineral) {
      if (creep.harvest(mineral) === ERR_NOT_IN_RANGE) {
        creep.moveTo(mineral);
      }
    }
  }

  private deliverMineral(creep: Creep): void {
    const terminal = creep.room.terminal;
    const storage = creep.room.storage;
    const target = terminal ?? storage;

    if (target) {
      const mineralType = Object.keys(creep.store).find(r => r !== RESOURCE_ENERGY) as ResourceConstant;

      if (creep.transfer(target, mineralType) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target);
      }
    }
  }
}
```

## CPU Profiling and Optimization

**Goal**: Keep CPU below 15 per tick with expanded operations

**Strategies**:

1. **Throttle expensive operations**: Run market analysis every 10 ticks
2. **Cache calculations**: Store lab recipes, market prices in Memory
3. **Early exit**: Skip managers when structures don't exist
4. **Batch operations**: Process multiple reactions per tick when possible

```typescript
// In BootstrapKernel or manager initialization
if (Game.time % 10 === 0) {
  this.marketManager.updatePriceHistory();
}

if (Game.time % 5 === 0) {
  this.marketManager.executeTrades();
}
```

## Evaluation Integration

Extend `SystemEvaluator` with economy metrics:

```typescript
// In SystemEvaluator.ts
if (snapshot.economyMetrics) {
  const { terminalBalance, marketCredits, mineralProduction } = snapshot.economyMetrics;

  if (terminalBalance < 20000 && rcl >= 6) {
    findings.push({
      severity: "warning",
      title: "Terminal energy reserves low",
      detail: `Terminal: ${terminalBalance}. Target: 20,000+.`,
      recommendation: "Increase energy production or reduce terminal usage."
    });
  }

  if (marketCredits < 0) {
    findings.push({
      severity: "info",
      title: "Market balance negative",
      detail: `Credits: ${marketCredits}. Review trading strategy.`,
      recommendation: "Sell excess resources or reduce purchases."
    });
  }
}
```

## Testing Strategy

```typescript
// tests/regression/phase3-economy.test.ts
describe("Phase 3: Advanced Economy", () => {
  it("should maintain terminal energy >20k", async () => {
    const results = await runSimulation({ duration: 5000, targetRCL: 6 });
    const avgEnergy = results.reduce((sum, r) => sum + r.terminalEnergy, 0) / results.length;
    expect(avgEnergy).toBeGreaterThan(20000);
  });

  it("should produce minerals continuously", async () => {
    const results = await runSimulation({ duration: 5000, targetRCL: 6 });
    const totalMinerals = results.reduce((sum, r) => sum + r.mineralProduction, 0);
    expect(totalMinerals).toBeGreaterThan(0);
  });
});
```

## Deployment Plan

- **Week 1-2**: Implement terminal and lab managers
- **Week 3**: Implement market manager and mineral harvesting
- **Week 4**: Add factory manager (if RCL 7)
- **Week 5**: CPU optimization and testing

## Success Validation

- ✅ All Phase 3 metrics achieved on PTR
- ✅ Market operations generate net positive credits over 10k ticks
- ✅ Lab production queue never empty when minerals available
- ✅ Terminal maintains energy reserves during inter-room transfers

## Next Phase

[Phase 4: Multi-Room Management](./04-multi-room.md)

## References

- [Architecture Alignment](../architecture.md#phase-3-managers)
- [Development Roadmap](../roadmap.md#phase-3-economy-expansion)
- [Phase 2: Core Framework](./02-core-framework.md)
