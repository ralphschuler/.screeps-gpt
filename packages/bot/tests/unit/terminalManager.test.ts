import { describe, it, expect } from "vitest";
import { TerminalManager } from "@runtime/infrastructure/TerminalManager";

describe("TerminalManager", () => {
  it("should initialize with default config", () => {
    const manager = new TerminalManager();
    expect(manager).toBeDefined();
  });

  it("should initialize with custom config", () => {
    const manager = new TerminalManager({
      energyReserve: 30000,
      minTransferAmount: 2000
    });
    expect(manager).toBeDefined();
  });

  it("should return zero transfers when no terminal exists", () => {
    const manager = new TerminalManager();

    const mockRoom = {
      name: "W1N1",
      controller: null,
      find: () => []
    };

    const result = manager.run(mockRoom as never);

    expect(result.transfers).toBe(0);
    expect(result.energyBalanced).toBe(false);
    expect(result.resourcesSent).toBe(0);
  });
});
