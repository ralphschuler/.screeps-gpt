/**
 * Weighted Selection Tests
 */
import { describe, it, expect } from "vitest";
import {
  weightedSelection,
  selectTopN,
  normalizeWeights,
  scaleWeights,
  getHighest,
  getLowest,
  filterByMinWeight,
  fromRecord,
  toRecord,
  type WeightedEntry
} from "../src/utils/weightedSelection";

describe("Weighted Selection", () => {
  describe("weightedSelection", () => {
    it("should return undefined for empty array", () => {
      expect(weightedSelection([])).toBeUndefined();
    });

    it("should return undefined for all zero weights", () => {
      const entries: WeightedEntry<string>[] = [
        { key: "a", weight: 0 },
        { key: "b", weight: 0 }
      ];
      expect(weightedSelection(entries)).toBeUndefined();
    });

    it("should return undefined for all negative weights", () => {
      const entries: WeightedEntry<string>[] = [
        { key: "a", weight: -5 },
        { key: "b", weight: -10 }
      ];
      expect(weightedSelection(entries)).toBeUndefined();
    });

    it("should return the only valid entry", () => {
      const entries: WeightedEntry<string>[] = [
        { key: "a", weight: 10 },
        { key: "b", weight: 0 }
      ];
      expect(weightedSelection(entries)).toBe("a");
    });

    it("should select from valid entries", () => {
      const entries: WeightedEntry<string>[] = [
        { key: "a", weight: 50 },
        { key: "b", weight: 50 }
      ];
      const selected = weightedSelection(entries);
      expect(["a", "b"]).toContain(selected);
    });
  });

  describe("selectTopN", () => {
    it("should select top N entries by weight", () => {
      const entries: WeightedEntry<string>[] = [
        { key: "a", weight: 10 },
        { key: "b", weight: 30 },
        { key: "c", weight: 20 },
        { key: "d", weight: 5 }
      ];
      expect(selectTopN(entries, 2)).toEqual(["b", "c"]);
    });

    it("should handle N larger than array", () => {
      const entries: WeightedEntry<string>[] = [
        { key: "a", weight: 10 },
        { key: "b", weight: 5 }
      ];
      expect(selectTopN(entries, 5)).toEqual(["a", "b"]);
    });
  });

  describe("normalizeWeights", () => {
    it("should normalize weights to sum to 1", () => {
      const entries: WeightedEntry<string>[] = [
        { key: "a", weight: 20 },
        { key: "b", weight: 30 }
      ];
      const normalized = normalizeWeights(entries);
      const sum = normalized.reduce((s, e) => s + e.weight, 0);
      expect(sum).toBeCloseTo(1);
    });

    it("should filter out zero weights", () => {
      const entries: WeightedEntry<string>[] = [
        { key: "a", weight: 50 },
        { key: "b", weight: 0 }
      ];
      const normalized = normalizeWeights(entries);
      expect(normalized.length).toBe(1);
      expect(normalized[0]?.weight).toBe(1);
    });
  });

  describe("scaleWeights", () => {
    it("should scale weights by factor", () => {
      const entries: WeightedEntry<string>[] = [
        { key: "a", weight: 10 },
        { key: "b", weight: 20 }
      ];
      const scaled = scaleWeights(entries, 2);
      expect(scaled[0]?.weight).toBe(20);
      expect(scaled[1]?.weight).toBe(40);
    });

    it("should clamp negative results to 0", () => {
      const entries: WeightedEntry<string>[] = [{ key: "a", weight: -10 }];
      const scaled = scaleWeights(entries, 2);
      expect(scaled[0]?.weight).toBe(0);
    });
  });

  describe("getHighest", () => {
    it("should return highest weighted entry", () => {
      const entries: WeightedEntry<string>[] = [
        { key: "a", weight: 10 },
        { key: "b", weight: 30 },
        { key: "c", weight: 20 }
      ];
      expect(getHighest(entries)?.key).toBe("b");
    });

    it("should return undefined for empty array", () => {
      expect(getHighest([])).toBeUndefined();
    });
  });

  describe("getLowest", () => {
    it("should return lowest positive weighted entry", () => {
      const entries: WeightedEntry<string>[] = [
        { key: "a", weight: 10 },
        { key: "b", weight: 30 },
        { key: "c", weight: 5 }
      ];
      expect(getLowest(entries)?.key).toBe("c");
    });

    it("should ignore zero and negative weights", () => {
      const entries: WeightedEntry<string>[] = [
        { key: "a", weight: 0 },
        { key: "b", weight: -5 },
        { key: "c", weight: 10 }
      ];
      expect(getLowest(entries)?.key).toBe("c");
    });
  });

  describe("filterByMinWeight", () => {
    it("should filter entries below minimum", () => {
      const entries: WeightedEntry<string>[] = [
        { key: "a", weight: 5 },
        { key: "b", weight: 15 },
        { key: "c", weight: 10 }
      ];
      const filtered = filterByMinWeight(entries, 10);
      expect(filtered.length).toBe(2);
      expect(filtered.map(e => e.key)).toContain("b");
      expect(filtered.map(e => e.key)).toContain("c");
    });
  });

  describe("fromRecord / toRecord", () => {
    it("should convert record to entries", () => {
      const record = { a: 10, b: 20 };
      const entries = fromRecord(record);
      expect(entries.length).toBe(2);
      expect(entries.find(e => e.key === "a")?.weight).toBe(10);
    });

    it("should convert entries to record", () => {
      const entries: WeightedEntry<string>[] = [
        { key: "a", weight: 10 },
        { key: "b", weight: 20 }
      ];
      const record = toRecord(entries);
      expect(record["a"]).toBe(10);
      expect(record["b"]).toBe(20);
    });
  });
});
