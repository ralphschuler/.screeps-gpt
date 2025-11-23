import { describe, it, expect, beforeEach } from "vitest";
import { StateCoordinationProtocol } from "../../../src/runtime/protocols/StateCoordinationProtocol";

describe("StateCoordinationProtocol", () => {
  let protocol: StateCoordinationProtocol;

  beforeEach(() => {
    protocol = new StateCoordinationProtocol();
  });

  describe("emergency reset", () => {
    it("should initially be false", () => {
      expect(protocol.isEmergencyReset()).toBe(false);
    });

    it("should set and get emergency reset flag", () => {
      protocol.setEmergencyReset(true);
      expect(protocol.isEmergencyReset()).toBe(true);

      protocol.setEmergencyReset(false);
      expect(protocol.isEmergencyReset()).toBe(false);
    });
  });

  describe("needs respawn", () => {
    it("should initially be false", () => {
      expect(protocol.needsRespawn()).toBe(false);
    });

    it("should set and get needs respawn flag", () => {
      protocol.setNeedsRespawn(true);
      expect(protocol.needsRespawn()).toBe(true);

      protocol.setNeedsRespawn(false);
      expect(protocol.needsRespawn()).toBe(false);
    });
  });

  describe("clearFlags", () => {
    it("should clear all flags", () => {
      protocol.setEmergencyReset(true);
      protocol.setNeedsRespawn(true);

      protocol.clearFlags();

      expect(protocol.isEmergencyReset()).toBe(false);
      expect(protocol.needsRespawn()).toBe(false);
    });
  });
});
