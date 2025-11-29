import { describe, it, expect, beforeEach, vi } from "vitest";
import { isNearTarget, isAtTarget, hasTarget, isInRoom, isNearExit, isAtExit } from "../../../src/guards/position.js";
import type { CreepContext } from "../../../src/guards/types.js";

describe("Position Guards", () => {
  let mockCreep: Partial<Creep>;
  let mockTarget: Partial<RoomObject>;
  let ctx: CreepContext;

  beforeEach(() => {
    mockCreep = {
      pos: {
        getRangeTo: vi.fn(),
        isEqualTo: vi.fn(),
        x: 25,
        y: 25
      } as unknown as RoomPosition,
      room: {
        name: "W1N1"
      } as Room
    };
    mockTarget = {
      pos: {
        x: 30,
        y: 30
      } as RoomPosition
    };
    ctx = { creep: mockCreep as Creep, target: mockTarget as RoomObject };
  });

  describe("isNearTarget", () => {
    it("returns true when creep is within range of target", () => {
      (mockCreep.pos!.getRangeTo as ReturnType<typeof vi.fn>).mockReturnValue(1);
      const guard = isNearTarget(3);
      expect(guard(ctx)).toBe(true);
    });

    it("returns false when creep is outside range of target", () => {
      (mockCreep.pos!.getRangeTo as ReturnType<typeof vi.fn>).mockReturnValue(5);
      const guard = isNearTarget(3);
      expect(guard(ctx)).toBe(false);
    });

    it("returns true when creep is exactly at range", () => {
      (mockCreep.pos!.getRangeTo as ReturnType<typeof vi.fn>).mockReturnValue(3);
      const guard = isNearTarget(3);
      expect(guard(ctx)).toBe(true);
    });

    it("returns false when target is null", () => {
      ctx.target = null;
      const guard = isNearTarget(3);
      expect(guard(ctx)).toBe(false);
    });

    it("returns false when target is undefined", () => {
      ctx.target = undefined;
      const guard = isNearTarget(3);
      expect(guard(ctx)).toBe(false);
    });

    it("uses default range of 1", () => {
      (mockCreep.pos!.getRangeTo as ReturnType<typeof vi.fn>).mockReturnValue(1);
      const guard = isNearTarget();
      expect(guard(ctx)).toBe(true);
    });

    it("handles RoomPosition as target", () => {
      const roomPos = { x: 35, y: 35 } as RoomPosition;
      ctx.target = roomPos;
      (mockCreep.pos!.getRangeTo as ReturnType<typeof vi.fn>).mockReturnValue(2);
      const guard = isNearTarget(3);
      expect(guard(ctx)).toBe(true);
    });
  });

  describe("isAtTarget", () => {
    it("returns true when creep is at target position", () => {
      (mockCreep.pos!.isEqualTo as ReturnType<typeof vi.fn>).mockReturnValue(true);
      expect(isAtTarget(ctx)).toBe(true);
    });

    it("returns false when creep is not at target position", () => {
      (mockCreep.pos!.isEqualTo as ReturnType<typeof vi.fn>).mockReturnValue(false);
      expect(isAtTarget(ctx)).toBe(false);
    });

    it("returns false when target is null", () => {
      ctx.target = null;
      expect(isAtTarget(ctx)).toBe(false);
    });

    it("returns false when target is undefined", () => {
      ctx.target = undefined;
      expect(isAtTarget(ctx)).toBe(false);
    });
  });

  describe("hasTarget", () => {
    it("returns true when target is defined", () => {
      expect(hasTarget(ctx)).toBe(true);
    });

    it("returns false when target is null", () => {
      ctx.target = null;
      expect(hasTarget(ctx)).toBe(false);
    });

    it("returns false when target is undefined", () => {
      ctx.target = undefined;
      expect(hasTarget(ctx)).toBe(false);
    });
  });

  describe("isInRoom", () => {
    it("returns true when creep is in specified room", () => {
      const guard = isInRoom("W1N1");
      expect(guard(ctx)).toBe(true);
    });

    it("returns false when creep is in different room", () => {
      const guard = isInRoom("W2N2");
      expect(guard(ctx)).toBe(false);
    });
  });

  describe("isNearExit", () => {
    it("returns true when creep is near left edge", () => {
      mockCreep.pos = { x: 1, y: 25 } as RoomPosition;
      expect(isNearExit(ctx)).toBe(true);
    });

    it("returns true when creep is near right edge", () => {
      mockCreep.pos = { x: 48, y: 25 } as RoomPosition;
      expect(isNearExit(ctx)).toBe(true);
    });

    it("returns true when creep is near top edge", () => {
      mockCreep.pos = { x: 25, y: 1 } as RoomPosition;
      expect(isNearExit(ctx)).toBe(true);
    });

    it("returns true when creep is near bottom edge", () => {
      mockCreep.pos = { x: 25, y: 48 } as RoomPosition;
      expect(isNearExit(ctx)).toBe(true);
    });

    it("returns false when creep is far from edges", () => {
      mockCreep.pos = { x: 25, y: 25 } as RoomPosition;
      expect(isNearExit(ctx)).toBe(false);
    });

    it("returns true at x=2 (boundary)", () => {
      mockCreep.pos = { x: 2, y: 25 } as RoomPosition;
      expect(isNearExit(ctx)).toBe(true);
    });

    it("returns true at x=47 (boundary)", () => {
      mockCreep.pos = { x: 47, y: 25 } as RoomPosition;
      expect(isNearExit(ctx)).toBe(true);
    });
  });

  describe("isAtExit", () => {
    it("returns true when creep is at left edge", () => {
      mockCreep.pos = { x: 0, y: 25 } as RoomPosition;
      expect(isAtExit(ctx)).toBe(true);
    });

    it("returns true when creep is at right edge", () => {
      mockCreep.pos = { x: 49, y: 25 } as RoomPosition;
      expect(isAtExit(ctx)).toBe(true);
    });

    it("returns true when creep is at top edge", () => {
      mockCreep.pos = { x: 25, y: 0 } as RoomPosition;
      expect(isAtExit(ctx)).toBe(true);
    });

    it("returns true when creep is at bottom edge", () => {
      mockCreep.pos = { x: 25, y: 49 } as RoomPosition;
      expect(isAtExit(ctx)).toBe(true);
    });

    it("returns false when creep is not at edge", () => {
      mockCreep.pos = { x: 25, y: 25 } as RoomPosition;
      expect(isAtExit(ctx)).toBe(false);
    });

    it("returns false when creep is one tile from edge", () => {
      mockCreep.pos = { x: 1, y: 25 } as RoomPosition;
      expect(isAtExit(ctx)).toBe(false);
    });
  });
});
