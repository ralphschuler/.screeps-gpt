import { describe, expect, it, vi, beforeEach } from "vitest";
import { Kernel } from "@runtime/bootstrap/kernel";
import type { GameContext } from "@runtime/types/GameContext";
import type { InfrastructureMemory } from "@runtime/infrastructure/InfrastructureManager";

describe("Kernel InfrastructureManager Type Safety", () => {
  let mockGame: GameContext;
  let mockMemory: Memory;

  beforeEach(() => {
    mockGame = {
      time: 1000,
      cpu: {
        getUsed: vi.fn(() => 5),
        limit: 20,
        bucket: 1000
      },
      creeps: {},
      spawns: {},
      rooms: {}
    };

    // Initialize basic memory structure matching Memory interface
    mockMemory = {
      creeps: {},
      roles: {},
      stats: {
        time: 0,
        cpu: { used: 0, limit: 0, bucket: 0 },
        creeps: { count: 0 },
        rooms: { count: 0 }
      }
    } as Memory;
  });

  it("should initialize without infrastructure memory", () => {
    const kernel = new Kernel({
      logger: { log: vi.fn(), warn: vi.fn() }
    });

    expect(() => {
      kernel.run(mockGame, mockMemory);
    }).not.toThrow();
  });

  it("should initialize with valid infrastructure memory structure", () => {
    const infrastructureMemory: InfrastructureMemory = {
      traffic: {
        movementRequests: {},
        trafficData: {}
      },
      roadPlanning: {
        lastPlanned: { W1N1: 500 }
      },
      containerPlanning: {
        lastPlanned: { W1N1: 100 }
      }
    };

    mockMemory.infrastructure = infrastructureMemory;

    const kernel = new Kernel({
      logger: { log: vi.fn(), warn: vi.fn() }
    });

    expect(() => {
      kernel.run(mockGame, mockMemory);
    }).not.toThrow();
  });

  it("should handle partial infrastructure memory structure", () => {
    // Only traffic data, no planning data
    const partialInfrastructureMemory: InfrastructureMemory = {
      traffic: {
        movementRequests: {},
        trafficData: {
          "W1N1-25-25": { count: 5, lastUpdated: 1000 }
        }
      }
    };

    mockMemory.infrastructure = partialInfrastructureMemory;

    const kernel = new Kernel({
      logger: { log: vi.fn(), warn: vi.fn() }
    });

    expect(() => {
      kernel.run(mockGame, mockMemory);
    }).not.toThrow();
  });

  it("should preserve infrastructure memory across ticks", () => {
    const infrastructureMemory: InfrastructureMemory = {
      roadPlanning: {
        lastPlanned: { W1N1: 500 }
      }
    };

    mockMemory.infrastructure = infrastructureMemory;

    const kernel = new Kernel({
      logger: { log: vi.fn(), warn: vi.fn() }
    });

    // Run multiple ticks
    kernel.run(mockGame, mockMemory);
    mockGame.time = 1001;
    kernel.run(mockGame, mockMemory);

    // Memory should still exist and be valid
    expect(mockMemory.infrastructure).toBeDefined();
    expect(mockMemory.infrastructure?.roadPlanning).toBeDefined();
  });

  it("should not throw type errors with undefined Memory global", () => {
    // Use vitest's stubGlobal for safer global mocking
    vi.stubGlobal("Memory", undefined);

    try {
      const kernel = new Kernel({
        logger: { log: vi.fn(), warn: vi.fn() }
      });

      // Restore Memory before running
      vi.stubGlobal("Memory", mockMemory);

      expect(() => {
        kernel.run(mockGame, mockMemory);
      }).not.toThrow();
    } finally {
      // Always restore original state
      vi.unstubAllGlobals();
    }
  });

  it("should type-check infrastructure memory fields correctly", () => {
    // This test validates that TypeScript correctly infers the types
    const infrastructureMemory: InfrastructureMemory = {
      traffic: {
        movementRequests: {},
        trafficData: {
          "W1N1-25-25": { count: 10, lastUpdated: 1000 }
        }
      },
      roadPlanning: {
        lastPlanned: { W1N1: 900 }
      },
      containerPlanning: {
        lastPlanned: { W1N1: 800 }
      }
    };

    mockMemory.infrastructure = infrastructureMemory;

    const kernel = new Kernel({
      logger: { log: vi.fn(), warn: vi.fn() }
    });

    kernel.run(mockGame, mockMemory);

    // Type assertions to verify correct typing
    expect(mockMemory.infrastructure).toBeDefined();
    if (mockMemory.infrastructure) {
      expect(typeof mockMemory.infrastructure).toBe("object");
      if (mockMemory.infrastructure.traffic) {
        expect(typeof mockMemory.infrastructure.traffic.movementRequests).toBe("object");
      }
      if (mockMemory.infrastructure.roadPlanning) {
        expect(typeof mockMemory.infrastructure.roadPlanning.lastPlanned).toBe("object");
      }
    }
  });
});
