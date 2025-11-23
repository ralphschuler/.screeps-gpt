import { describe, it, expect, beforeEach } from "vitest";
import { RoleManagementProtocol } from "../../../src/runtime/protocols/RoleManagementProtocol";

describe("RoleManagementProtocol", () => {
  let protocol: RoleManagementProtocol;

  beforeEach(() => {
    protocol = new RoleManagementProtocol();
  });

  it("should initially have no role counts", () => {
    expect(protocol.getRoleCounts()).toEqual({});
  });

  it("should store and retrieve role counts", () => {
    const counts = { harvester: 3, upgrader: 2, builder: 1 };
    protocol.setRoleCounts(counts);

    expect(protocol.getRoleCounts()).toEqual(counts);
  });

  it("should get count for specific role", () => {
    protocol.setRoleCounts({ harvester: 5, upgrader: 3 });

    expect(protocol.getRoleCount("harvester")).toBe(5);
    expect(protocol.getRoleCount("upgrader")).toBe(3);
  });

  it("should return 0 for unknown role", () => {
    protocol.setRoleCounts({ harvester: 3 });

    expect(protocol.getRoleCount("unknown")).toBe(0);
  });

  it("should clear role counts", () => {
    protocol.setRoleCounts({ harvester: 3, upgrader: 2 });
    protocol.clearRoleCounts();

    expect(protocol.getRoleCounts()).toEqual({});
  });

  it("should return copy of role counts", () => {
    const counts = { harvester: 3 };
    protocol.setRoleCounts(counts);

    const retrieved = protocol.getRoleCounts();
    retrieved.harvester = 999;

    // Original should not be modified
    expect(protocol.getRoleCounts()).toEqual({ harvester: 3 });
  });
});
