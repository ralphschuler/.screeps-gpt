import { describe, it, expect, beforeEach } from "vitest";
import { CombatManager } from "@runtime/defense/CombatManager";

describe("CombatManager", () => {
  beforeEach(() => {
    (global as { Game?: { time: number } }).Game = { time: 1000 };
  });

  it("should initialize without errors", () => {
    const manager = new CombatManager();
    expect(manager).toBeDefined();
  });

  it("should create squads with unique IDs", () => {
    const manager = new CombatManager();

    const squadId1 = manager.createSquad(["soldier1"], "defense");
    const squadId2 = manager.createSquad(["soldier2"], "offense");

    expect(squadId1).toBeDefined();
    expect(squadId2).toBeDefined();
    expect(squadId1).not.toBe(squadId2);
  });

  it("should activate squads", () => {
    const manager = new CombatManager();

    const squadId = manager.createSquad(["soldier1"], "defense");
    manager.activateSquad(squadId);

    expect(squadId).toBeDefined();
  });

  it("should disband squads", () => {
    const manager = new CombatManager();

    const squadId = manager.createSquad(["soldier1"], "defense");
    manager.disbandSquad(squadId);

    expect(squadId).toBeDefined();
  });
});
