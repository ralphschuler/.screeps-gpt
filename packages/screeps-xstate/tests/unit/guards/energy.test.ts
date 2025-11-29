import { describe, it, expect, beforeEach, vi } from "vitest";
import { hasEnergy, isFull, isEmpty, hasFreeCapacity, hasCapacityPercent } from "../../../src/guards/energy.js";
import type { CreepContext } from "../../../src/guards/types.js";

describe("Energy Guards", () => {
  let mockCreep: Partial<Creep>;
  let ctx: CreepContext;

  beforeEach(() => {
    mockCreep = {
      store: {
        getUsedCapacity: vi.fn(),
        getFreeCapacity: vi.fn(),
        getCapacity: vi.fn()
      } as unknown as Store<Creep, false>
    };
    ctx = { creep: mockCreep as Creep };
  });

  describe("hasEnergy", () => {
    it("returns true when creep has energy above threshold", () => {
      (mockCreep.store!.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(50);
      const guard = hasEnergy(10);
      expect(guard(ctx)).toBe(true);
    });

    it("returns false when creep has energy at or below threshold", () => {
      (mockCreep.store!.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(10);
      const guard = hasEnergy(10);
      expect(guard(ctx)).toBe(false);
    });

    it("returns true when creep has any energy (default threshold 0)", () => {
      (mockCreep.store!.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(1);
      const guard = hasEnergy();
      expect(guard(ctx)).toBe(true);
    });

    it("returns false when creep has no energy (default threshold 0)", () => {
      (mockCreep.store!.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(0);
      const guard = hasEnergy();
      expect(guard(ctx)).toBe(false);
    });
  });

  describe("isFull", () => {
    it("returns true when creep has no free capacity", () => {
      (mockCreep.store!.getFreeCapacity as ReturnType<typeof vi.fn>).mockReturnValue(0);
      expect(isFull(ctx)).toBe(true);
    });

    it("returns false when creep has free capacity", () => {
      (mockCreep.store!.getFreeCapacity as ReturnType<typeof vi.fn>).mockReturnValue(50);
      expect(isFull(ctx)).toBe(false);
    });
  });

  describe("isEmpty", () => {
    it("returns true when creep has no energy", () => {
      (mockCreep.store!.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(0);
      expect(isEmpty(ctx)).toBe(true);
    });

    it("returns false when creep has energy", () => {
      (mockCreep.store!.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(50);
      expect(isEmpty(ctx)).toBe(false);
    });
  });

  describe("hasFreeCapacity", () => {
    it("returns true when creep has free capacity", () => {
      (mockCreep.store!.getFreeCapacity as ReturnType<typeof vi.fn>).mockReturnValue(50);
      expect(hasFreeCapacity(ctx)).toBe(true);
    });

    it("returns false when creep has no free capacity", () => {
      (mockCreep.store!.getFreeCapacity as ReturnType<typeof vi.fn>).mockReturnValue(0);
      expect(hasFreeCapacity(ctx)).toBe(false);
    });
  });

  describe("hasCapacityPercent", () => {
    it("returns true when creep is at least at specified percentage", () => {
      (mockCreep.store!.getCapacity as ReturnType<typeof vi.fn>).mockReturnValue(100);
      (mockCreep.store!.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(75);
      const guard = hasCapacityPercent(50);
      expect(guard(ctx)).toBe(true);
    });

    it("returns false when creep is below specified percentage", () => {
      (mockCreep.store!.getCapacity as ReturnType<typeof vi.fn>).mockReturnValue(100);
      (mockCreep.store!.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(25);
      const guard = hasCapacityPercent(50);
      expect(guard(ctx)).toBe(false);
    });

    it("returns true when creep is exactly at percentage threshold", () => {
      (mockCreep.store!.getCapacity as ReturnType<typeof vi.fn>).mockReturnValue(100);
      (mockCreep.store!.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(50);
      const guard = hasCapacityPercent(50);
      expect(guard(ctx)).toBe(true);
    });

    it("returns false when capacity is zero", () => {
      (mockCreep.store!.getCapacity as ReturnType<typeof vi.fn>).mockReturnValue(0);
      (mockCreep.store!.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(0);
      const guard = hasCapacityPercent(50);
      expect(guard(ctx)).toBe(false);
    });

    it("returns false when capacity is null", () => {
      (mockCreep.store!.getCapacity as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (mockCreep.store!.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(0);
      const guard = hasCapacityPercent(50);
      expect(guard(ctx)).toBe(false);
    });
  });
});
