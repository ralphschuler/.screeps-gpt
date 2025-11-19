import { describe, it, expect } from "vitest";
import { LabManager } from "@runtime/infrastructure/LabManager";

describe("LabManager", () => {
  it("should initialize without errors", () => {
    const manager = new LabManager();
    expect(manager).toBeDefined();
  });

  it("should return idle state when no labs exist", () => {
    const manager = new LabManager();

    const mockRoom = {
      name: "W1N1",
      controller: null,
      find: () => []
    };

    const result = manager.run(mockRoom as never);

    expect(result.reactions).toBe(0);
    expect(result.boosts).toBe(0);
    expect(result.state).toBe("idle");
  });

  it("should require at least 3 labs for production", () => {
    const manager = new LabManager();

    const mockRoom = {
      name: "W1N1",
      controller: null,
      find: () => [{ id: "lab1" as Id<StructureLab> }, { id: "lab2" as Id<StructureLab> }]
    };

    const result = manager.run(mockRoom as never);

    expect(result.reactions).toBe(0);
    expect(result.state).toBe("idle");
  });
});
