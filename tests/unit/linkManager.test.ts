import { describe, it, expect } from "vitest";
import { LinkManager } from "@runtime/infrastructure/LinkManager";

describe("LinkManager", () => {
  it("should initialize without errors", () => {
    const manager = new LinkManager();
    expect(manager).toBeDefined();
  });

  it("should return zero transfers when no links exist", () => {
    const manager = new LinkManager();

    const mockRoom = {
      name: "W1N1",
      controller: null,
      find: () => []
    };

    const result = manager.run(mockRoom as never);

    expect(result.transfers).toBe(0);
    expect(result.energyMoved).toBe(0);
  });
});
