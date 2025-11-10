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

      // Verify the message contains properly serialized JSON array
      expect(loggedMessage).toContain("[MemoryValidator] Invalid Memory.stats structure:");
      expect(loggedMessage).toContain("[{"); // Start of JSON array with object
      expect(loggedMessage).toContain("}]"); // End of JSON array with object

      // Verify the message contains valid JSON that can be parsed
      const jsonPart = loggedMessage.split("structure: ")[1];
      expect(() => JSON.parse(jsonPart)).not.toThrow();

      // Verify the parsed structure contains expected Zod error format
      const parsedErrors = JSON.parse(jsonPart);
      expect(Array.isArray(parsedErrors)).toBe(true);
      expect(parsedErrors.length).toBeGreaterThan(0);
      expect(parsedErrors[0]).toHaveProperty("code");
      expect(parsedErrors[0]).toHaveProperty("path");
      expect(parsedErrors[0]).toHaveProperty("message");
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

      // Should contain multiple errors in the array
      const jsonPart = loggedMessage.split("structure: ")[1];
      const parsedErrors = JSON.parse(jsonPart);
      expect(parsedErrors.length).toBeGreaterThan(1); // Multiple validation errors
    });

    it("should handle null input without TypeError", () => {
      expect(() => {
        MemoryValidator.validateStats(null);
      }).not.toThrow();

      expect(consoleLogSpy).toHaveBeenCalled();
      const loggedMessage = consoleLogSpy.mock.calls[0]?.[0] as string;

      // Verify proper serialization
      const jsonPart = loggedMessage.split("structure: ")[1];
      expect(() => JSON.parse(jsonPart)).not.toThrow();
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

      // Check first log (validation error)
      const validationLog = consoleLogSpy.mock.calls[0]?.[0] as string;
      expect(validationLog).toContain("[MemoryValidator] Invalid Memory.stats structure:");

      // Check second log (repair message)
      const repairLog = consoleLogSpy.mock.calls[1]?.[0] as string;
      expect(repairLog).toBe("[MemoryValidator] Repairing corrupted Memory.stats with defaults");
    });
  });

  describe("Primitive conversion safety", () => {
    it("should not attempt to use error.message property on Zod errors", () => {
      const invalidStats = { time: "invalid" };

      MemoryValidator.validateStats(invalidStats);

      const loggedMessage = consoleLogSpy.mock.calls[0]?.[0] as string;

      // Verify we're not using .message property (which doesn't exist on Zod errors)
      // Instead we should see properly serialized JSON with the issues array
      expect(loggedMessage).not.toContain("[object Object]"); // Would appear if improper conversion
      expect(loggedMessage).toContain('"code"'); // JSON property
      expect(loggedMessage).toContain('"path"'); // JSON property
      expect(loggedMessage).toContain('"message"'); // JSON property (not error.message!)
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

      // Verify output is a valid string
      expect(typeof consoleOutput).toBe("string");
      expect(consoleOutput.length).toBeGreaterThan(0);

      // Verify it contains valid JSON
      const jsonPart = consoleOutput.split("structure: ")[1];
      expect(() => JSON.parse(jsonPart)).not.toThrow();
    });
  });
});
