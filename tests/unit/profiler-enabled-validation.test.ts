/**
 * Unit tests for PROFILER_ENABLED environment variable validation
 *
 * Tests the validation function in buildProject.ts that checks:
 * - Valid values ("true", "false", undefined) are accepted
 * - Invalid values trigger warnings and default to true
 * - Warning messages are clear and informative
 *
 * Related issue: ralphschuler/.screeps-gpt - Add validation for PROFILER_ENABLED environment variable
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateProfilerEnabled } from "../../packages/utilities/scripts/lib/buildProject";

describe("PROFILER_ENABLED Validation", () => {
  let originalEnv: string | undefined;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Save original environment variable
    originalEnv = process.env.PROFILER_ENABLED;

    // Spy on console.warn
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment variable
    if (originalEnv !== undefined) {
      process.env.PROFILER_ENABLED = originalEnv;
    } else {
      delete process.env.PROFILER_ENABLED;
    }

    // Restore console.warn
    consoleWarnSpy.mockRestore();
  });

  describe("Valid values", () => {
    it("should return true when PROFILER_ENABLED is 'true'", () => {
      process.env.PROFILER_ENABLED = "true";
      const result = validateProfilerEnabled();

      expect(result).toBe(true);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should return false when PROFILER_ENABLED is 'false'", () => {
      process.env.PROFILER_ENABLED = "false";
      const result = validateProfilerEnabled();

      expect(result).toBe(false);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should return true (default) when PROFILER_ENABLED is undefined", () => {
      delete process.env.PROFILER_ENABLED;
      const result = validateProfilerEnabled();

      expect(result).toBe(true);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe("Invalid values with warnings", () => {
    it("should warn and default to true for typo 'fals'", () => {
      process.env.PROFILER_ENABLED = "fals";
      const result = validateProfilerEnabled();

      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Warning: Invalid PROFILER_ENABLED value 'fals', expected 'true' or 'false'. Defaulting to true."
      );
    });

    it("should warn and default to true for typo 'True' (case-sensitive)", () => {
      process.env.PROFILER_ENABLED = "True";
      const result = validateProfilerEnabled();

      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Warning: Invalid PROFILER_ENABLED value 'True', expected 'true' or 'false'. Defaulting to true."
      );
    });

    it("should warn and default to true for typo 'FALSE' (case-sensitive)", () => {
      process.env.PROFILER_ENABLED = "FALSE";
      const result = validateProfilerEnabled();

      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Warning: Invalid PROFILER_ENABLED value 'FALSE', expected 'true' or 'false'. Defaulting to true."
      );
    });

    it("should warn and default to true for numeric '0'", () => {
      process.env.PROFILER_ENABLED = "0";
      const result = validateProfilerEnabled();

      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Warning: Invalid PROFILER_ENABLED value '0', expected 'true' or 'false'. Defaulting to true."
      );
    });

    it("should warn and default to true for numeric '1'", () => {
      process.env.PROFILER_ENABLED = "1";
      const result = validateProfilerEnabled();

      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Warning: Invalid PROFILER_ENABLED value '1', expected 'true' or 'false'. Defaulting to true."
      );
    });

    it("should warn and default to true for empty string", () => {
      process.env.PROFILER_ENABLED = "";
      const result = validateProfilerEnabled();

      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Warning: Invalid PROFILER_ENABLED value '', expected 'true' or 'false'. Defaulting to true."
      );
    });

    it("should warn and default to true for arbitrary string", () => {
      process.env.PROFILER_ENABLED = "yes";
      const result = validateProfilerEnabled();

      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Warning: Invalid PROFILER_ENABLED value 'yes', expected 'true' or 'false'. Defaulting to true."
      );
    });
  });

  describe("Warning message quality", () => {
    it("should provide clear guidance in warning message", () => {
      process.env.PROFILER_ENABLED = "invalid";
      validateProfilerEnabled();

      const warningMessage = consoleWarnSpy.mock.calls[0][0];

      // Should mention the invalid value
      expect(warningMessage).toContain("invalid");

      // Should mention expected values
      expect(warningMessage).toContain("true");
      expect(warningMessage).toContain("false");

      // Should mention the default behavior
      expect(warningMessage).toContain("Defaulting to true");
    });
  });
});
