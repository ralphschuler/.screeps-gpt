import { describe, it, expect, beforeEach } from "vitest";
import { BootstrapCoordinationProtocol } from "../../../src/runtime/protocols/BootstrapCoordinationProtocol";

describe("BootstrapCoordinationProtocol", () => {
  let protocol: BootstrapCoordinationProtocol;

  beforeEach(() => {
    protocol = new BootstrapCoordinationProtocol();
  });

  it("should initially have no bootstrap status", () => {
    expect(protocol.getBootstrapStatus()).toBeUndefined();
    expect(protocol.isBootstrapActive()).toBe(false);
  });

  it("should store and retrieve bootstrap status", () => {
    const status = { isActive: true, phase: "initial", progress: 50 };
    protocol.setBootstrapStatus(status);

    expect(protocol.getBootstrapStatus()).toEqual(status);
  });

  it("should detect active bootstrap", () => {
    protocol.setBootstrapStatus({ isActive: true });
    expect(protocol.isBootstrapActive()).toBe(true);

    protocol.setBootstrapStatus({ isActive: false });
    expect(protocol.isBootstrapActive()).toBe(false);
  });

  it("should return bootstrap minimums when active", () => {
    protocol.setBootstrapStatus({ isActive: true });

    const minimums = protocol.getBootstrapMinimums();
    expect(minimums).toEqual({
      harvester: 2,
      upgrader: 1,
      builder: 1
    });
  });

  it("should return empty minimums when inactive", () => {
    protocol.setBootstrapStatus({ isActive: false });

    const minimums = protocol.getBootstrapMinimums();
    expect(minimums).toEqual({});
  });

  it("should return empty minimums when status not set", () => {
    const minimums = protocol.getBootstrapMinimums();
    expect(minimums).toEqual({});
  });

  it("should clear bootstrap status", () => {
    protocol.setBootstrapStatus({ isActive: true, phase: "initial" });
    protocol.clearBootstrapStatus();

    expect(protocol.getBootstrapStatus()).toBeUndefined();
    expect(protocol.isBootstrapActive()).toBe(false);
  });
});
