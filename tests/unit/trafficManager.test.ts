import { describe, it, expect, beforeEach } from "vitest";
import { TrafficManager } from "@runtime/infrastructure/TrafficManager";

describe("TrafficManager", () => {
  beforeEach(() => {
    (global as { Game?: { time: number } }).Game = { time: 1000 };
  });

  it("should initialize without errors", () => {
    const manager = new TrafficManager();
    expect(manager).toBeDefined();
  });

  it("should register movement requests", () => {
    const manager = new TrafficManager();

    const destination = { roomName: "W1N1", x: 25, y: 25 } as RoomPosition;
    manager.requestMovement("creep1", destination, 50);

    const request = manager.getRequest("creep1");

    expect(request).toBeDefined();
    expect(request?.priority).toBe(50);
  });

  it("should clear movement requests", () => {
    const manager = new TrafficManager();

    const destination = { roomName: "W1N1", x: 25, y: 25 } as RoomPosition;
    manager.requestMovement("creep1", destination, 50);

    manager.clearRequest("creep1");

    const request = manager.getRequest("creep1");

    expect(request).toBeUndefined();
  });
});
