import { describe, it, expect, vi } from "vitest";

// Mock Screeps globals before importing the module
const mockGame = {
  time: 0,
  creeps: {} as Record<string, unknown>
};

const mockMemory = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pathOptimizer: undefined as any,
  screepsPerf: undefined as { lastMemoryCleanUp: number } | undefined,
  creeps: {} as Record<string, unknown>
};

const mockPathSteps: PathStep[] = [{ x: 1, y: 1, dx: 0, dy: 1, direction: 5 }];

// Setup global mocks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).Game = mockGame;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).Memory = mockMemory;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).StructureSpawn = {
  prototype: {
    createCreep: vi.fn()
  }
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).Room = {
  prototype: {
    findPath: vi.fn().mockReturnValue(mockPathSteps)
  },
  serializePath: vi.fn((_path: PathStep[]) => "serialized"),
  deserializePath: vi.fn((_str: string) => mockPathSteps)
};

// Now import the module after mocks are setup
import { setupPerformanceOptimizations } from "../src/index";

describe("setupPerformanceOptimizations", () => {
  it("should return a PerformanceModule with originalFindPath", () => {
    const result = setupPerformanceOptimizations();

    expect(result).toHaveProperty("originalFindPath");
    expect(typeof result.originalFindPath).toBe("function");
  });

  it("should work with default options", () => {
    // Just verify it doesn't throw
    expect(() => setupPerformanceOptimizations()).not.toThrow();
  });

  it("should work with explicit options", () => {
    // Verify it doesn't throw with all options
    expect(() =>
      setupPerformanceOptimizations({
        speedUpArrayFunctions: true,
        cleanUpCreepMemory: true,
        optimizePathFinding: true
      })
    ).not.toThrow();
  });

  it("should work with disabled options", () => {
    // Verify it doesn't throw with all options disabled
    expect(() =>
      setupPerformanceOptimizations({
        speedUpArrayFunctions: false,
        cleanUpCreepMemory: false,
        optimizePathFinding: false
      })
    ).not.toThrow();
  });
});
