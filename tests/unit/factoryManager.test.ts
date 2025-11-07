import { describe, it, expect } from "vitest";
import { FactoryManager } from "@runtime/infrastructure/FactoryManager";

describe("FactoryManager", () => {
  it("should initialize without errors", () => {
    const manager = new FactoryManager();
    expect(manager).toBeDefined();
  });

  it("should return zero production when no factory exists", () => {
    const manager = new FactoryManager();

    const mockRoom = {
      name: "W1N1",
      controller: null,
      find: () => []
    };

    const result = manager.run(mockRoom as never);

    expect(result.productions).toBe(0);
    expect(result.commoditiesProduced).toBe(0);
  });
});
