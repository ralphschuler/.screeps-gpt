import { describe, it, expect, beforeEach, vi } from "vitest";
import { init, profile } from "../../src/index.js";

// Setup global Memory and Game for tests
declare global {
  var Memory: Memory;
  var Game: Game;
  var __PROFILER_ENABLED__: boolean;
}

describe("Profiler", () => {
  beforeEach(() => {
    // Initialize global Memory if not present
    if (!global.Memory) {
      global.Memory = {
        creeps: {},
        spawns: {},
        flags: {},
        rooms: {},
        profiler: {
          data: {},
          total: 0
        }
      } as Memory;
    }

    // Reset Memory.profiler before each test
    global.Memory.profiler = {
      data: {},
      total: 0
    };

    // Initialize Game global for time tracking
    if (!global.Game) {
      global.Game = {
        time: 0,
        cpu: {
          getUsed: () => 0
        }
      } as Game;
    }

    // Set profiler enabled for tests
    (global as any).__PROFILER_ENABLED__ = true;
  });

  describe("initialization", () => {
    it("should initialize profiler with default memory structure", () => {
      const profiler = init();
      expect(profiler).toBeDefined();
      expect(global.Memory.profiler).toBeDefined();
      expect(global.Memory.profiler.data).toEqual({});
      expect(global.Memory.profiler.total).toBe(0);
    });

    it("should expose standard profiler methods", () => {
      const profiler = init();
      expect(profiler.start).toBeInstanceOf(Function);
      expect(profiler.stop).toBeInstanceOf(Function);
      expect(profiler.status).toBeInstanceOf(Function);
      expect(profiler.output).toBeInstanceOf(Function);
      expect(profiler.clear).toBeInstanceOf(Function);
    });
  });

  describe("start/stop", () => {
    it("should start profiling and set start tick", () => {
      const profiler = init();
      global.Game.time = 100;

      const result = profiler.start();
      expect(result).toBe("Profiler started");
      expect(global.Memory.profiler.start).toBe(100);
    });

    it("should stop profiling and update total ticks", () => {
      const profiler = init();
      global.Game.time = 100;

      profiler.start();
      global.Game.time = 150;
      const result = profiler.stop();

      expect(result).toBe("Profiler stopped");
      expect(global.Memory.profiler.start).toBeUndefined();
      expect(global.Memory.profiler.total).toBe(50);
    });

    it("should return message when stopping while not running", () => {
      const profiler = init();
      const result = profiler.stop();
      expect(result).toBe("Profiler is not running");
    });
  });

  describe("status", () => {
    it("should report stopped status when not running", () => {
      const profiler = init();
      expect(profiler.status()).toBe("Profiler is stopped");
    });

    it("should report running status when profiling is active", () => {
      const profiler = init();
      global.Game.time = 100;
      profiler.start();
      expect(profiler.status()).toBe("Profiler is running");
    });
  });

  describe("clear", () => {
    it("should clear profiling data", () => {
      const profiler = init();
      global.Memory.profiler.data = { "test:method": { calls: 10, time: 5.0 } };
      global.Memory.profiler.total = 100;

      profiler.clear();

      expect(global.Memory.profiler.data).toEqual({});
      expect(global.Memory.profiler.total).toBe(0);
      expect(global.Memory.profiler.start).toBeUndefined();
    });

    it("should preserve running state when clearing", () => {
      const profiler = init();
      global.Game.time = 100;

      profiler.start();
      profiler.clear();

      expect(global.Memory.profiler.start).toBe(100);
      expect(global.Memory.profiler.data).toEqual({});
    });
  });

  describe("output", () => {
    it("should output profiling data without errors", () => {
      const profiler = init();
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      global.Memory.profiler.data = {
        "TestClass:testMethod": { calls: 100, time: 50.0 }
      };
      global.Memory.profiler.total = 100;

      const result = profiler.output();
      expect(result).toBe("Done");
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle empty profiling data", () => {
      const profiler = init();
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      global.Memory.profiler.total = 0;

      expect(() => profiler.output()).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe("decorator integration", () => {
    // Define test class outside to avoid memory leaks
    class TestClass {
      public testMethod(): string {
        return "test";
      }
    }

    it("should have profile decorator function available", () => {
      expect(profile).toBeDefined();
      expect(profile).toBeInstanceOf(Function);
    });

    it("should not throw when applying decorator", () => {
      // Apply decorator to the test class
      profile(TestClass);

      const instance = new TestClass();
      expect(instance.testMethod()).toBe("test");
    });
  });

  describe("toString", () => {
    it("should provide usage information", () => {
      const profiler = init();
      const helpText = profiler.toString();

      expect(helpText).toContain("Profiler.start()");
      expect(helpText).toContain("Profiler.stop()");
      expect(helpText).toContain("Profiler.status()");
      expect(helpText).toContain("Profiler.output()");
    });
  });
});
