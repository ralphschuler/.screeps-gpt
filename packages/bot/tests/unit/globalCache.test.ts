import { describe, it, expect, vi } from "vitest";
import { GlobalCache } from "../../src/runtime/memory/GlobalCache";

describe("GlobalCache", () => {
  describe("Basic Operations", () => {
    it("should set and get values", () => {
      const cache = new GlobalCache();

      cache.set("test-key", "test-value");
      const result = cache.get<string>("test-key");

      expect(result).toBe("test-value");
    });

    it("should return undefined for missing keys", () => {
      const cache = new GlobalCache();

      const result = cache.get("nonexistent");

      expect(result).toBeUndefined();
    });

    it("should check if key exists", () => {
      const cache = new GlobalCache();

      cache.set("exists", 42);

      expect(cache.has("exists")).toBe(true);
      expect(cache.has("missing")).toBe(false);
    });

    it("should delete entries", () => {
      const cache = new GlobalCache();

      cache.set("to-delete", "value");
      expect(cache.has("to-delete")).toBe(true);

      const deleted = cache.delete("to-delete");
      expect(deleted).toBe(true);
      expect(cache.has("to-delete")).toBe(false);
    });

    it("should clear all entries", () => {
      const cache = new GlobalCache();

      cache.set("key1", "value1");
      cache.set("key2", "value2");
      expect(cache.size).toBe(2);

      cache.clear();
      expect(cache.size).toBe(0);
    });

    it("should store complex objects", () => {
      const cache = new GlobalCache();
      const complexObject = {
        nested: { array: [1, 2, 3] },
        fn: () => "test",
        date: new Date()
      };

      cache.set("complex", complexObject);
      const result = cache.get<typeof complexObject>("complex");

      expect(result).toBe(complexObject); // Same reference
      expect(result?.nested.array).toEqual([1, 2, 3]);
      expect(typeof result?.fn).toBe("function");
    });
  });

  describe("TTL Expiration", () => {
    it("should expire entries after TTL", () => {
      const cache = new GlobalCache({ defaultTtl: 10 });

      // Mock Game.time
      const originalGame = globalThis.Game;
      globalThis.Game = { time: 100 } as Game;

      cache.set("expires", "value");

      // Advance time beyond TTL
      globalThis.Game = { time: 115 } as Game;

      const result = cache.get("expires");
      expect(result).toBeUndefined();

      // Restore
      globalThis.Game = originalGame;
    });

    it("should respect custom TTL per entry", () => {
      const cache = new GlobalCache({ defaultTtl: 100 });

      const originalGame = globalThis.Game;
      globalThis.Game = { time: 100 } as Game;

      cache.set("short-ttl", "expires-soon", 5);
      cache.set("long-ttl", "expires-later", 50);

      // Advance time
      globalThis.Game = { time: 110 } as Game;

      expect(cache.get("short-ttl")).toBeUndefined();
      expect(cache.get("long-ttl")).toBe("expires-later");

      // Restore
      globalThis.Game = originalGame;
    });
  });

  describe("Max Entries Limit", () => {
    it("should evict oldest entry when at max capacity", () => {
      const cache = new GlobalCache({ maxEntries: 3 });

      const originalGame = globalThis.Game;
      globalThis.Game = { time: 100 } as Game;

      cache.set("first", 1);
      cache.set("second", 2);
      cache.set("third", 3);

      expect(cache.size).toBe(3);

      // Adding fourth should evict first
      cache.set("fourth", 4);

      expect(cache.size).toBe(3);
      expect(cache.has("first")).toBe(false);
      expect(cache.has("second")).toBe(true);
      expect(cache.has("third")).toBe(true);
      expect(cache.has("fourth")).toBe(true);

      // Restore
      globalThis.Game = originalGame;
    });

    it("should not evict when updating existing key", () => {
      const cache = new GlobalCache({ maxEntries: 2 });

      const originalGame = globalThis.Game;
      globalThis.Game = { time: 100 } as Game;

      cache.set("key1", "original");
      cache.set("key2", "second");

      // Update existing key should not evict
      cache.set("key1", "updated");

      expect(cache.size).toBe(2);
      expect(cache.get("key1")).toBe("updated");
      expect(cache.get("key2")).toBe("second");

      // Restore
      globalThis.Game = originalGame;
    });
  });

  describe("getOrCompute", () => {
    it("should return cached value if available", () => {
      const cache = new GlobalCache();

      const originalGame = globalThis.Game;
      globalThis.Game = { time: 100 } as Game;

      cache.set("precomputed", 42);
      const computeFn = vi.fn(() => 99);

      const result = cache.getOrCompute("precomputed", computeFn);

      expect(result).toBe(42);
      expect(computeFn).not.toHaveBeenCalled();

      // Restore
      globalThis.Game = originalGame;
    });

    it("should compute and cache value if not available", () => {
      const cache = new GlobalCache();

      const originalGame = globalThis.Game;
      globalThis.Game = { time: 100 } as Game;

      const computeFn = vi.fn(() => "computed-value");

      const result = cache.getOrCompute("new-key", computeFn);

      expect(result).toBe("computed-value");
      expect(computeFn).toHaveBeenCalledOnce();
      expect(cache.get("new-key")).toBe("computed-value");

      // Restore
      globalThis.Game = originalGame;
    });

    it("should use custom TTL for computed values", () => {
      const cache = new GlobalCache({ defaultTtl: 100 });

      const originalGame = globalThis.Game;
      globalThis.Game = { time: 100 } as Game;

      cache.getOrCompute("short-lived", () => "value", 5);

      globalThis.Game = { time: 110 } as Game;

      expect(cache.get("short-lived")).toBeUndefined();

      // Restore
      globalThis.Game = originalGame;
    });
  });

  describe("Cleanup", () => {
    it("should cleanup expired entries", () => {
      const cache = new GlobalCache({ defaultTtl: 10 });

      const originalGame = globalThis.Game;
      globalThis.Game = { time: 100 } as Game;

      cache.set("expires1", "value1");
      cache.set("expires2", "value2");
      cache.set("stays", "value3", 100);

      globalThis.Game = { time: 115 } as Game;

      const cleaned = cache.cleanup(115);

      expect(cleaned).toBe(2);
      expect(cache.size).toBe(1);
      expect(cache.has("stays")).toBe(true);

      // Restore
      globalThis.Game = originalGame;
    });
  });

  describe("Statistics", () => {
    it("should track cache stats", () => {
      const cache = new GlobalCache({ maxEntries: 100 });

      cache.set("key1", "value1");
      cache.set("key2", "value2");

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.maxEntries).toBe(100);
    });
  });
});
