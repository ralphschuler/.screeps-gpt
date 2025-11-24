import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryValidator } from "../../packages/bot/src/runtime/memory/MemoryValidator";

/**
 * Regression test for TypeError: Cannot convert object to primitive value
 *
 * Issue: Console logging encountered type conversion errors when trying to
 * log Zod error objects. The error occurred at MemoryValidator.ts:74 where
 * `result.error.message` was used directly in a template literal, but Zod
 * errors don't have a simple message property that converts to primitives.
 *
 * Root Cause: Attempting to stringify Zod error objects without proper
 * serialization (JSON.stringify) caused primitive conversion errors in
 * Screeps console environment.
 *
 * Fix: Changed from `result.error.message` to `JSON.stringify(result.error.issues)`
 * to properly serialize the error structure for console output.
 *
 * Email notification: noreply@screeps.com, 2025-11-07
 */
describe("Console Output TypeError Regression", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Spy on console.log to verify it's called with valid serialized data
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  describe("MemoryValidator error logging", () => {
    it("should properly serialize Zod errors without causing TypeError", () => {
      // Invalid stats object that will trigger validation errors
      const invalidStats = {
        time: "not a number" // Wrong type
        // Missing required fields
      };

      // This should not throw "Cannot convert object to primitive value"
      expect(() => {
        MemoryValidator.validateStats(invalidStats);
      }).not.toThrow();

      // Verify console.log was called
      expect(consoleLogSpy).toHaveBeenCalled();

      // Get the logged message
      const loggedMessage = consoleLogSpy.mock.calls[0]?.[0] as string;

      // Verify the message contains properly serialized error data
      expect(loggedMessage).toContain("[ERROR]");
      expect(loggedMessage).toContain("Invalid Memory.stats structure:");
      expect(loggedMessage).toContain("[{"); // Start of JSON array with object
      expect(loggedMessage).toContain("}]"); // End of JSON array with object
      expect(loggedMessage).toContain('{"component":"MemoryValidator"}'); // Component context

      // The logger now includes context, so we need to verify the data contains valid Zod errors
      // Extract the JSON array part (between the prefix and the context)
      expect(loggedMessage).toMatch(/\[\{.*?"code".*?\}\]/); // Contains Zod error format
    });

    it("should handle multiple validation errors without TypeError", () => {
      const invalidStats = {
        // Completely empty object - will trigger multiple validation errors
      };

      expect(() => {
        MemoryValidator.validateStats(invalidStats);
      }).not.toThrow();

      expect(consoleLogSpy).toHaveBeenCalled();
      const loggedMessage = consoleLogSpy.mock.calls[0]?.[0] as string;

      // Should contain multiple errors in the logged output
      expect(loggedMessage).toContain("[ERROR]");
      expect(loggedMessage).toMatch(/\[.*?"code".*?"code".*?\]/); // Multiple error objects
    });

    it("should handle null input without TypeError", () => {
      expect(() => {
        MemoryValidator.validateStats(null);
      }).not.toThrow();

      expect(consoleLogSpy).toHaveBeenCalled();
      const loggedMessage = consoleLogSpy.mock.calls[0]?.[0] as string;

      // Verify proper serialization - logger includes ERROR level and component context
      expect(loggedMessage).toContain("[ERROR]");
      expect(loggedMessage).toContain("Invalid Memory.stats structure:");
    });

    it("should handle validateAndRepairStats logging without TypeError", () => {
      const memory: Memory = {
        stats: {
          time: 1000,
          cpu: { used: 5 } // Incomplete - missing limit and bucket
        } as Memory["stats"]
      } as Memory;

      // This should log errors but not throw
      expect(() => {
        MemoryValidator.validateAndRepairStats(memory, 1000);
      }).not.toThrow();

      // Should have logged both validation error and repair message
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);

      // Check first log (validation error) - now uses logger format
      const validationLog = consoleLogSpy.mock.calls[0]?.[0] as string;
      expect(validationLog).toContain("[ERROR]");
      expect(validationLog).toContain("Invalid Memory.stats structure:");
      expect(validationLog).toContain('{"component":"MemoryValidator"}');

      // Check second log (repair message) - now uses logger format
      const repairLog = consoleLogSpy.mock.calls[1]?.[0] as string;
      expect(repairLog).toContain("[INFO]");
      expect(repairLog).toContain("Repairing corrupted Memory.stats with defaults");
      expect(repairLog).toContain('{"component":"MemoryValidator"}');
    });
  });

  describe("Primitive conversion safety", () => {
    it("should not attempt to use error.message property on Zod errors", () => {
      const invalidStats = { time: "invalid" };

      MemoryValidator.validateStats(invalidStats);

      const loggedMessage = consoleLogSpy.mock.calls[0]?.[0] as string;

      // Verify we're properly serializing Zod errors through the logger
      // Should not contain [object Object] which would indicate improper conversion
      expect(loggedMessage).not.toContain("[object Object]");
      expect(loggedMessage).toContain("[ERROR]");
      expect(loggedMessage).toContain('"code"'); // Zod error JSON property
      expect(loggedMessage).toContain('"path"'); // Zod error JSON property
    });

    it("should produce console output that works in Screeps environment", () => {
      // Screeps console wraps code in functions like _console1762455032490_0
      // This test verifies the output doesn't trigger primitive conversion errors
      const invalidStats = { time: "string instead of number" };

      // Simulate Screeps-like console evaluation by converting to string
      let consoleOutput = "";
      consoleLogSpy.mockImplementation((msg: string) => {
        consoleOutput = String(msg); // Force string conversion like Screeps does
      });

      expect(() => {
        MemoryValidator.validateStats(invalidStats);
      }).not.toThrow();

      // Verify output is a valid string (logger handles safe serialization)
      expect(typeof consoleOutput).toBe("string");
      expect(consoleOutput.length).toBeGreaterThan(0);
      expect(consoleOutput).toContain("[ERROR]");
      expect(consoleOutput).toContain("Invalid Memory.stats structure:");
      expect(consoleOutput).not.toContain("[object Object]");
    });
  });
});
