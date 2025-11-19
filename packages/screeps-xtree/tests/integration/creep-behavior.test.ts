import { describe, it, expect } from "vitest";
import { DecisionTreeBuilder, CreepConditions, type CreepDecisionContext, type CreepAction } from "../../src/index.js";

// Mock Screeps constants for testing
const TOP = 1 as DirectionConstant;

describe("Creep Behavior Decision Trees", () => {
  describe("Harvester behavior", () => {
    it("should decide to harvest when empty and energy available", () => {
      const builder = new DecisionTreeBuilder<CreepDecisionContext, CreepAction>();

      // Build harvester decision tree
      const tree = builder.build(
        builder.if(
          CreepConditions.isEmpty,
          builder.leaf({ type: "harvest", target: {} as Source }),
          builder.if(
            CreepConditions.hasConstructionSites,
            builder.leaf({ type: "build", target: {} as ConstructionSite }),
            builder.leaf({ type: "upgrade", target: {} as StructureController })
          )
        )
      );

      const mockContext: CreepDecisionContext = {
        creep: { store: { getUsedCapacity: () => 0 } } as Creep,
        room: {} as Room,
        energyAvailable: true,
        nearbyEnemies: false,
        constructionSites: 0,
        damagedStructures: 0
      };

      const action = tree.evaluate(mockContext);
      expect(action.type).toBe("harvest");
    });

    it("should decide to build when full and construction sites exist", () => {
      const builder = new DecisionTreeBuilder<CreepDecisionContext, CreepAction>();

      const tree = builder.build(
        builder.if(
          CreepConditions.isEmpty,
          builder.leaf({ type: "harvest", target: {} as Source }),
          builder.if(
            CreepConditions.hasConstructionSites,
            builder.leaf({ type: "build", target: {} as ConstructionSite }),
            builder.leaf({ type: "upgrade", target: {} as StructureController })
          )
        )
      );

      const mockContext: CreepDecisionContext = {
        creep: { store: { getUsedCapacity: () => 50 } } as Creep,
        room: {} as Room,
        energyAvailable: true,
        nearbyEnemies: false,
        constructionSites: 3,
        damagedStructures: 0
      };

      const action = tree.evaluate(mockContext);
      expect(action.type).toBe("build");
    });

    it("should decide to upgrade when full and no construction sites", () => {
      const builder = new DecisionTreeBuilder<CreepDecisionContext, CreepAction>();

      const tree = builder.build(
        builder.if(
          CreepConditions.isEmpty,
          builder.leaf({ type: "harvest", target: {} as Source }),
          builder.if(
            CreepConditions.hasConstructionSites,
            builder.leaf({ type: "build", target: {} as ConstructionSite }),
            builder.leaf({ type: "upgrade", target: {} as StructureController })
          )
        )
      );

      const mockContext: CreepDecisionContext = {
        creep: { store: { getUsedCapacity: () => 50 } } as Creep,
        room: {} as Room,
        energyAvailable: true,
        nearbyEnemies: false,
        constructionSites: 0,
        damagedStructures: 0
      };

      const action = tree.evaluate(mockContext);
      expect(action.type).toBe("upgrade");
    });
  });

  describe("Combat behavior", () => {
    it("should decide to flee when enemies nearby and damaged", () => {
      const builder = new DecisionTreeBuilder<CreepDecisionContext, CreepAction>();

      const tree = builder.build(
        builder.if(
          ctx => CreepConditions.enemiesNearby(ctx) && CreepConditions.isDamaged(ctx),
          builder.leaf({ type: "flee", direction: TOP }),
          builder.leaf({ type: "idle" })
        )
      );

      const mockContext: CreepDecisionContext = {
        creep: {
          store: { getUsedCapacity: () => 0 } as Store<Creep, false>,
          hits: 50,
          hitsMax: 100
        } as Creep,
        room: {} as Room,
        energyAvailable: true,
        nearbyEnemies: true,
        constructionSites: 0,
        damagedStructures: 0
      };

      const action = tree.evaluate(mockContext);
      expect(action.type).toBe("flee");
    });
  });

  describe("Multi-role switch behavior", () => {
    it("should use switch node for role-based decisions", () => {
      const builder = new DecisionTreeBuilder<CreepDecisionContext, CreepAction>();

      const tree = builder.build(
        builder.switch(
          [
            {
              condition: CreepConditions.enemiesNearby,
              node: builder.leaf({ type: "flee", direction: TOP })
            },
            {
              condition: ctx => CreepConditions.isEmpty(ctx) && CreepConditions.hasEnergySources(ctx),
              node: builder.leaf({ type: "harvest", target: {} as Source })
            },
            {
              condition: CreepConditions.hasRepairTargets,
              node: builder.leaf({ type: "repair", target: {} as Structure })
            },
            {
              condition: CreepConditions.hasConstructionSites,
              node: builder.leaf({ type: "build", target: {} as ConstructionSite })
            }
          ],
          builder.leaf({ type: "upgrade", target: {} as StructureController })
        )
      );

      // Test flee scenario
      const fleeContext: CreepDecisionContext = {
        creep: { store: { getUsedCapacity: () => 0 } } as Creep,
        room: {} as Room,
        energyAvailable: true,
        nearbyEnemies: true,
        constructionSites: 0,
        damagedStructures: 0
      };
      expect(tree.evaluate(fleeContext).type).toBe("flee");

      // Test harvest scenario
      const harvestContext: CreepDecisionContext = {
        creep: { store: { getUsedCapacity: () => 0 } } as Creep,
        room: {} as Room,
        energyAvailable: true,
        nearbyEnemies: false,
        constructionSites: 0,
        damagedStructures: 0
      };
      expect(tree.evaluate(harvestContext).type).toBe("harvest");

      // Test repair scenario
      const repairContext: CreepDecisionContext = {
        creep: { store: { getUsedCapacity: () => 50 } } as Creep,
        room: {} as Room,
        energyAvailable: true,
        nearbyEnemies: false,
        constructionSites: 0,
        damagedStructures: 5
      };
      expect(tree.evaluate(repairContext).type).toBe("repair");

      // Test default upgrade scenario
      const upgradeContext: CreepDecisionContext = {
        creep: { store: { getUsedCapacity: () => 50 } } as Creep,
        room: {} as Room,
        energyAvailable: true,
        nearbyEnemies: false,
        constructionSites: 0,
        damagedStructures: 0
      };
      expect(tree.evaluate(upgradeContext).type).toBe("upgrade");
    });
  });
});
