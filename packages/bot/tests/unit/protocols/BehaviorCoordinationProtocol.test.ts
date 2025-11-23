import { describe, it, expect, beforeEach } from "vitest";
import { BehaviorCoordinationProtocol } from "../../../src/runtime/protocols/BehaviorCoordinationProtocol";
import type { BehaviorSummary } from "../../../src/shared/contracts";

describe("BehaviorCoordinationProtocol", () => {
  let protocol: BehaviorCoordinationProtocol;

  beforeEach(() => {
    protocol = new BehaviorCoordinationProtocol();
  });

  it("should initially have no behavior summary", () => {
    expect(protocol.getBehaviorSummary()).toBeUndefined();
  });

  it("should store and retrieve behavior summary", () => {
    const summary: BehaviorSummary = {
      processedCreeps: 5,
      spawnedCreeps: ["harvester1", "upgrader1"],
      tasksExecuted: { harvest: 10, upgrade: 5, build: 3 }
    };

    protocol.setBehaviorSummary(summary);
    expect(protocol.getBehaviorSummary()).toEqual(summary);
  });

  it("should clear behavior summary", () => {
    const summary: BehaviorSummary = {
      processedCreeps: 5,
      spawnedCreeps: ["harvester1"],
      tasksExecuted: { harvest: 10 }
    };

    protocol.setBehaviorSummary(summary);
    protocol.clearBehaviorSummary();

    expect(protocol.getBehaviorSummary()).toBeUndefined();
  });

  it("should overwrite previous behavior summary", () => {
    const summary1: BehaviorSummary = {
      processedCreeps: 3,
      spawnedCreeps: ["creep1"],
      tasksExecuted: { harvest: 5 }
    };

    const summary2: BehaviorSummary = {
      processedCreeps: 7,
      spawnedCreeps: ["creep2", "creep3"],
      tasksExecuted: { upgrade: 10 }
    };

    protocol.setBehaviorSummary(summary1);
    protocol.setBehaviorSummary(summary2);

    expect(protocol.getBehaviorSummary()).toEqual(summary2);
  });
});
