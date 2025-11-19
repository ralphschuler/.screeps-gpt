import { describe, it, expect, beforeEach } from "vitest";
import { optimizeArrayMethods } from "../src/ArrayOptimizer";

describe("ArrayOptimizer", () => {
  // Store original methods
  const originalFilter = Array.prototype.filter;
  const originalForEach = Array.prototype.forEach;
  const originalMap = Array.prototype.map;

  beforeEach(() => {
    // Reset to original methods before each test
    Array.prototype.filter = originalFilter;
    Array.prototype.forEach = originalForEach;
    Array.prototype.map = originalMap;
  });

  describe("optimizeArrayMethods", () => {
    it("should replace Array.prototype.filter", () => {
      const beforeFilter = Array.prototype.filter;
      optimizeArrayMethods();
      const afterFilter = Array.prototype.filter;

      expect(afterFilter).not.toBe(beforeFilter);
    });

    it("should replace Array.prototype.forEach", () => {
      const beforeForEach = Array.prototype.forEach;
      optimizeArrayMethods();
      const afterForEach = Array.prototype.forEach;

      expect(afterForEach).not.toBe(beforeForEach);
    });

    it("should replace Array.prototype.map", () => {
      const beforeMap = Array.prototype.map;
      optimizeArrayMethods();
      const afterMap = Array.prototype.map;

      expect(afterMap).not.toBe(beforeMap);
    });
  });

  describe("optimized filter", () => {
    beforeEach(() => {
      optimizeArrayMethods();
    });

    it("should filter array correctly", () => {
      const arr = [1, 2, 3, 4, 5];
      const result = arr.filter(x => x > 2);

      expect(result).toEqual([3, 4, 5]);
    });

    it("should work with empty arrays", () => {
      const arr: number[] = [];
      const result = arr.filter(x => x > 0);

      expect(result).toEqual([]);
    });

    it("should preserve thisArg context", () => {
      const arr = [1, 2, 3];
      const context = { threshold: 2 };

      const result = arr.filter(function (x) {
        return x > (this as typeof context).threshold;
      }, context);

      expect(result).toEqual([3]);
    });

    it("should pass correct parameters to callback", () => {
      const arr = ["a", "b", "c"];
      const calls: Array<[string, number, string[]]> = [];

      arr.filter((value, index, array) => {
        calls.push([value, index, array]);
        return true;
      });

      expect(calls).toEqual([
        ["a", 0, arr],
        ["b", 1, arr],
        ["c", 2, arr]
      ]);
    });
  });

  describe("optimized forEach", () => {
    beforeEach(() => {
      optimizeArrayMethods();
    });

    it("should iterate over all elements", () => {
      const arr = [1, 2, 3];
      const result: number[] = [];

      arr.forEach(x => result.push(x * 2));

      expect(result).toEqual([2, 4, 6]);
    });

    it("should work with empty arrays", () => {
      const arr: number[] = [];
      let count = 0;

      arr.forEach(() => count++);

      expect(count).toBe(0);
    });

    it("should preserve thisArg context", () => {
      const arr = [1, 2, 3];
      const context = { sum: 0 };

      arr.forEach(function (x) {
        (this as typeof context).sum += x;
      }, context);

      expect(context.sum).toBe(6);
    });

    it("should pass correct parameters to callback", () => {
      const arr = ["a", "b", "c"];
      const calls: Array<[string, number, string[]]> = [];

      arr.forEach((value, index, array) => {
        calls.push([value, index, array]);
      });

      expect(calls).toEqual([
        ["a", 0, arr],
        ["b", 1, arr],
        ["c", 2, arr]
      ]);
    });
  });

  describe("optimized map", () => {
    beforeEach(() => {
      optimizeArrayMethods();
    });

    it("should map array correctly", () => {
      const arr = [1, 2, 3];
      const result = arr.map(x => x * 2);

      expect(result).toEqual([2, 4, 6]);
    });

    it("should work with empty arrays", () => {
      const arr: number[] = [];
      const result = arr.map(x => x * 2);

      expect(result).toEqual([]);
    });

    it("should preserve thisArg context", () => {
      const arr = [1, 2, 3];
      const context = { multiplier: 3 };

      const result = arr.map(function (x) {
        return x * (this as typeof context).multiplier;
      }, context);

      expect(result).toEqual([3, 6, 9]);
    });

    it("should pass correct parameters to callback", () => {
      const arr = ["a", "b", "c"];
      const calls: Array<[string, number, string[]]> = [];

      arr.map((value, index, array) => {
        calls.push([value, index, array]);
        return value.toUpperCase();
      });

      expect(calls).toEqual([
        ["a", 0, arr],
        ["b", 1, arr],
        ["c", 2, arr]
      ]);
    });

    it("should handle type transformations", () => {
      const arr = [1, 2, 3];
      const result = arr.map(x => x.toString());

      expect(result).toEqual(["1", "2", "3"]);
    });
  });
});
