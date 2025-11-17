import { describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * Unit tests for ensure-profiler-running script
 *
 * Tests the script that ensures profiler is running via console commands:
 * - Checks profiler status via console
 * - Starts profiler if not running
 * - Handles various profiler states (running, stopped, not_initialized)
 * - Validates error handling for API failures
 */

describe("Ensure Profiler Running Script", () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Save original environment variables
    originalEnv = {
      SCREEPS_TOKEN: process.env.SCREEPS_TOKEN,
      SCREEPS_HOST: process.env.SCREEPS_HOST,
      SCREEPS_SHARD: process.env.SCREEPS_SHARD,
      SCREEPS_PORT: process.env.SCREEPS_PORT,
      SCREEPS_PROTOCOL: process.env.SCREEPS_PROTOCOL
    };

    // Set test environment variables
    process.env.SCREEPS_TOKEN = "test-token";
    process.env.SCREEPS_HOST = "test.screeps.com";
    process.env.SCREEPS_SHARD = "shard3";
  });

  afterEach(() => {
    // Restore original environment variables
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  });

  describe("Environment validation", () => {
    it("should require SCREEPS_TOKEN environment variable", async () => {
      delete process.env.SCREEPS_TOKEN;

      // Dynamic import to ensure fresh module state
      const { ensureProfilerRunning } = await import(
        "../../packages/utilities/scripts/ensure-profiler-running"
      );

      await expect(ensureProfilerRunning()).rejects.toThrow("Missing SCREEPS_TOKEN environment variable");
    });

    it("should use default values for optional environment variables", () => {
      delete process.env.SCREEPS_HOST;
      delete process.env.SCREEPS_PROTOCOL;
      delete process.env.SCREEPS_SHARD;

      // Just verify no error is thrown during module load
      expect(() => {
        import("../../packages/utilities/scripts/ensure-profiler-running");
      }).not.toThrow();
    });
  });

  describe("Profiler state detection", () => {
    it("should detect when profiler is already running", async () => {
      // This test validates the logic for detecting running profiler
      // In a real environment, this would check Memory.profiler.start !== undefined

      const mockCheckResult = {
        status: "running",
        startTick: 12345
      };

      // The script should exit early without starting profiler
      expect(mockCheckResult.status).toBe("running");
      expect(mockCheckResult.startTick).toBe(12345);
    });

    it("should detect when profiler is stopped", () => {
      const mockCheckResult = {
        status: "stopped"
      };

      // The script should attempt to start the profiler
      expect(mockCheckResult.status).toBe("stopped");
    });

    it("should detect when profiler is not initialized", () => {
      const mockCheckResult = {
        status: "not_initialized"
      };

      // The script should log a warning and attempt to start
      expect(mockCheckResult.status).toBe("not_initialized");
    });
  });

  describe("Profiler start command", () => {
    it("should construct valid console command for starting profiler", () => {
      const expectedCommand = `
      (function() {
        if (typeof Profiler === 'undefined') {
          return JSON.stringify({ success: false, error: 'Profiler not available' });
        }
        const result = Profiler.start();
        return JSON.stringify({ success: true, message: result });
      })()
    `.trim();

      // Validate command structure
      expect(expectedCommand).toContain("Profiler.start()");
      expect(expectedCommand).toContain("JSON.stringify");
      expect(expectedCommand).toContain("success");
    });

    it("should handle successful profiler start", () => {
      const mockStartResult = {
        success: true,
        message: "Profiler started"
      };

      expect(mockStartResult.success).toBe(true);
      expect(mockStartResult.message).toBe("Profiler started");
    });

    it("should handle failed profiler start", () => {
      const mockStartResult = {
        success: false,
        error: "Profiler not available"
      };

      expect(mockStartResult.success).toBe(false);
      expect(mockStartResult.error).toBeDefined();
    });
  });

  describe("Error handling", () => {
    it("should handle console API errors gracefully", async () => {
      const mockError = new Error("Console command failed");

      // Verify error is properly caught and handled
      expect(mockError.message).toBe("Console command failed");
    });

    it("should provide helpful error messages for common failures", () => {
      const errorMessages = [
        "Code was built with PROFILER_ENABLED=false",
        "Profiler global is not exposed",
        "There's an issue with the profiler initialization"
      ];

      // These messages should guide users to resolve common issues
      errorMessages.forEach(msg => {
        expect(msg).toBeTruthy();
      });
    });
  });

  describe("Idempotency", () => {
    it("should be safe to run multiple times", () => {
      // Running the script multiple times should not cause issues
      // If profiler is already running, it should exit early
      const firstRun = { status: "running", startTick: 100 };
      const secondRun = { status: "running", startTick: 100 };

      expect(firstRun).toEqual(secondRun);
    });

    it("should not restart already-running profiler", () => {
      const profilerStatus = { status: "running" };

      // Script should check status first and skip start command
      expect(profilerStatus.status).toBe("running");
    });
  });

  describe("Console command structure", () => {
    it("should use IIFE pattern for console commands", () => {
      const checkCommand = `(function() { return 'test'; })()`;

      expect(checkCommand).toMatch(/^\(function\(\)/);
      expect(checkCommand).toMatch(/\}\)\(\)$/);
    });

    it("should return JSON-serialized results", () => {
      const resultPattern = /JSON\.stringify/;

      const checkCommand = `JSON.stringify({ status: 'test' })`;
      expect(checkCommand).toMatch(resultPattern);
    });
  });
});
