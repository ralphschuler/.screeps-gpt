import { describe, it, expect } from "vitest";
import { safeSerialize } from "../../packages/screeps-logger/src/safeSerialize";

/**
 * Comprehensive regression test for safeSerialize utility.
 *
 * Context: Console logging encountered "Cannot convert object to primitive value"
 * errors when attempting to log complex objects, Error objects, or objects with
 * circular references in Screeps console environment.
 *
 * Root Cause: Direct string interpolation of objects in template literals causes
 * primitive conversion errors when objects lack proper toString/toJSON methods.
 *
 * Solution: safeSerialize() utility provides comprehensive serialization that
 * handles all edge cases: primitives, errors, circular refs, unserializable objects.
 *
 * GitHub Issue: ralphschuler/.screeps-gpt#1237 (console.log regression)
 * Previous Issue: ralphschuler/.screeps-gpt#514
 * Previous Fix: PR ralphschuler/.screeps-gpt#590
 */
describe("safeSerialize - Console Serialization Safety", () => {
  describe("Primitive types", () => {
    it("should handle null", () => {
      expect(safeSerialize(null)).toBe("null");
    });

    it("should handle undefined", () => {
      expect(safeSerialize(undefined)).toBe("undefined");
    });

    it("should handle strings", () => {
      expect(safeSerialize("test")).toBe("test");
    });

    it("should handle numbers", () => {
      expect(safeSerialize(42)).toBe("42");
      expect(safeSerialize(3.14)).toBe("3.14");
    });

    it("should handle booleans", () => {
      expect(safeSerialize(true)).toBe("true");
      expect(safeSerialize(false)).toBe("false");
    });
  });

  describe("Error objects", () => {
    it("should serialize basic Error objects", () => {
      const error = new Error("Test error");
      const result = safeSerialize(error);

      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.name).toBe("Error");
      expect(parsed.message).toBe("Test error");
      expect(parsed.stack).toBeDefined();
    });

    it("should serialize TypeError objects", () => {
      const error = new TypeError("Cannot convert object to primitive value");
      const result = safeSerialize(error);

      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.name).toBe("TypeError");
      expect(parsed.message).toContain("Cannot convert");
    });

    it("should serialize Zod-like error objects with issues", () => {
      const zodError = {
        name: "ZodError",
        message: "Validation failed",
        issues: [
          { code: "invalid_type", path: ["time"], message: "Expected number, received string" },
          { code: "required", path: ["cpu"], message: "Required" }
        ]
      };
      // Create a real Error object with issues property
      const error = Object.assign(new Error("Validation failed"), zodError);

      const result = safeSerialize(error);

      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.issues).toBeDefined();
      expect(Array.isArray(parsed.issues)).toBe(true);
      expect(parsed.issues.length).toBe(2);
    });

    it("should not cause primitive conversion errors when used in template literals", () => {
      const error = new Error("Test error");
      expect(() => {
        const message = `Error occurred: ${safeSerialize(error)}`;
        expect(message).toContain("Error occurred:");
        expect(message).toContain("Test error");
      }).not.toThrow();
    });
  });

  describe("Circular references", () => {
    it("should handle circular object references", () => {
      const obj: Record<string, unknown> = { a: 1 };
      obj.self = obj;

      const result = safeSerialize(obj);
      expect(() => JSON.parse(result)).not.toThrow();
      expect(result).toContain("[Circular]");
    });

    it("should handle deep circular references", () => {
      const obj: Record<string, unknown> = { a: { b: { c: {} } } };
      const nested = obj.a as Record<string, unknown>;
      const deeper = nested.b as Record<string, unknown>;
      deeper.root = obj;

      const result = safeSerialize(obj);
      expect(() => JSON.parse(result)).not.toThrow();
      expect(result).toContain("[Circular]");
    });

    it("should handle arrays with circular references", () => {
      const arr: unknown[] = [1, 2];
      arr.push(arr);

      const result = safeSerialize(arr);
      expect(() => JSON.parse(result)).not.toThrow();
      expect(result).toContain("[Circular]");
    });
  });

  describe("Complex objects", () => {
    it("should serialize simple objects", () => {
      const obj = { name: "test", value: 42 };
      const result = safeSerialize(obj);

      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.name).toBe("test");
      expect(parsed.value).toBe(42);
    });

    it("should serialize nested objects", () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              value: "deep"
            }
          }
        }
      };
      const result = safeSerialize(obj);

      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.level1.level2.level3.value).toBe("deep");
    });

    it("should serialize arrays", () => {
      const arr = [1, 2, 3, "test", { nested: true }];
      const result = safeSerialize(arr);

      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(5);
    });

    it("should handle objects without toString method", () => {
      const obj = Object.create(null);
      obj.data = "value";
      obj.number = 123;

      expect(() => {
        const result = safeSerialize(obj);
        expect(result).toBeDefined();
        // Should be serializable
        expect(() => JSON.parse(result)).not.toThrow();
      }).not.toThrow();
    });
  });

  describe("Edge cases", () => {
    it("should handle objects with toJSON method", () => {
      const obj = {
        value: 42,
        toJSON() {
          return { customValue: this.value * 2 };
        }
      };
      const result = safeSerialize(obj);

      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.customValue).toBe(84);
    });

    it("should handle Date objects", () => {
      const date = new Date("2025-11-24T15:30:00Z");
      const result = safeSerialize(date);

      expect(() => JSON.parse(result)).not.toThrow();
      expect(result).toContain("2025-11-24");
    });

    it("should handle Map objects", () => {
      const map = new Map([
        ["key1", "value1"],
        ["key2", "value2"]
      ]);
      const result = safeSerialize(map);

      // Maps serialize as empty objects in JSON, but shouldn't throw
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it("should handle Set objects", () => {
      const set = new Set([1, 2, 3]);
      const result = safeSerialize(set);

      // Sets serialize as empty objects in JSON, but shouldn't throw
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it("should handle functions (which can't be serialized)", () => {
      const func = () => "test";
      const obj = { fn: func };
      const result = safeSerialize(obj);

      // Functions are omitted in JSON serialization
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.fn).toBeUndefined();
    });

    it("should handle symbols in objects", () => {
      const sym = Symbol("test");
      const obj = { [sym]: "value", regular: "data" };
      const result = safeSerialize(obj);

      // Symbols are omitted in JSON serialization
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.regular).toBe("data");
    });
  });

  describe("Screeps environment simulation", () => {
    it("should produce output that works in Screeps console evaluation", () => {
      // Simulate the Screeps console environment which wraps code in functions
      // like _console1763990245255_0 and performs string conversion
      const testCases = [
        new Error("Test error"),
        { complex: { nested: { data: "value" } } },
        { issues: [{ code: "test" }] },
        null,
        undefined,
        "string",
        42
      ];

      testCases.forEach(testCase => {
        expect(() => {
          // Force string conversion like Screeps console does
          const output = String(safeSerialize(testCase));
          expect(typeof output).toBe("string");
          expect(output.length).toBeGreaterThan(0);
        }).not.toThrow();
      });
    });

    it("should handle errors with complex properties", () => {
      const error = new Error("Base error");
      (error as Record<string, unknown>).customProperty = {
        nested: {
          deeply: {
            value: "test"
          }
        }
      };

      const result = safeSerialize(error);
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.customProperty).toBeDefined();
      expect(parsed.customProperty.nested.deeply.value).toBe("test");
    });

    it("should not produce [object Object] in output", () => {
      const obj = { test: "value" };
      const result = safeSerialize(obj);

      // Should produce valid JSON, not [object Object]
      expect(result).not.toContain("[object Object]");
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  describe("Performance and safety", () => {
    it("should handle very large objects without throwing", () => {
      const largeObj: Record<string, unknown> = {};
      for (let i = 0; i < 1000; i++) {
        largeObj[`key${i}`] = `value${i}`;
      }

      expect(() => {
        const result = safeSerialize(largeObj);
        expect(result).toBeDefined();
      }).not.toThrow();
    });

    it("should handle deeply nested objects without stack overflow", () => {
      let obj: Record<string, unknown> = { leaf: "value" };
      for (let i = 0; i < 50; i++) {
        obj = { nested: obj };
      }

      expect(() => {
        const result = safeSerialize(obj);
        expect(result).toBeDefined();
      }).not.toThrow();
    });
  });
});
