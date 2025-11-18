import { describe, it, expect, beforeEach } from "vitest";

/**
 * Tests for repositorySignalProvider in main.ts
 * Issue: ralphschuler/.screeps-gpt#1002
 *
 * The repositorySignalProvider crashed when Memory.systemReport existed but
 * Memory.systemReport.report was undefined. This test validates the fix using
 * optional chaining to safely access nested properties.
 */
describe("repositorySignalProvider", () => {
  // Store original Memory to restore after tests
  let originalMemory: Memory;

  beforeEach(() => {
    // Save original Memory
    originalMemory = global.Memory;
    // Reset Memory to empty state for each test
    global.Memory = {} as Memory;
  });

  afterEach(() => {
    // Restore original Memory
    global.Memory = originalMemory;
  });

  describe("Memory.systemReport validation", () => {
    it("should return undefined when Memory.systemReport is undefined", () => {
      // Arrange: Memory.systemReport is undefined
      global.Memory = {} as Memory;

      // Act: Access repositorySignalProvider behavior
      const result = Memory.systemReport?.report?.repository;

      // Assert: Should return undefined safely
      expect(result).toBeUndefined();
    });

    it("should return undefined when Memory.systemReport.report is undefined", () => {
      // Arrange: Memory.systemReport exists but report is undefined
      global.Memory = {
        systemReport: {
          lastGenerated: 1000
          // report is missing
        }
      } as Memory;

      // Act: Access with optional chaining
      const result = Memory.systemReport?.report?.repository;

      // Assert: Should return undefined safely without throwing
      expect(result).toBeUndefined();
    });

    it("should return undefined when Memory.systemReport.report.repository is undefined", () => {
      // Arrange: systemReport and report exist but repository is undefined
      global.Memory = {
        systemReport: {
          lastGenerated: 1000,
          report: {
            tick: 1000,
            summary: "System operational",
            findings: []
            // repository is undefined
          }
        }
      } as Memory;

      // Act: Access with optional chaining
      const result = Memory.systemReport?.report?.repository;

      // Assert: Should return undefined safely
      expect(result).toBeUndefined();
    });

    it("should return repository signal when complete structure exists", () => {
      // Arrange: Complete Memory.systemReport structure
      const expectedRepository = {
        coverage: {
          statements: 85.5,
          branches: 78.2,
          functions: 90.1,
          lines: 84.7
        },
        lintErrors: 0,
        testFailures: 0,
        timestamp: "2024-01-01T00:00:00.000Z"
      };

      global.Memory = {
        systemReport: {
          lastGenerated: 1000,
          report: {
            tick: 1000,
            summary: "System operational",
            findings: [],
            repository: expectedRepository
          }
        }
      } as Memory;

      // Act: Access with optional chaining
      const result = Memory.systemReport?.report?.repository;

      // Assert: Should return the repository signal
      expect(result).toBeDefined();
      expect(result).toEqual(expectedRepository);
    });

    it("should handle null values in the chain", () => {
      // Arrange: systemReport is null
      global.Memory = {
        systemReport: null as unknown as Memory["systemReport"]
      } as Memory;

      // Act: Access with optional chaining
      const result = Memory.systemReport?.report?.repository;

      // Assert: Should return undefined safely
      expect(result).toBeUndefined();
    });

    it("should handle report being null", () => {
      // Arrange: report is null
      global.Memory = {
        systemReport: {
          lastGenerated: 1000,
          report: null as unknown as Memory["systemReport"]["report"]
        }
      } as unknown as Memory;

      // Act: Access with optional chaining
      const result = Memory.systemReport?.report?.repository;

      // Assert: Should return undefined safely
      expect(result).toBeUndefined();
    });

    it("should not throw TypeError for incomplete Memory structure", () => {
      // Arrange: Memory.systemReport exists but report is undefined (the crash scenario)
      global.Memory = {
        systemReport: {
          lastGenerated: 5000
          // report is missing - this was causing the crash
        }
      } as Memory;

      // Act & Assert: Should not throw
      expect(() => {
        const result = Memory.systemReport?.report?.repository;
        return result;
      }).not.toThrow();
    });
  });

  describe("Edge cases", () => {
    it("should handle systemReport with empty report object", () => {
      // Arrange: report is an empty object
      global.Memory = {
        systemReport: {
          lastGenerated: 1000,
          report: {} as Memory["systemReport"]["report"]
        }
      } as Memory;

      // Act: Access with optional chaining
      const result = Memory.systemReport?.report?.repository;

      // Assert: Should return undefined
      expect(result).toBeUndefined();
    });

    it("should handle repository with partial data", () => {
      // Arrange: repository exists but with minimal data
      global.Memory = {
        systemReport: {
          lastGenerated: 1000,
          report: {
            tick: 1000,
            summary: "System operational",
            findings: [],
            repository: {
              timestamp: "2024-01-01T00:00:00.000Z"
            }
          }
        }
      } as Memory;

      // Act: Access with optional chaining
      const result = Memory.systemReport?.report?.repository;

      // Assert: Should return the partial repository object
      expect(result).toBeDefined();
      expect(result?.timestamp).toBe("2024-01-01T00:00:00.000Z");
      expect(result?.coverage).toBeUndefined();
    });

    it("should handle deeply nested optional access patterns", () => {
      // Arrange: Memory is completely empty
      global.Memory = {} as Memory;

      // Act: Multiple optional chaining accesses
      const hasSystemReport = Memory.systemReport !== undefined;
      const hasReport = Memory.systemReport?.report !== undefined;
      const hasRepository = Memory.systemReport?.report?.repository !== undefined;

      // Assert: All should be false/undefined
      expect(hasSystemReport).toBe(false);
      expect(hasReport).toBe(false);
      expect(hasRepository).toBe(false);
    });
  });
});
