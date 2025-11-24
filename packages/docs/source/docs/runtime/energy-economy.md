# Energy Economy Validation

## Overview

The energy economy validation system ensures sustainable creep population growth by validating energy production, consumption, and storage capacity before spawning larger, more expensive creeps. This prevents energy economy collapse from over-spawning and enables graceful degradation in constrained scenarios.

## Architecture

### Core Components

#### EnergyBalanceCalculator
**Location:** `src/runtime/behavior/EnergyBalanceCalculator.ts`

Calculates energy production and consumption metrics for a room:
- **Production Rate**: Energy generated per tick from sources
- **Consumption Rate**: Energy consumed per tick for spawning
- **Sustainability Ratio**: Production / Consumption
- **Max Spawn Budget**: Recommended maximum spawn cost per creep

**Key Features:**
- Harvester efficiency calculation based on source coverage
- Conservative consumption estimation (active spawning + average creep cost)
- Minimum spawn budget floor of 200 energy

#### EnergyValidator
**Location:** `src/runtime/energy/EnergyValidation.ts`

Provides validation checks and visual feedback for energy sustainability:
- **Energy Economy Assessment**: Tracks metrics in Memory
- **Spawn Validation**: Checks energy surplus and reserve requirements
- **Visual Feedback**: Renders sustainability status in room visuals

#### BodyComposer
**Location:** `src/runtime/behavior/BodyComposer.ts`

Generates adaptive creep body compositions based on sustainable energy capacity:
- Uses `calculateSustainableCapacity()` to adjust spawn budgets
- Applies energy balance calculations to prevent over-spawning
- Implements graceful degradation for low-energy scenarios

### Integration Points

1. **RoleControllerManager**: Uses BodyComposer for dynamic body generation
2. **BodyComposer**: Leverages EnergyBalanceCalculator for sustainable capacity
3. **EnergyValidator**: Provides explicit validation and visual feedback

## Energy Validation Logic

### Spawn Validation Criteria

Before spawning larger creeps, the system validates:

#### 1. Energy Surplus Requirement
```typescript
sustainabilityRatio >= 1.2  // 20% energy surplus required
```

**Rationale:** Ensures production exceeds consumption by at least 20% to maintain reserves and handle fluctuations.

#### 2. Reserve Buffer Requirement
```typescript
currentReserves >= spawnCost * 2  // 2x spawn cost in reserves
```

**Rationale:** Ensures sufficient energy reserves to cover spawn cost plus buffer for ongoing operations.

### Adaptive Capacity Calculation

The `BodyComposer.calculateSustainableCapacity()` method adjusts spawn budgets based on energy balance:

```typescript
if (ratio >= 1.5) {
  // Excellent surplus: Allow full capacity
  return baseCapacity;
} else if (ratio >= 1.2) {
  // Good surplus: Allow 80% capacity with safety margin
  return Math.min(baseCapacity, maxSpawnBudget * 1.2);
} else if (ratio >= 1.0) {
  // Neutral balance: Use calculated sustainable budget
  return Math.min(baseCapacity, maxSpawnBudget);
} else {
  // Energy deficit: Reduce to 80% of sustainable to recover
  return Math.min(baseCapacity, maxSpawnBudget * 0.8);
}
```

## Memory Tracking

### Energy Metrics Storage

Energy economy metrics are stored in room memory for tracking and visibility:

```typescript
Memory.rooms[roomName].energyMetrics = {
  productionRate: 20,           // Energy/tick from sources
  consumptionRate: 2,            // Energy/tick for upkeep
  storageCapacity: 1300,         // Total energy capacity
  currentReserves: 800,          // Available energy
  sustainabilityRatio: 10.0,     // Production/consumption
  lastUpdate: 12345,             // Game tick
  sourceCount: 2,                // Number of sources
  maxSpawnBudget: 400            // Recommended max spawn cost
};
```

### Memory Schema

```typescript
interface Memory {
  rooms?: Record<string, {
    energyMetrics?: {
      productionRate: number;
      consumptionRate: number;
      storageCapacity: number;
      currentReserves: number;
      sustainabilityRatio: number;
      lastUpdate: number;
      sourceCount: number;
      maxSpawnBudget: number;
    };
  }>;
}
```

## Visual Feedback

### Room Visuals

The `EnergyValidator.renderEnergyStatus()` method displays energy economy status in room visuals:

```
✅ Energy: 1.50x
↑20.0/t ↓2.0/t
```

### Status Indicators

| Emoji | Ratio | Status |
|-------|-------|--------|
| ✅ | ≥1.5x | Excellent - Allow full capacity spawning |
| 🟢 | ≥1.2x | Good - Allow 80% capacity spawning |
| 🟡 | ≥1.0x | Neutral - Use sustainable budget |
| 🟠 | ≥0.8x | Warning - Reduce spawn budget |
| ⚠️ | <0.8x | Critical - Significant energy deficit |

## Usage Examples

### Validate Before Spawning

```typescript
import { EnergyValidator } from "@runtime/energy";

const validator = new EnergyValidator();

// Check if room can afford a large creep
const spawnCost = 800;
const result = validator.validateSpawn(room, spawnCost);

if (result.allowed) {
  // Spawn the creep
  spawn.spawnCreep(body, name, { memory: creepMemory });
} else {
  // Spawn a smaller creep instead
  console.log(`Cannot spawn ${spawnCost} cost creep: ${result.reason}`);
  const smallerBody = generateCreepBody(role, result.maxCost);
  spawn.spawnCreep(smallerBody, name, { memory: creepMemory });
}
```

### Render Energy Status

```typescript
import { EnergyValidator } from "@runtime/energy";

const validator = new EnergyValidator();

// Render energy status in room visuals
validator.renderEnergyStatus(room);

// Or with custom position
validator.renderEnergyStatus(room, { x: 5, y: 10 });
```

### Check Energy Economy

```typescript
import { EnergyValidator } from "@runtime/energy";

const validator = new EnergyValidator();

// Get detailed energy metrics
const metrics = validator.assessEnergyEconomy(room);

console.log(`Production: ${metrics.productionRate}/tick`);
console.log(`Consumption: ${metrics.consumptionRate}/tick`);
console.log(`Ratio: ${metrics.sustainabilityRatio.toFixed(2)}x`);
console.log(`Max Spawn Budget: ${metrics.maxSpawnBudget}`);
```

## Configuration

### Thresholds

Default validation thresholds (defined in `EnergyValidator`):

```typescript
energySurplusThreshold = 1.2;        // 20% surplus required
reserveBufferMultiplier = 2;         // 2x spawn cost in reserves
```

### Energy Balance Calculator

Default parameters (defined in `EnergyBalanceCalculator`):

```typescript
ENERGY_PER_SOURCE_TICK = 10;         // Source energy regeneration
TARGET_SURPLUS_RATIO = 0.8;          // 80% of production for sustainability
MIN_HARVESTER_EFFICIENCY = 0.5;      // Minimum efficiency floor
```

## Testing

### Unit Tests

**Location:** `tests/unit/energyValidation.test.ts`

Tests cover:
- Energy economy assessment with various source/harvester configurations
- Spawn validation with surplus and reserve checks
- Visual rendering with different energy states
- Memory tracking and updates
- Edge cases (no sources, no creeps)

### Running Tests

```bash
yarn test:unit
yarn vitest run packages/bot/tests/unit/energyValidation.test.ts
```

## Best Practices

### 1. Early Game Bootstrap

During bootstrap (< 5 creeps), the system:
- Allows full capacity spawning for rapid growth
- Bypasses sustainable capacity limits
- Enables larger, more efficient initial creeps

### 2. Stable Operation

With 5+ creeps, the system:
- Enforces sustainable capacity limits
- Balances production with consumption
- Prevents energy economy collapse

### 3. Energy-Constrained Scenarios

When energy is limited:
- Spawn smaller, more affordable creeps
- Prioritize essential roles (harvesters first)
- Wait for energy accumulation before spawning expensive creeps

### 4. Visual Monitoring

Enable room visuals to monitor energy economy in real-time:
- Check sustainability ratio regularly
- Watch for ⚠️ or 🟠 indicators
- Adjust spawn strategies based on visual feedback

## Future Enhancements

Potential improvements for the energy economy system:

1. **Dynamic Threshold Adjustment**: Adapt surplus requirements based on RCL
2. **Role-Specific Budgets**: Different validation thresholds per role
3. **Historical Trend Analysis**: Track energy balance over time
4. **Predictive Spawning**: Forecast energy needs for planned creeps
5. **Multi-Room Coordination**: Share energy economy data across rooms

## Related Systems

- **Bootstrap Phase Manager**: Detects early game for relaxed validation
- **Role Controller Manager**: Integrates energy validation into spawn flow
- **Body Composer**: Uses sustainable capacity for adaptive sizing
- **Health Monitoring**: Energy economy impacts room health scores

## References

- [Energy Balance Calculator](../src/runtime/behavior/EnergyBalanceCalculator.ts)
- [Energy Validator](../src/runtime/energy/EnergyValidation.ts)
- [Body Composer](../src/runtime/behavior/BodyComposer.ts)
- [Role Controller Manager](../src/runtime/behavior/RoleControllerManager.ts)
- [Memory Management](./memory-management.md)
- [Role Balancing](./role-balancing.md)
